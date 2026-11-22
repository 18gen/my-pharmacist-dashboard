import type { Patient } from "@/lib/patients"
import { isTimeZone, type Outcome, type Snapshot } from "@/lib/snapshot"

/**
 * The dashboard's one table, worked out from what the phones sent and the time now: the
 * last 7 days across, and for each person a row per dose time, then the medications
 * taken only when needed, then any pill the app didn't know. Pure, so every state and
 * every word can be tested. Facts only: no rules a pharmacist would have to set.
 */

/** A person as the list sends them: with the token that loads their scanned pictures. */
export interface SharedPatient extends Patient {
  photoToken: string
}

/** How people are ordered: latest update first, first to join first, or by name. */
export type Order = "updated" | "joined" | "name"

export const orders: readonly Order[] = ["updated", "joined", "name"]

/**
 * - scanned: taken, by a scan (its picture, when the phone sent one);
 * - ticked: taken, ticked by hand;
 * - missed, due, later: not taken, and where its time stands;
 * - noRecord: before the phone has any record, or a day it didn't send;
 * - empty: nothing scheduled, or a when-needed tablet not taken;
 * - unknown: a pill not on the list was scanned.
 */
export type CellState = "scanned" | "ticked" | "missed" | "due" | "later" | "noRecord" | "empty" | "unknown"

export interface Column {
  /** "2026-11-21". */
  day: string
  /** "Sat", or "Today". */
  weekday: string
  /** "21". */
  date: string
  isToday: boolean
  /** "Saturday, Nov 21", or "Today, Saturday, Nov 21". */
  long: string
}

export interface Cell {
  /** Changes whenever what the cell shows changes, so a change can glow. */
  key: string
  day: string
  state: CellState
  /** Under the box: when it was taken or scanned ("12:39 PM"), or "Now". */
  time: string | null
  /** The scanned pill's picture. */
  photoId: string | null
  /** The app said "Don't take now" about this dose that day. */
  warned: boolean
  /** What the cell says, for screen readers: "Scanned at 12:39 PM". */
  label: string
}

export interface Row {
  key: string
  kind: "dose" | "asNeeded" | "unknown"
  /** Null for the row of pills that weren't on the list. */
  medicationId: string | null
  /** "Capecitabine", or "Unknown pill". */
  name: string
  /** "500 mg". */
  strength: string
  /** "12:35 PM", "When needed", or "Not on the list". */
  when: string
  cells: Cell[]
}

export interface PersonBoard {
  id: string
  /** As typed, with " (2)" and so on after a name someone else joined with first. */
  name: string
  joinedAt: string
  updatedAt: string
  photoToken: string
  /** The phone joined but hasn't sent anything yet. */
  waiting: boolean
  rows: Row[]
}

export interface Board {
  columns: Column[]
  people: PersonBoard[]
}

/** One line of what happened on a day. */
export interface DayEvent {
  key: string
  /** When, in milliseconds, for ordering. */
  at: number
  /** "12:39 PM". */
  time: string
  tone: "scanned" | "ticked" | "dont" | "unknown" | "asNeeded" | "missed"
  text: string
}

/** What the app said not to take: everything but OK, when needed, and unknown pills. */
const toldNotToTake = new Set<Outcome>(["alreadyTaken", "missed", "tooEarly", "notScheduledToday", "extra"])

const minute = 60 * 1000
const dayLength = 24 * 60 * minute

// MARK: The table

/**
 * Everyone, in `order`, against the 7 days that end today where the dashboard is
 * (`zone`, this computer's time zone unless given).
 */
export function buildBoard(patients: SharedPatient[], now: Date, order: Order, zone = localZone()): Board {
  const columns = boardColumns(now, zone)
  const names = displayNames(patients)
  const people = patients.map((patient) => personBoard(patient, names.get(patient.id) ?? patient.name, columns, now))
  return { columns, people: orderPeople(people, order) }
}

