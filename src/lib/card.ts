import type { Patient } from "@/lib/patients"
import { isTimeZone, type Outcome, type Snapshot } from "@/lib/snapshot"

/**
 * What a patient's card shows, worked out from what their phone sent and the time now.
 * Pure, so every word and every state can be tested. Facts only: no rules a pharmacist
 * would have to set (no "needs a call", no thresholds).
 */

/** A dose on the week grid: taken, missed (its window passed), due now, later, or not scheduled. */
export type CellState = "taken" | "missed" | "due" | "later" | "none"

export type Tone = "ok" | "danger" | "caution"

export interface Column {
  day: string
  /** "Today", or the weekday: "Fri". */
  label: string
  isToday: boolean
}

export interface Cell {
  /** Stable while the cell's state stays the same, so a change can be seen. */
  key: string
  state: CellState
  /** For the tooltip and screen readers: "Taken 8:14 AM, scanned". */
  label: string
}

export interface Row {
  key: string
  /** "8:10 AM", or "When needed". */
  label: string
  cells: Cell[]
}

export interface MedicationRows {
  key: string
  /** "Capecitabine 500 mg". */
  name: string
  rows: Row[]
}

export interface Today {
  taken: number
  due: number
  missed: number
  later: number
  toldNotToTake: number
}

/** One line of "What happened". */
export interface Happening {
  key: string
  /** When, in milliseconds, for ordering. */
  at: number
  /** "2:41 PM" today, "Tue 7:15 PM" before. */
  when: string
  tone: Tone
  title: string
  detail?: string
}

export interface PatientCard {
  id: string
  /** As typed, with " (2)" and so on after a name someone else joined with first. */
  name: string
  joinedAt: string
  updatedAt: string
  /** Nothing sent yet: the phone joined but hasn't sent its first snapshot. */
  waiting: boolean
  columns: Column[]
  medications: MedicationRows[]
  /** Null when the phone sent nothing about today (it was last used yesterday). */
  today: Today | null
  happenings: Happening[]
}

const minute = 60 * 1000

/** Every patient's card, the latest update first. */
export function patientCards(patients: Patient[], now: Date): PatientCard[] {
  const names = displayNames(patients)
  return patients
    .map((patient) => patientCard(patient, names.get(patient.id) ?? patient.name, now))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

/** "Maria", "Maria (2)": numbered in the order they joined, ignoring case and spaces. */
export function displayNames(patients: Patient[]): Map<string, string> {
  const seen = new Map<string, number>()
  const names = new Map<string, string>()
  const byJoining = [...patients].sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt))
  for (const patient of byJoining) {
    const same = patient.name.trim().toLocaleLowerCase()
    const count = (seen.get(same) ?? 0) + 1
    seen.set(same, count)
    names.set(patient.id, count === 1 ? patient.name : `${patient.name} (${count})`)
  }
  return names
}

export function patientCard(patient: Patient, name: string, now: Date): PatientCard {
  const base = { id: patient.id, name, joinedAt: patient.joinedAt, updatedAt: patient.updatedAt }
  const snapshot = patient.snapshot
  if (!snapshot) return { ...base, waiting: true, columns: [], medications: [], today: null, happenings: [] }

  const clock = new Clock(snapshot, now)
  const columns = snapshot.days.map((day) => ({
    day,
    label: day === clock.today ? "Today" : weekday(day),
    isToday: day === clock.today,
  }))
  return {
    ...base,
    waiting: false,
    columns,
    medications: medicationRows(snapshot, clock),
    today: snapshot.days.includes(clock.today) ? today(snapshot, clock) : null,
    happenings: happenings(snapshot, clock),
  }
}

// MARK: The week grid

