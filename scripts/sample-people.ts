import { buildSnapshot as build, clock, delays, hour, medication, minute, type SamplePhoto, scan } from "@/lib/sample-week"
import type { Snapshot } from "@/lib/snapshot"

export type { SamplePhoto } from "@/lib/sample-week"

/**
 * Made-up people for trying the dashboard without phones, built around `now` in this
 * computer's time zone, as their phones would send them:
 * - Maria: the app's sample week (the iOS "Reset demo → With a sample week"), a dose due
 *   now; made by the app, so no scan pictures: her boxes show the medicine's own;
 * - Ken: every dose taken, nearly all by a scan, with the scans' pictures;
 * - Aiko: this morning's doses missed, and a pill the app didn't know, with its picture;
 * - Sam: started today, so the days before show "no record yet";
 * - a second Maria who joined but whose phone hasn't sent anything yet.
 */
export interface SamplePerson {
  name: string
  snapshot: Snapshot | null
  /** Scan pictures to send before the snapshot: which fixture (scripts/fixtures) under which ID. */
  photos: SamplePhoto[]
}

export function samplePeople(now: Date): SamplePerson[] {
  return [
    { name: "Ken", ...ken(now) },
    { name: "Aiko", ...aiko(now) },
    { name: "Maria", snapshot: maria(now), photos: [] },
    { name: "Sam", ...sam(now) },
    { name: "Maria", snapshot: null, photos: [] },
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
  const medications = [
    medication("capecitabine-500", "Capecitabine", "500 mg", [first, second]),
    medication("dexamethasone-4", "Dexamethasone", "4 mg", [first]),
    medication("allopurinol-300", "Allopurinol", "300 mg", [second]),
    medication("ondansetron-8", "Ondansetron", "8 mg", [], true),
  ]
  return build(now, medications, {
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
  }).snapshot
}

function ken(now: Date): Omit<SamplePerson, "name"> {
  const photos: Record<string, string> = {
    "exemestane-25": "exemestane-25-scan",
    "metoclopramide-10": "metoclopramide-10-scan",
  }
  return build(
    now,
    [
      medication("exemestane-25", "Exemestane", "25 mg", ["09:00"]),
      medication("metoclopramide-10", "Metoclopramide", "10 mg", ["09:00", "21:00"]),
    ],
    {
      taken: (_day, id, _time, index) => {
        const scanned = index % 7 !== 3
        return { after: delays[index % delays.length] ?? 5, scanned, photo: scanned ? photos[id] : undefined }
      },
    },
  )
}

function aiko(now: Date): Omit<SamplePerson, "name"> {
  return build(
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
      scans: (dayAt) => [scan(dayAt(0, "10:05"), null, "unknown", { photo: "dexamethasone-1-5-scan" })],
    },
  )
}

/** Shares from a phone set up today: nothing is known before this morning. */
function sam(now: Date): Omit<SamplePerson, "name"> {
  return build(now, [medication("exemestane-25", "Exemestane", "25 mg", ["09:00"])], {
    since: 0,
    taken: (day) => (day === 0 ? { after: 6, scanned: true, photo: "exemestane-25-scan" } : null),
  })
}
