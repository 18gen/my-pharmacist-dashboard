import type { Snapshot } from "@/lib/snapshot"

/**
 * What Maria's phone might send at 2:41 PM on 19 November in Toronto (UTC−5): the
 * sample medications at 8:10 AM and 2:10 PM, two days of doses, a when-needed tablet,
 * and two scans the app said not to take.
 */
export function sampleSnapshot(): Snapshot {
  return {
    v: 1,
    sentAt: "2026-11-19T19:41:03Z",
    timeZone: "America/Toronto",
    earlyWindowMinutes: 60,
    lateWindowMinutes: 120,
    days: ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"],
    medications: [
      { id: "capecitabine-500", name: "Capecitabine", strength: "500 mg", times: ["08:10", "14:10"], asNeeded: false },
      { id: "dexamethasone-4", name: "Dexamethasone", strength: "4 mg", times: ["08:10"], asNeeded: false },
      { id: "allopurinol-300", name: "Allopurinol", strength: "300 mg", times: ["14:10"], asNeeded: false },
      { id: "ondansetron-8", name: "Ondansetron", strength: "8 mg", times: [], asNeeded: true },
    ],
    doses: [
      { day: "2026-11-18", medicationId: "capecitabine-500", time: "08:10", scheduledAt: "2026-11-18T13:10:00Z", takenAt: "2026-11-18T13:16:00Z", scanned: true },
      { day: "2026-11-18", medicationId: "dexamethasone-4", time: "08:10", scheduledAt: "2026-11-18T13:10:00Z", scanned: false },
      { day: "2026-11-19", medicationId: "capecitabine-500", time: "08:10", scheduledAt: "2026-11-19T13:10:00Z", takenAt: "2026-11-19T13:14:00Z", scanned: true },
      { day: "2026-11-19", medicationId: "capecitabine-500", time: "14:10", scheduledAt: "2026-11-19T19:10:00Z", takenAt: "2026-11-19T19:40:12Z", scanned: true },
      { day: "2026-11-19", medicationId: "allopurinol-300", time: "14:10", scheduledAt: "2026-11-19T19:10:00Z", scanned: false },
    ],
    asNeeded: [{ day: "2026-11-18", medicationId: "ondansetron-8", takenAt: "2026-11-18T20:02:00Z", scanned: true }],
    scans: [
      { at: "2026-11-19T19:41:00Z", pills: [{ medicationId: "capecitabine-500", outcome: "alreadyTaken", takenAt: "2026-11-19T19:40:12Z" }] },
      { at: "2026-11-18T23:15:00Z", pills: [{ medicationId: null, outcome: "unknown" }] },
    ],
  }
}