function medicationRows(snapshot: Snapshot, clock: Clock): MedicationRows[] {
  return snapshot.medications.map((medication) => {
    const name = displayName(medication)
    if (medication.asNeeded) {
      const cells = snapshot.days.map((day): Cell => {
        const taken = snapshot.asNeeded.find((entry) => entry.day === day && entry.medicationId === medication.id)
        const state: CellState = taken ? "taken" : "none"
        const label = taken ? `Taken ${clock.time(taken.takenAt)}, ${how(taken.scanned)}` : "Not taken"
        return { key: `${medication.id}|needed|${day}|${state}`, state, label }
      })
      return { key: medication.id, name, rows: [{ key: `${medication.id}|needed`, label: "When needed", cells }] }
    }
    const rows = [...medication.times].sort().map((time): Row => {
      const cells = snapshot.days.map((day): Cell => {
        const dose = snapshot.doses.find(
          (entry) => entry.day === day && entry.medicationId === medication.id && entry.time === time,
        )
        if (!dose) return { key: `${medication.id}|${time}|${day}|none`, state: "none", label: "Not scheduled" }
        const state = clock.state(dose)
        return { key: `${medication.id}|${time}|${day}|${state}`, state, label: clock.describe(dose, state) }
      })
      return { key: `${medication.id}|${time}`, label: timeOfDay(time), cells }
    })
    return { key: medication.id, name, rows }
  })
}

function today(snapshot: Snapshot, clock: Clock): Today {
  const counts: Today = { taken: 0, due: 0, missed: 0, later: 0, toldNotToTake: 0 }
  for (const dose of snapshot.doses) {
    if (dose.day !== clock.today) continue
    const state = clock.state(dose)
    if (state !== "none") counts[state] += 1
  }
  for (const scan of snapshot.scans) {
    if (clock.dayOf(scan.at) !== clock.today) continue
    counts.toldNotToTake += scan.pills.filter((pill) => toldNotToTake.has(pill.outcome)).length
  }
  return counts
}

// MARK: What happened

/** What the app said not to take: everything but OK, when needed, and unknown pills. */
const toldNotToTake = new Set<Outcome>(["alreadyTaken", "missed", "tooEarly", "notScheduledToday", "extra"])

function happenings(snapshot: Snapshot, clock: Clock): Happening[] {
  const names = new Map(snapshot.medications.map((medication) => [medication.id, displayName(medication)]))
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? id) : "a pill")
  const list: Happening[] = []

  for (const dose of snapshot.doses) {
    const state = clock.state(dose)
    if (state === "taken" && dose.takenAt && dose.day === clock.today) {
      list.push(clock.happening(`taken|${dose.day}|${dose.medicationId}|${dose.time}`, dose.takenAt, {
        tone: "ok",
        title: `Took ${nameOf(dose.medicationId)}`,
        detail: `${timeOfDay(dose.time)} dose · ${how(dose.scanned)}`,
      }))
    } else if (state === "missed") {
      list.push(clock.happening(`missed|${dose.day}|${dose.medicationId}|${dose.time}`, clock.missedAt(dose), {
        tone: "danger",
        title: `Missed ${nameOf(dose.medicationId)}`,
        detail: `${timeOfDay(dose.time)} dose`,
      }))
    }
  }

  for (const entry of snapshot.asNeeded) {
    list.push(clock.happening(`needed|${entry.day}|${entry.medicationId}`, entry.takenAt, {
      tone: "ok",
      title: `Took ${nameOf(entry.medicationId)}`,
      detail: `when needed · ${how(entry.scanned)}`,
    }))
  }

  for (const scan of snapshot.scans) {
    scan.pills.forEach((pill, index) => {
      const key = `scan|${scan.at}|${index}`
      if (pill.outcome === "unknown") {
        list.push(clock.happening(key, scan.at, { tone: "caution", title: "Scanned a pill that isn't on the list" }))
      } else if (toldNotToTake.has(pill.outcome)) {
        list.push(clock.happening(key, scan.at, {
          tone: "caution",
          title: `Told not to take ${nameOf(pill.medicationId)}`,
          detail: reason(pill, snapshot, clock),
        }))
      }
    })
  }

  return list.sort((a, b) => b.at - a.at)
}