/** The 7 days ending today in `zone`, oldest first. */
export function boardColumns(now: Date, zone = localZone()): Column[] {
  const today = dayIn(now, zone)
  return [6, 5, 4, 3, 2, 1, 0].map((back) => {
    const day = addDays(today, -back)
    const isToday = back === 0
    const long = longDay(day)
    return {
      day,
      weekday: isToday ? "Today" : weekday(day),
      date: String(Number(day.slice(8))),
      isToday,
      long: isToday ? `Today, ${long}` : long,
    }
  })
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

/**
 * - updated: the latest update first, so the phone on stage stays on top; people whose
 *   phone hasn't sent anything yet come last;
 * - joined: the first to join first;
 * - name: A to Z.
 */
export function orderPeople(people: PersonBoard[], order: Order): PersonBoard[] {
  const joined = (person: PersonBoard) => Date.parse(person.joinedAt)
  return [...people].sort((a, b) => {
    switch (order) {
      case "updated":
        if (a.waiting !== b.waiting) return a.waiting ? 1 : -1
        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || joined(a) - joined(b)
      case "joined":
        return joined(a) - joined(b)
      case "name":
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || joined(a) - joined(b)
    }
  })
}

export function personBoard(patient: SharedPatient, name: string, columns: Column[], now: Date): PersonBoard {
  const base = {
    id: patient.id,
    name,
    joinedAt: patient.joinedAt,
    updatedAt: patient.updatedAt,
    photoToken: patient.photoToken,
  }
  const snapshot = patient.snapshot
  if (!snapshot) return { ...base, waiting: true, rows: [] }
  return { ...base, waiting: false, rows: rows(snapshot, columns, new Clock(snapshot, now)) }
}

function rows(snapshot: Snapshot, columns: Column[], clock: Clock): Row[] {
  const warned = warnings(snapshot, clock)
  /** Not sent, or before the phone's first record: nothing is known. */
  const unknown = (day: string) => !snapshot.days.includes(day) || (snapshot.recordsSince !== undefined && day < snapshot.recordsSince)

  const doseRows = snapshot.medications
    .filter((medication) => !medication.asNeeded)
    .flatMap((medication) => medication.times.map((time) => ({ medication, time })))
    .sort((a, b) => a.time.localeCompare(b.time) || a.medication.name.localeCompare(b.medication.name))
    .map(({ medication, time }): Row => {
      const key = `${medication.id}|${time}`
      const cells = columns.map(({ day }): Cell => {
        const dose = snapshot.doses.find(
          (entry) => entry.day === day && entry.medicationId === medication.id && entry.time === time,
        )
        const isWarned = warned.has(`${day}|${medication.id}|${time}`)
        if (dose?.takenAt) {
          const at = clock.time(dose.takenAt)
          return cell(key, day, dose.scanned ? "scanned" : "ticked", at, dose.photoId ?? null, isWarned)
        }
        if (unknown(day)) return cell(key, day, "noRecord", null, null, false)
        if (!dose) return cell(key, day, "empty", null, null, isWarned)
        const state = clock.state(dose)
        return cell(key, day, state, state === "due" ? "Now" : null, null, isWarned)
      })
      return { key, kind: "dose", medicationId: medication.id, name: medication.name, strength: medication.strength, when: timeOfDay(time), cells }
    })

  const asNeededRows = snapshot.medications
    .filter((medication) => medication.asNeeded)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((medication): Row => {
      const key = `${medication.id}|needed`
      const cells = columns.map(({ day }): Cell => {
        const taken = snapshot.asNeeded.find((entry) => entry.day === day && entry.medicationId === medication.id)
        if (taken) {
          return cell(key, day, taken.scanned ? "scanned" : "ticked", clock.time(taken.takenAt), taken.photoId ?? null, false)
        }
        return cell(key, day, unknown(day) ? "noRecord" : "empty", null, null, false)
      })
      return { key, kind: "asNeeded", medicationId: medication.id, name: medication.name, strength: medication.strength, when: "When needed", cells }
    })

  const strangers = snapshot.scans
    .flatMap((scan) => scan.pills.filter((pill) => pill.outcome === "unknown").map((pill) => ({ scan, pill })))
    .filter(({ scan }) => columns.some((column) => column.day === clock.dayOf(scan.at)))
  const unknownRows: Row[] = []
  if (strangers.length > 0) {
    const key = "unknown"
    const cells = columns.map(({ day }): Cell => {
      const that = strangers.filter(({ scan }) => clock.dayOf(scan.at) === day).sort((a, b) => Date.parse(a.scan.at) - Date.parse(b.scan.at))
      const latest = that.at(-1)
      if (latest) {
        const label = that.length === 1 ? undefined : `${that.length} pills not on the list, the last scanned at ${clock.time(latest.scan.at)}`
        return cell(key, day, "unknown", clock.time(latest.scan.at), latest.pill.photoId ?? null, false, label)
      }
      return cell(key, day, unknown(day) ? "noRecord" : "empty", null, null, false)
    })
    unknownRows.push({ key, kind: "unknown", medicationId: null, name: "Unknown pill", strength: "", when: "Not on the list", cells })
  }

  return [...doseRows, ...asNeededRows, ...unknownRows]
}

function cell(
  rowKey: string,
  day: string,
  state: CellState,
  time: string | null,
  photoId: string | null,
  warned: boolean,
  label?: string,
): Cell {
  const words: Record<CellState, string> = {
    scanned: `Scanned at ${time}`,
    ticked: `Ticked by hand at ${time}`,
    missed: "Not taken",
    due: "Due now",
    later: "Later today",
    noRecord: "No record yet",
    empty: "Nothing",
    unknown: `A pill not on the list, scanned at ${time}`,
  }
  const said = (label ?? words[state]) + (warned ? `, and the app said “Don’t take now”` : "")
  return {
    key: [rowKey, day, state, time ?? "", photoId ?? "", warned ? "warned" : ""].join("|"),
    day,
    state,
    time,
    photoId: photoId?.toLowerCase() ?? null,
    warned,
    label: said,
  }
}

/**
 * The doses the app said "Don't take now" about, as "day|medication|time": the dose the
 * pill was judged against.
 * - already taken: the dose taken at that time;
 * - missed, too early: the dose at the time the app gave;
 * - not for today, one tablet per dose: that medication's time nearest the scan.
 */
function warnings(snapshot: Snapshot, clock: Clock): Set<string> {
  const warned = new Set<string>()
  const timesOf = (id: string) => snapshot.medications.find((medication) => medication.id === id)?.times ?? []
  for (const scan of snapshot.scans) {
    const day = clock.dayOf(scan.at)
    for (const pill of scan.pills) {
      if (!pill.medicationId || !toldNotToTake.has(pill.outcome)) continue
      const id = pill.medicationId
      if (pill.outcome === "alreadyTaken" && pill.takenAt) {
        const takenAt = Date.parse(pill.takenAt)
        const dose = snapshot.doses.find(
          (entry) => entry.medicationId === id && entry.takenAt && Math.abs(Date.parse(entry.takenAt) - takenAt) < minute,
        )
        if (dose) {
          warned.add(`${dose.day}|${id}|${dose.time}`)
          continue
        }
      }
      if ((pill.outcome === "missed" || pill.outcome === "tooEarly") && pill.doseTime && timesOf(id).includes(pill.doseTime)) {
        warned.add(`${day}|${id}|${pill.doseTime}`)
        continue
      }
      const nearest = nearestTime(timesOf(id), clock.clockTime(scan.at))
      if (nearest) warned.add(`${day}|${id}|${nearest}`)
    }
  }
  return warned
}

/** Of `times` ("08:10"), the one nearest `time`. */
function nearestTime(times: string[], time: string): string | null {
  const minutes = (value: string) => {
    const [hours = 0, mins = 0] = value.split(":").map(Number)
    return hours * 60 + mins
  }
  let best: string | null = null
  for (const candidate of times) {
    if (best === null || Math.abs(minutes(candidate) - minutes(time)) < Math.abs(minutes(best) - minutes(time))) {
      best = candidate
    }
  }
  return best
}

// MARK: What happened on a day

/** What happened on `day` for this person, in the order it happened. */
export function dayEvents(patient: Patient, day: string, now: Date): DayEvent[] {
  const snapshot = patient.snapshot
  if (!snapshot) return []
  const clock = new Clock(snapshot, now)
  const nameOf = (id: string | null) =>
    (id && snapshot.medications.find((medication) => medication.id === id)?.name) || "a pill"
  const order = (id: string) => snapshot.medications.findIndex((medication) => medication.id === id)
  const events: DayEvent[] = []

  // Doses taken: one line for those taken in the same minute the same way.
  const taken = new Map<string, Snapshot["doses"]>()
  for (const dose of snapshot.doses) {
    if (dose.day !== day || !dose.takenAt) continue
    const at = Math.floor(Date.parse(dose.takenAt) / minute)
    const group = `${at}|${dose.scanned}`
    taken.set(group, [...(taken.get(group) ?? []), dose])
  }
  for (const [group, doses] of taken) {
    const first = doses[0]
    if (!first?.takenAt) continue
    const names = sameOrder(doses.map((dose) => dose.medicationId), order).map(nameOf)
    events.push(event(`taken|${group}`, first.takenAt, clock, first.scanned ? "scanned" : "ticked",
      first.scanned ? `Took ${list(names)}, scanned` : `Ticked ${list(names)} by hand`))
  }

  for (const entry of snapshot.asNeeded) {
    if (entry.day !== day) continue
    events.push(event(`needed|${entry.medicationId}`, entry.takenAt, clock, "asNeeded", `Took ${nameOf(entry.medicationId)}, when needed`))
  }

  for (const scan of snapshot.scans) {
    if (clock.dayOf(scan.at) !== day) continue
    scan.pills.forEach((pill, index) => {
      const key = `scan|${scan.at}|${index}`
      if (pill.outcome === "unknown") {
        events.push(event(key, scan.at, clock, "unknown", "Unknown – don’t take: a pill not on the list"))
      } else if (toldNotToTake.has(pill.outcome)) {
        events.push(event(key, scan.at, clock, "dont", `Don’t take now: ${nameOf(pill.medicationId)}, ${reason(pill, clock)}`))
      }
    })
  }

  // Doses not taken: one line per dose time, at that time.
  const recordsSince = snapshot.recordsSince
  const missed = new Map<string, Snapshot["doses"]>()
  if (recordsSince === undefined || day >= recordsSince) {
    for (const dose of snapshot.doses) {
      if (dose.day !== day || dose.takenAt || clock.state(dose) !== "missed") continue
      missed.set(dose.time, [...(missed.get(dose.time) ?? []), dose])
    }
  }
  for (const [time, doses] of missed) {
    const first = doses[0]
    if (!first) continue
    const names = sameOrder(doses.map((dose) => dose.medicationId), order).map(nameOf)
    events.push(event(`missed|${time}`, first.scheduledAt, clock, "missed", `Not taken: ${list(names)}`))
  }

  return events.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key))
}

