import type { SharedPatient } from "@/lib/board"
import { buildSnapshot, delays, medication, type Taken } from "@/lib/sample-week"
import type { Snapshot } from "@/lib/snapshot"

/**
 * Two made-up patients the dashboard can show beside the people sharing ("Sample
 * patients"), so a demo has full weeks to look at. They live in this browser only and are
 * never sent anywhere.
 *
 * Built around `now`, so their doses keep being taken a few minutes after each time, as a
 * phone would report them: nearly all by a scan, now and then ticked by hand, a few missed
 * over the week, and no "don't take" warnings. They send no scan pictures, so their boxes
 * show the medicine's own, as for any dose without one.
 * - Rosa: hormone therapy, a tablet each morning and each evening.
 * - David: capecitabine twice a day with the medicines that go with it, and ondansetron
 *   when needed.
 */
export function samplePatients(now: Date): SharedPatient[] {
  return [rosa(now), david(now)]
}

function rosa(now: Date): SharedPatient {
  const { snapshot } = buildSnapshot(
    now,
    [
      medication("exemestane-25", "Exemestane", "25 mg", ["09:00"]),
      medication("allopurinol-300", "Allopurinol", "300 mg", ["21:00"]),
    ],
    {
      taken: (day, id, _time, index) => {
        if (day === -3 && id === "allopurinol-300") return null
        return mostlyScanned(index, 5)
      },
    },
  )
  return patient("rosa", "Rosa", now, snapshot)
}

function david(now: Date): SharedPatient {
  const { snapshot } = buildSnapshot(
    now,
    [
      medication("capecitabine-500", "Capecitabine", "500 mg", ["08:00", "20:00"]),
      medication("dexamethasone-4", "Dexamethasone", "4 mg", ["08:00"]),
      medication("metoclopramide-10", "Metoclopramide", "10 mg", ["12:30"]),
      medication("ondansetron-8", "Ondansetron", "8 mg", [], true),
    ],
    {
      taken: (day, id, time, index) => {
        if (day === -4 && id === "metoclopramide-10") return null
        if (day === -2 && id === "capecitabine-500" && time === "20:00") return null
        return mostlyScanned(index, 6)
      },
      asNeeded: [
        { day: -5, medicationId: "ondansetron-8", time: "13:40", scanned: true },
        { day: -1, medicationId: "ondansetron-8", time: "18:25", scanned: true },
      ],
    },
  )
  return patient("david", "David", now, snapshot)
}

/** Taken a few minutes after its time; by a scan, except every `handEvery`th dose, ticked by hand. */
function mostlyScanned(index: number, handEvery: number): Taken {
  return { after: delays[index % delays.length] ?? 5, scanned: index % handEvery !== handEvery - 2 }
}

/**
 * As the dashboard's list gives a person: joined the morning their week starts, last
 * updated when they last took something (their phone sends then).
 */
function patient(key: string, name: string, now: Date, snapshot: Snapshot): SharedPatient {
  const joined = new Date(now)
  joined.setDate(joined.getDate() - 6)
  joined.setHours(7, 52, 0, 0)
  const times = [...snapshot.doses.map((dose) => dose.takenAt), ...snapshot.asNeeded.map((entry) => entry.takenAt)]
    .filter((time): time is string => time !== undefined)
    .map(Date.parse)
  const updated = Math.max(joined.getTime(), ...times)
  return {
    // Phones are given UUIDs, so a sample can't clash with a real person.
    id: `sample-${key}`,
    name,
    joinedAt: joined.toISOString(),
    updatedAt: new Date(updated).toISOString(),
    snapshot: { ...snapshot, sentAt: new Date(updated).toISOString() },
    photoToken: "",
  }
}
