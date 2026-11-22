import { describe, expect, it } from "vitest"

import { buildBoard, type PersonBoard } from "@/lib/board"
import { snapshotSchema } from "@/lib/snapshot"

import { maria, samplePeople } from "../scripts/sample-people"

// Built in this computer's time zone; checked at a morning, an afternoon and a late time.
function on(hours: number, minutes = 0): Date {
  const date = new Date(2026, 10, 19, hours, minutes, 30)
  return date
}

function mariasBoard(now: Date): PersonBoard {
  const person = { id: "m", name: "Maria", joinedAt: now.toISOString(), updatedAt: now.toISOString(), snapshot: maria(now), photoToken: "t" }
  return buildBoard([person], now, "updated").people[0]!
}

describe("the sample people", () => {
  it.each([on(7, 5), on(10, 32), on(14, 12), on(23, 58)])("send snapshots in the app's format at %s", (now) => {
    for (const person of samplePeople(now)) {
      if (person.snapshot) expect(snapshotSchema.safeParse(person.snapshot).success).toBe(true)
    }
  })

  it.each([on(10, 32), on(14, 12)])("give Maria a dose due now at %s", (now) => {
    const cells = mariasBoard(now).rows.flatMap((row) => row.cells)
    expect(cells.some((cell) => cell.state === "due")).toBe(true)
  })

  it("give Maria's week three doses not taken, two the app said not to take, and a pill not on the list", () => {
    const cells = mariasBoard(on(14, 12)).rows.flatMap((row) => row.cells)
    expect(cells.filter((cell) => cell.state === "missed")).toHaveLength(3)
    expect(cells.filter((cell) => cell.warned)).toHaveLength(2)
    expect(cells.filter((cell) => cell.state === "unknown")).toHaveLength(1)
    expect(cells.some((cell) => cell.state === "noRecord")).toBe(false)
  })

  it("move Maria's times so one is due at the moment of the demo", () => {
    expect(maria(on(14, 12)).medications[0]?.times).toEqual(["08:10", "14:10"])
    expect(maria(on(10, 32)).medications[0]?.times).toEqual(["10:30", "16:30"])
  })
})