function reason(pill: Snapshot["scans"][number]["pills"][number], snapshot: Snapshot, clock: Clock): string {
  switch (pill.outcome) {
    case "alreadyTaken":
      return pill.takenAt ? `already taken at ${clock.time(pill.takenAt)}` : "already taken"
    case "missed": {
      const hours = snapshot.lateWindowMinutes / 60
      const late = `more than ${hours} hour${hours === 1 ? "" : "s"} late`
      return pill.doseTime ? `the ${timeOfDay(pill.doseTime)} dose was ${late}` : `the dose was ${late}`
    }
    case "tooEarly":
      return pill.doseTime ? `too early: the next dose is at ${timeOfDay(pill.doseTime)}` : "too early"
    case "notScheduledToday":
      return "not scheduled today"
    case "extra":
      return "a second tablet in the same photo"
    default:
      return ""
  }
}

// MARK: Time

/** Times as the phone sees them: in its time zone, against the dashboard's now. */
class Clock {
  readonly today: string
  private readonly zone: string
  private readonly now: number
  private readonly early: number
  private readonly late: number
  private readonly clockFormat: Intl.DateTimeFormat
  private readonly dayFormat: Intl.DateTimeFormat

  constructor(snapshot: Snapshot, now: Date) {
    this.zone = isTimeZone(snapshot.timeZone) ? snapshot.timeZone : "UTC"
    this.now = now.getTime()
    this.early = snapshot.earlyWindowMinutes * minute
    this.late = snapshot.lateWindowMinutes * minute
    this.clockFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: this.zone })
    // en-CA writes dates as 2026-11-19, the days' format.
    this.dayFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: this.zone })
    this.today = this.dayFormat.format(now)
  }

  /** "2:41 PM". */
  time(instant: string | number): string {
    return this.clockFormat.format(new Date(instant))
  }

  /** "2026-11-19". */
  dayOf(instant: string | number): string {
    return this.dayFormat.format(new Date(instant))
  }

  state(dose: Snapshot["doses"][number]): CellState {
    if (dose.takenAt) return "taken"
    const scheduled = Date.parse(dose.scheduledAt)
    if (this.now > scheduled + this.late) return "missed"
    if (this.now >= scheduled - this.early) return "due"
    return "later"
  }

  /** When a dose not taken became missed: its window's end. */
  missedAt(dose: Snapshot["doses"][number]): number {
    return Date.parse(dose.scheduledAt) + this.late
  }

  describe(dose: Snapshot["doses"][number], state: CellState): string {
    switch (state) {
      case "taken":
        return `Taken ${this.time(dose.takenAt ?? dose.scheduledAt)}, ${how(dose.scanned)}`
      case "missed":
        return `Not taken by ${this.time(this.missedAt(dose))}`
      case "due":
        return `Due now, until ${this.time(this.missedAt(dose))}`
      case "later":
        return `Due ${timeOfDay(dose.time)}`
      case "none":
        return "Not scheduled"
    }
  }

  happening(key: string, instant: string | number, content: Pick<Happening, "tone" | "title" | "detail">): Happening {
    const at = typeof instant === "number" ? instant : Date.parse(instant)
    const day = this.dayOf(at)
    const when = day === this.today ? this.time(at) : `${weekday(day)} ${this.time(at)}`
    return { key, at, when, ...content }
  }
}

/** "Fri" for "2026-11-13", whatever the time zone: the day is already the phone's. */
export function weekday(day: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))
}

/** "2:10 PM" for "14:10". */
export function timeOfDay(time: string): string {
  const [hours = 0, minutes = 0] = time.split(":").map(Number)
  const suffix = hours < 12 ? "AM" : "PM"
  const twelve = hours % 12 === 0 ? 12 : hours % 12
  return `${twelve}:${String(minutes).padStart(2, "0")} ${suffix}`
}

function displayName(medication: Snapshot["medications"][number]): string {
  return [medication.name, medication.strength].filter(Boolean).join(" ")
}

function how(scanned: boolean): string {
  return scanned ? "scanned" : "ticked"
}
