import { z } from "zod"

/**
 * What a phone sends, whole, every time something changes (version 1): its medications
 * and the last 7 days of doses and scans. The app works out each dose's exact time
 * (`scheduledAt`) with its own calendar, so nothing here needs time-zone maths, and the
 * windows say when a dose counts as due and when as missed (the app's DoseSchedule).
 */

export const limits = {
  nameLength: 40,
  /** The app's CheckLimits.medications. */
  medications: 20,
  timesPerMedication: 12,
  days: 7,
  doses: 7 * 20 * 12,
  scans: 200,
  pillsPerScan: 12,
  text: 300,
  /** The largest snapshot accepted, in bytes. */
  snapshotBytes: 256 * 1024,
  /** The most people sharing at once. */
  patients: 200,
} as const

/** What the app said about a pill: its PillVerdict, "unidentified" as "unknown". */
export const outcomes = [
  "take",
  "alreadyTaken",
  "missed",
  "tooEarly",
  "notScheduledToday",
  "extra",
  "unknown",
  "asNeeded",
] as const

/** Whether `name` is a time zone this runtime knows, so times can be shown in it. */
export function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name })
    return true
  } catch {
    return false
  }
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a day like 2026-11-19")
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a time like 08:30")
const instant = z.iso.datetime()
const id = z.string().min(1).max(100)
const text = z.string().max(limits.text)
/** A scanned pill's picture, sent on its own (PUT /api/patients/:id/photos/:photoId). */
const photoId = z.uuid()

export const snapshotSchema = z.object({
  v: z.literal(1),
  sentAt: instant,
  /** The phone's time zone, like "America/Toronto", for showing times as it does. */
  timeZone: z.string().min(1).max(64).refine(isTimeZone, "Expected a time zone like America/Toronto"),
  earlyWindowMinutes: z.int().min(0).max(24 * 60),
  lateWindowMinutes: z.int().min(0).max(24 * 60),
  /** The days covered, oldest first; the last is the phone's today. */
  days: z.array(day).min(1).max(limits.days),
  /**
   * The first day the phone has any record of: before it, nothing is known (the app was
   * new, or reset), so those days aren't "not taken". Absent from older phones.
   */
  recordsSince: day.optional(),
  medications: z
    .array(
      z.object({
        id,
        name: text.min(1),
        strength: text,
        /** Times of day, "08:30"; none for a medication taken only when needed. */
        times: z.array(timeOfDay).max(limits.timesPerMedication),
        asNeeded: z.boolean(),
      }),
    )
    .max(limits.medications),
  doses: z
    .array(
      z.object({
        day,
        medicationId: id,
        time: timeOfDay,
        scheduledAt: instant,
        /** When it was marked taken; absent while it isn't. */
        takenAt: instant.optional(),
        /** Taken by a scan rather than ticked by hand. */
        scanned: z.boolean(),
        /** The pill as that scan saw it, once the phone has sent the picture. */
        photoId: photoId.optional(),
      }),
    )
    .max(limits.doses),
  /** Medications taken only when needed, on the days they were taken. */
  asNeeded: z
    .array(z.object({ day, medicationId: id, takenAt: instant, scanned: z.boolean(), photoId: photoId.optional() }))
    .max(limits.days * limits.medications),
  /** What each scan said about each pill: one entry per scanning session. */
  scans: z
    .array(
      z.object({
        at: instant,
        pills: z
          .array(
            z.object({
              medicationId: id.nullable(),
              outcome: z.enum(outcomes),
              /** For "alreadyTaken": when the dose was taken. */
              takenAt: instant.optional(),
              /** For "missed" and "tooEarly": the dose's time of day; for "take", the dose it ticked. */
              doseTime: timeOfDay.optional(),
              /** The pill's picture, once the phone has sent it. */
              photoId: photoId.optional(),
            }),
          )
          .min(1)
          .max(limits.pillsPerScan),
      }),
    )
    .max(limits.scans),
})

export type Snapshot = z.infer<typeof snapshotSchema>
export type Outcome = (typeof outcomes)[number]

/** What a phone sends to start sharing: the name the pharmacy sees. */
export const joinSchema = z.object({
  name: z.string().trim().min(1, "Type a name").max(limits.nameLength),
})