/** What the day panel says when nothing happened on `day`. */
export function quietDay(patient: Patient, day: string): string {
  const snapshot = patient.snapshot
  if (!snapshot) return "Waiting for the phone’s first update."
  const since = snapshot.recordsSince
  if (since !== undefined && day < since) return `No record yet: this phone’s records start ${longDay(since)}.`
  if (!snapshot.days.includes(day)) return "No record: the phone hasn’t sent this day."
  return "Nothing happened this day."
}

function event(key: string, instant: string, clock: Clock, tone: DayEvent["tone"], text: string): DayEvent {
  return { key, at: Date.parse(instant), time: clock.time(instant), tone, text }
}

/** What the app said, as it said it (its PillVerdict's reasons). */
function reason(pill: Snapshot["scans"][number]["pills"][number], clock: Clock): string {
  switch (pill.outcome) {
    case "alreadyTaken":
      return pill.takenAt ? `already taken at ${clock.time(pill.takenAt)}` : "already taken"
    case "tooEarly":
      return pill.doseTime ? `too early. Next dose at ${timeOfDay(pill.doseTime)}.` : "too early"
    case "missed":
      return pill.doseTime ? `too late for the ${timeOfDay(pill.doseTime)} dose` : "too late for this dose"
    case "notScheduledToday":
      return "not for today"
    case "extra":
      return "one tablet per dose"
    default:
      return ""
  }
}

