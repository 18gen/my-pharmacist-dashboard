import type { Snapshot } from "@/lib/snapshot"

/**
 * Builds a week of made-up doses and scans as a phone would send them, around `now` in this
 * computer's time zone: for the sample people seeded into a local dashboard
 * (scripts/sample-people.ts) and the sample patients the dashboard can show
 * (src/lib/sample-patients.ts).
 */

export type Medication = Snapshot["medications"][number]
type Scan = Snapshot["scans"][number]

/**
 * How a dose was taken: minutes after its time, whether by a scan, and the scan's picture
 * (a fixture's name); null if it wasn't.
 */
export type Taken = { after: number; scanned: boolean; photo?: string } | null

/** A scan waiting for its picture's ID, which `buildSnapshot` gives it. */
export type PlannedScan = Scan & { photo?: string }

export interface SamplePhoto {
  photoId: string
  /** "exemestane-25-scan": scripts/fixtures/exemestane-25-scan.jpg. */
  fixture: string
}

export const minute = 60 * 1000
export const hour = 60 * minute
/** Minutes after its time each dose was taken, cycled through so the week looks real. */
export const delays = [3, 11, 6, 18, 9, 4, 22, 7]

export function medication(id: string, name: string, strength: string, times: string[], asNeeded = false): Medication {
  return { id, name, strength, times, asNeeded }
}

export function scan(
  at: Date,
  medicationId: string | null,
  outcome: Scan["pills"][number]["outcome"],
  extra: { takenAt?: Date; doseTime?: string; photo?: string } = {},
): PlannedScan {
  const pill: Scan["pills"][number] = { medicationId, outcome }
  if (extra.takenAt) pill.takenAt = extra.takenAt.toISOString()
  if (extra.doseTime) pill.doseTime = extra.doseTime
  return { at: at.toISOString(), pills: [pill], photo: extra.photo }
}

/**
 * The last 7 days, today last, with every scheduled dose. Nothing after `now` is
 * included: a dose taken "later" today, an as-needed tablet or a scan still to come.
 * Each scan with a picture gets an ID, and the picture is listed to be sent first.
 */
export function buildSnapshot(
  now: Date,
  medications: Medication[],
  plan: {
    taken: (day: number, medicationID: string, time: string, index: number) => Taken
    asNeeded?: { day: number; medicationId: string; time: string; scanned: boolean }[]
    scans?: (dayAt: (day: number, time: string) => Date) => PlannedScan[]
    /** The first day with a record, counted from today: the week before by default. */
    since?: number
  },
): { snapshot: Snapshot; photos: SamplePhoto[] } {
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
  const photos: SamplePhoto[] = []
  const photoFor = (fixture: string | undefined) => {
    if (!fixture) return undefined
    const photoId = crypto.randomUUID()
    photos.push({ photoId, fixture })
    return photoId
  }

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
          const photoId = taken.scanned ? photoFor(taken.photo) : undefined
          if (photoId) dose.photoId = photoId
        }
        doses.push(dose)
      }
    }
  }

  const asNeeded = (plan.asNeeded ?? [])
    .map((entry) => ({ entry, at: dayAt(entry.day, entry.time) }))
    .filter(({ at }) => past(at))
    .map(({ entry, at }) => ({ day: dayKey(at), medicationId: entry.medicationId, takenAt: at.toISOString(), scanned: entry.scanned }))

  const scans = (plan.scans?.(dayAt) ?? [])
    .filter((entry) => Date.parse(entry.at) <= now.getTime())
    .map(({ photo, ...entry }): Scan => {
      const photoId = photoFor(photo)
      return photoId ? { ...entry, pills: entry.pills.map((pill) => ({ ...pill, photoId })) } : entry
    })

  return {
    snapshot: {
      v: 1,
      sentAt: now.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      earlyWindowMinutes: 60,
      lateWindowMinutes: 120,
      days: days.map((day) => dayKey(dayAt(day, "12:00"))),
      recordsSince: dayKey(dayAt(plan.since ?? -6, "12:00")),
      medications,
      doses,
      asNeeded,
      scans,
    },
    photos,
  }
}

/** "2026-11-19", in this computer's time zone. */
function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "14:10". */
export function clock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}
