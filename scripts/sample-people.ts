import type { Snapshot } from "@/lib/snapshot"

/**
 * Made-up people for trying the dashboard without phones, built around `now` in this
 * computer's time zone, as their phones would send them:
 * - Maria: the app's sample week (the iOS "Reset demo → With a sample week"), a dose due now;
 * - Ken: every dose taken;
 * - Aiko: this morning's doses missed, and a pill the app didn't know;
 * - a second Maria who joined but whose phone hasn't sent anything yet.
 */
export interface SamplePerson {
  name: string
  snapshot: Snapshot | null
}

type Medication = Snapshot["medications"][number]
type Scan = Snapshot["scans"][number]
/** How a dose was taken: minutes after its time, and whether by a scan; null if it wasn't. */
type Taken = { after: number; scanned: boolean } | null

const minute = 60 * 1000
const hour = 60 * minute
/** Minutes after its time each dose was taken, cycled through so the week looks real. */
const delays = [3, 11, 6, 18, 9, 4, 22, 7]

export function samplePeople(now: Date): SamplePerson[] {
  return [
    { name: "Ken", snapshot: ken(now) },
    { name: "Aiko", snapshot: aiko(now) },
    { name: "Maria", snapshot: maria(now) },
    { name: "Maria", snapshot: null },
  ]
}

/**
 * The sample week. With N the time rounded down to 5 minutes: from noon, capecitabine
 * with dexamethasone at N − 6 h (taken today) and capecitabine with allopurinol at N (due
 * now); before noon, the first pair at N (due now) and the second at N + 6 h.
 */
export function maria(now: Date): Snapshot {
  const due = new Date(Math.floor(now.getTime() / (5 * minute)) * 5 * minute)
  const fromNoon = due.getHours() >= 12
  const first = clock(fromNoon ? new Date(due.getTime() - 6 * hour) : due)
  const second = clock(fromNoon ? due : new Date(due.getTime() + 6 * hour))
  const medications: Medication[] = [
    medication("capecitabine-500", "Capecitabine", "500 mg", [first, second]),
    medication("dexamethasone-4", "Dexamethasone", "4 mg", [first]),
    medication("allopurinol-300", "Allopurinol", "300 mg", [second]),
    medication("ondansetron-8", "Ondansetron", "8 mg", [], true),
  ]
  return snapshot(now, medications, {
    taken: (day, id, time, index) => {
      if (day === 0) return fromNoon && time === first ? { after: 4, scanned: true } : null
      if (day === -4 && time === second) return null
      if (day === -2 && id === "dexamethasone-4") return null
      return { after: delays[index % delays.length] ?? 5, scanned: !(day === -5 && time === first) }
    },
    asNeeded: [
      { day: -5, medicationId: "ondansetron-8", time: "14:30", scanned: true },
      { day: -1, medicationId: "ondansetron-8", time: "20:02", scanned: true },
    ],
    scans: (dayAt) => [
      scan(new Date(dayAt(-5, second).getTime() - 2 * hour), "allopurinol-300", "tooEarly", { doseTime: second }),
      scan(new Date(dayAt(-3, first).getTime() + 45 * minute), "capecitabine-500", "alreadyTaken", {
        takenAt: new Date(dayAt(-3, first).getTime() + 9 * minute),
      }),
      scan(new Date(dayAt(-1, second).getTime() + hour), null, "unknown"),
    ],
  })
}

function ken(now: Date): Snapshot {
  return snapshot(
    now,
    [
      medication("exemestane-25", "Exemestane", "25 mg", ["09:00"]),
      medication("metoclopramide-10", "Metoclopramide", "10 mg", ["09:00", "21:00"]),
    ],
    { taken: (_day, _id, _time, index) => ({ after: delays[index % delays.length] ?? 5, scanned: true }) },
  )
}

function aiko(now: Date): Snapshot {
  return snapshot(
    now,
    [
      medication("capecitabine-500", "Capecitabine", "500 mg", ["07:30", "19:30"]),
      medication("dexamethasone-1-5", "Dexamethasone", "1.5 mg", ["07:30"]),
    ],
    {
      taken: (day, id, time, index) => {
        if (day === 0 && time === "07:30") return null
        if (day === -3 && id === "capecitabine-500" && time === "19:30") return null
        return { after: delays[index % delays.length] ?? 5, scanned: index % 3 !== 0 }
      },
      scans: (dayAt) => [scan(new Date(dayAt(0, "10:05").getTime()), null, "unknown")],
    },
  )
}

// MARK: Building a snapshot

function medication(id: string, name: string, strength: string, times: string[], asNeeded = false): Medication {
  return { id, name, strength, times, asNeeded }
}

function scan(at: Date, medicationId: string | null, outcome: Scan["pills"][number]["outcome"], extra: { takenAt?: Date; doseTime?: string } = {}): Scan {
  const pill: Scan["pills"][number] = { medicationId, outcome }
  if (extra.takenAt) pill.takenAt = extra.takenAt.toISOString()
  if (extra.doseTime) pill.doseTime = extra.doseTime
  return { at: at.toISOString(), pills: [pill] }
}

/**
 * The last 7 days, today last, with every scheduled dose. Nothing after `now` is
 * included: a dose taken "later" today, an as-needed tablet or a scan still to come.
 */
function snapshot(
  now: Date,
  medications: Medication[],
  plan: {
    taken: (day: number, medicationID: string, time: string, index: number) => Taken
    asNeeded?: { day: number; medicationId: string; time: string; scanned: boolean }[]
    scans?: (dayAt: (day: number, time: string) => Date) => Scan[]
  },
): Snapshot {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const dayAt = (day: number, time: string) => {
    const [hours = 0, minutes = 0] = time.split(":").map(Number)
    const date = new Date(today)
    date.setDate(date.getDate() + day)
    date.setHours(hours, minutes, 0, 0)
    return date
  }
  const days = [-6, -5, -4, -3, -2, -1, 0]
  const past = (date: Date) => date.getTime() <= now.getTime()

  let index = 0
  const doses: Snapshot["doses"] = []
  for (const day of days) {
    for (const entry of medications) {
      for (const time of entry.times) {
        const scheduled = dayAt(day, time)
        const taken = plan.taken(day, entry.id, time, index++)
        const takenAt = taken ? new Date(scheduled.getTime() + taken.after * minute) : null
        const dose: Snapshot["doses"][number] = {
          day: dayKey(scheduled),
          medicationId: entry.id,
          time,
          scheduledAt: scheduled.toISOString(),
          scanned: false,
        }
        if (takenAt && taken && past(takenAt)) {
          dose.takenAt = takenAt.toISOString()
          dose.scanned = taken.scanned
        }
        doses.push(dose)
      }
    }
  }

  const asNeeded = (plan.asNeeded ?? [])
    .map((entry) => ({ entry, at: dayAt(entry.day, entry.time) }))
    .filter(({ at }) => past(at))
    .map(({ entry, at }) => ({ day: dayKey(at), medicationId: entry.medicationId, takenAt: at.toISOString(), scanned: entry.scanned }))

  return {
    v: 1,
    sentAt: now.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    earlyWindowMinutes: 60,
    lateWindowMinutes: 120,
    days: days.map((day) => dayKey(dayAt(day, "12:00"))),
    medications,
    doses,
    asNeeded,
    scans: (plan.scans?.(dayAt) ?? []).filter((entry) => Date.parse(entry.at) <= now.getTime()),
  }
}

/** "2026-11-19", in this computer's time zone. */
function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "14:10". */
function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}