/** The medications in the phone's order, each once. */
function sameOrder(ids: string[], order: (id: string) => number): string[] {
  return [...new Set(ids)].sort((a, b) => order(a) - order(b))
}

/** "A", "A and B", "A, B and C". */
function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

// MARK: Time

/** Times as the phone sees them: in its time zone, against the dashboard's now. */
class Clock {
  private readonly now: number
  private readonly early: number
  private readonly late: number
  private readonly clockFormat: Intl.DateTimeFormat
  private readonly twentyFour: Intl.DateTimeFormat
  private readonly zone: string

  constructor(snapshot: Snapshot, now: Date) {
    this.zone = isTimeZone(snapshot.timeZone) ? snapshot.timeZone : "UTC"
    this.now = now.getTime()
    this.early = snapshot.earlyWindowMinutes * minute
    this.late = snapshot.lateWindowMinutes * minute
    this.clockFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: this.zone })
    this.twentyFour = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: this.zone })
  }

  /** "2:41 PM". */
  time(instant: string | number): string {
    return this.clockFormat.format(new Date(instant))
  }

  /** "14:41". */
  clockTime(instant: string | number): string {
    return this.twentyFour.format(new Date(instant))
  }

  /** "2026-11-19". */
  dayOf(instant: string | number): string {
    return dayIn(new Date(instant), this.zone)
  }

  state(dose: Snapshot["doses"][number]): "missed" | "due" | "later" {
    const scheduled = Date.parse(dose.scheduledAt)
    if (this.now > scheduled + this.late) return "missed"
    if (this.now >= scheduled - this.early) return "due"
    return "later"
  }
}

/** This computer's time zone. */
function localZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** "2026-11-19" for `date` in `zone` (en-CA writes dates that way). */
function dayIn(date: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zone }).format(date)
}

/** The day `count` days after `day`, counted on the calendar, not in hours. */
function addDays(day: string, count: number): string {
  const noon = Date.parse(`${day}T12:00:00Z`) + count * dayLength
  return new Date(noon).toISOString().slice(0, 10)
}

/** "Fri" for "2026-11-13", whatever the time zone: the day is already the phone's. */
export function weekday(day: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))
}

/** "Friday, Nov 13". */
function longDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T12:00:00Z`),
  )
}

/** "2:10 PM" for "14:10". */
export function timeOfDay(time: string): string {
  const [hours = 0, minutes = 0] = time.split(":").map(Number)
  const suffix = hours < 12 ? "AM" : "PM"
  const twelve = hours % 12 === 0 ? 12 : hours % 12
  return `${twelve}:${String(minutes).padStart(2, "0")} ${suffix}`
}
