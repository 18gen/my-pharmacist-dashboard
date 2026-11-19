import { describe, expect, it } from "vitest"

import { patientCard } from "@/lib/card"
import { snapshotSchema } from "@/lib/snapshot"

import { maria, samplePeople } from "../scripts/sample-people"

// Built in this computer's time zone; checked at a morning, an afternoon and a late time.
function on(hours: number, minutes = 0): Date {
  const date = new Date(2026, 10, 19, hours, minutes, 30)
  return date
}

describe("the sample people", () => {
  it.each([on(7, 5), on(10, 32), on(14, 12), on(23, 58)])("send snapshots in the app's format at %s", (now) => {
    for (const person of samplePeople(now)) {
      if (person.snapshot) expect(snapshotSchema.safeParse(person.snapshot).success).toBe(true)
    }
  })

  it.each([on(10, 32), on(14, 12)])("give Maria a dose due now at %s", (now) => {
    const card = patientCard({ id: "m", name: "Maria", joinedAt: now.toISOString(), updatedAt: now.toISOString(), snapshot: maria(now) }, "Maria", now)
    expect(card.today?.due).toBeGreaterThan(0)
  })

  it("give Maria's week three misses and two pills she was told not to take", () => {
    const now = on(14, 12)
    const card = patientCard({ id: "m", name: "Maria", joinedAt: now.toISOString(), updatedAt: now.toISOString(), snapshot: maria(now) }, "Maria", now)
    const titles = card.happenings.map((line) => line.title)
    expect(titles.filter((title) => title.startsWith("Missed"))).toHaveLength(3)
    expect(titles.filter((title) => title.startsWith("Told not to take"))).toHaveLength(2)
    expect(titles).toContain("Scanned a pill that isn't on the list")
  })

  it("move Maria's times so one is due at the moment of the demo", () => {
    expect(maria(on(14, 12)).medications[0]?.times).toEqual(["08:10", "14:10"])
    expect(maria(on(10, 32)).medications[0]?.times).toEqual(["10:30", "16:30"])
  })
})
