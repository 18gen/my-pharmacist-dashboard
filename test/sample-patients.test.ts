import { describe, expect, it } from "vitest"

import { buildBoard } from "@/lib/board"
import { samplePatients } from "@/lib/sample-patients"
import { snapshotSchema } from "@/lib/snapshot"

// In this computer's time zone: early, mid-morning, afternoon and late.
function on(hours: number, minutes = 0): Date {
  return new Date(2026, 10, 25, hours, minutes)
}
const times = [on(6, 10), on(9, 5), on(15, 40), on(23, 55)]

describe("the sample patients", () => {
  it.each(times)("send snapshots in the app's format at %s", (now) => {
    for (const patient of samplePatients(now)) {
      expect(snapshotSchema.safeParse(patient.snapshot).success).toBe(true)
      expect(Date.parse(patient.updatedAt)).toBeLessThanOrEqual(now.getTime())
    }
  })

  it("are Helen with 2 rows and Frank with 5, with IDs no phone gets", () => {
    const board = buildBoard(samplePatients(on(15, 40)), on(15, 40), "name")
    expect(board.people.map((person) => [person.name, person.rows.length])).toEqual([
      ["Frank", 5],
      ["Helen", 2],
    ])
    expect(board.people.every((person) => person.id.startsWith("sample-"))).toBe(true)
  })

  it("mostly scan, tick a few by hand, miss a few, and are never warned", () => {
    const now = on(23, 55)
    const board = buildBoard(samplePatients(now), now, "name")
    const states = board.people.map((person) => {
      const cells = person.rows.flatMap((row) => row.cells)
      const count = (state: string) => cells.filter((cell) => cell.state === state).length
      return { name: person.name, scanned: count("scanned"), ticked: count("ticked"), missed: count("missed"), warned: cells.filter((cell) => cell.warned).length }
    })
    for (const person of states) {
      expect(person.scanned).toBeGreaterThan(3 * person.ticked)
      expect(person.ticked).toBeGreaterThan(0)
      expect(person.warned).toBe(0)
    }
    expect(states.map((person) => [person.name, person.missed])).toEqual([
      ["Frank", 2],
      ["Helen", 1],
    ])
    for (const patient of samplePatients(now)) expect(patient.snapshot?.scans).toEqual([])
  })

  it("take each dose a few minutes after its time, so one can be due now", () => {
    // Frank's 8:00 doses: due at 8:01, scanned by 8:30.
    const frank = (now: Date) => buildBoard(samplePatients(now), now, "name").people.find((person) => person.name === "Frank")!
    const due = frank(on(8, 1))
    expect(due.rows.flatMap((row) => row.cells).some((cell) => cell.state === "due")).toBe(true)
    const later = frank(on(8, 30))
    expect(later.rows.flatMap((row) => row.cells).some((cell) => cell.state === "due")).toBe(false)
  })

  it("are the same for the same minute, and carry no scan pictures", () => {
    expect(samplePatients(on(15, 40))).toEqual(samplePatients(on(15, 40)))
    const doses = samplePatients(on(23, 55)).flatMap((patient) => patient.snapshot?.doses ?? [])
    expect(doses.some((dose) => dose.photoId)).toBe(false)
  })
})
