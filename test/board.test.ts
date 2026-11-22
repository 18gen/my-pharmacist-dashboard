import { describe, expect, it } from "vitest"

import { boardColumns, buildBoard, dayEvents, displayNames, orderPeople, quietDay, type SharedPatient } from "@/lib/board"
import type { Snapshot } from "@/lib/snapshot"

import { sampleSnapshot } from "./fixtures"

// The fixture is Maria's phone in Toronto on Thursday 19 November; 2:45 PM there.
const zone = "America/Toronto"
const now = new Date("2026-11-19T19:45:00Z")

function patient(snapshot: Snapshot | null, extra: Partial<SharedPatient> = {}): SharedPatient {
  return {
    id: "maria",
    name: "Maria",
    joinedAt: "2026-11-19T19:00:00Z",
    updatedAt: "2026-11-19T19:44:58Z",
    snapshot,
    photoToken: "token",
    ...extra,
  }
}

function boardOf(snapshot: Snapshot, at = now) {
  const board = buildBoard([patient(snapshot)], at, "updated", zone)
  const person = board.people[0]!
  const row = (key: string) => person.rows.find((entry) => entry.key === key)!
  const cell = (key: string, day: string) => row(key).cells.find((entry) => entry.day === day)!
  return { board, person, row, cell }
}

describe("the columns", () => {
  it("are the 7 days ending today where the dashboard is, today last", () => {
    const columns = boardColumns(now, zone)
    expect(columns.map((column) => column.day)).toEqual([
      "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19",
    ])
    expect(columns[0]).toMatchObject({ weekday: "Fri", date: "13", isToday: false, long: "Friday, Nov 13" })
    expect(columns[6]).toMatchObject({ weekday: "Today", date: "19", isToday: true, long: "Today, Thursday, Nov 19" })
  })

  it("follow the calendar across a change of clocks", () => {
    // Clocks went back in Toronto on 1 November 2026.
    const columns = boardColumns(new Date("2026-11-03T04:30:00Z"), zone)
    expect(columns.map((column) => column.date)).toEqual(["27", "28", "29", "30", "31", "1", "2"])
  })
})

describe("the rows", () => {
  it("are each dose time, earliest first and then by name, then when-needed tablets, then pills not on the list", () => {
    const { person } = boardOf(sampleSnapshot())
    expect(person.rows.map((row) => row.key)).toEqual([
      "capecitabine-500|08:10",
      "dexamethasone-4|08:10",
      "allopurinol-300|14:10",
      "capecitabine-500|14:10",
      "ondansetron-8|needed",
      "unknown",
    ])
    expect(person.rows.map((row) => row.when)).toEqual(["8:10 AM", "8:10 AM", "2:10 PM", "2:10 PM", "When needed", "Not on the list"])
    expect(person.rows[0]).toMatchObject({ name: "Capecitabine", strength: "500 mg", kind: "dose" })
  })

  it("leave out the unknown pill's row when there was none that week", () => {
    const snapshot = sampleSnapshot()
    snapshot.scans = snapshot.scans.filter((scan) => scan.pills.every((pill) => pill.outcome !== "unknown"))
    expect(boardOf(snapshot).person.rows.some((row) => row.kind === "unknown")).toBe(false)
  })
})

describe("each box", () => {
  it("shows a dose taken by a scan or by hand with its time, and what isn't taken as missed, due or later", () => {
    const snapshot = sampleSnapshot()
    snapshot.doses.push({ day: "2026-11-17", medicationId: "dexamethasone-4", time: "08:10", scheduledAt: "2026-11-17T13:10:00Z", takenAt: "2026-11-17T13:25:00Z", scanned: false })
    const { cell } = boardOf(snapshot)
    expect(cell("capecitabine-500|08:10", "2026-11-18")).toMatchObject({ state: "scanned", time: "8:16 AM", label: "Scanned at 8:16 AM" })
    expect(cell("dexamethasone-4|08:10", "2026-11-17")).toMatchObject({ state: "ticked", time: "8:25 AM" })
    expect(cell("dexamethasone-4|08:10", "2026-11-18")).toMatchObject({ state: "missed", time: null })
    expect(cell("allopurinol-300|14:10", "2026-11-19")).toMatchObject({ state: "due", time: "Now" })
    expect(cell("capecitabine-500|08:10", "2026-11-15")).toMatchObject({ state: "empty" })
  })

  it("shows a dose not yet due as later", () => {
    const { cell } = boardOf(sampleSnapshot(), new Date("2026-11-19T17:00:00Z"))
    expect(cell("allopurinol-300|14:10", "2026-11-19").state).toBe("later")
  })

  it("shows days before the phone's first record, and days it didn't send, as no record", () => {
    const snapshot = sampleSnapshot()
    snapshot.recordsSince = "2026-11-18"
    const { cell } = boardOf(snapshot)
    expect(cell("capecitabine-500|08:10", "2026-11-17").state).toBe("noRecord")
    expect(cell("ondansetron-8|needed", "2026-11-14").state).toBe("noRecord")
    expect(cell("dexamethasone-4|08:10", "2026-11-18").state).toBe("missed")

    // Two days later, the phone hasn't sent again: its last two days aren't known.
    const later = boardOf(sampleSnapshot(), new Date("2026-11-21T19:45:00Z"))
    expect(later.cell("capecitabine-500|08:10", "2026-11-21").state).toBe("noRecord")
    expect(later.cell("capecitabine-500|08:10", "2026-11-19").state).toBe("scanned")
  })

  it("carries the scanned pill's picture", () => {
    const snapshot = sampleSnapshot()
    snapshot.doses[0] = { ...snapshot.doses[0]!, photoId: "0B5E1F3A-8C2D-4E6F-9A7B-1C2D3E4F5A6B" }
    const { cell } = boardOf(snapshot)
    expect(cell("capecitabine-500|08:10", "2026-11-18").photoId).toBe("0b5e1f3a-8c2d-4e6f-9a7b-1c2d3e4f5a6b")
  })

  it("shows a when-needed tablet on the day it was taken, and a pill not on the list on the day it was scanned", () => {
    const { cell } = boardOf(sampleSnapshot())
    expect(cell("ondansetron-8|needed", "2026-11-18")).toMatchObject({ state: "scanned", time: "3:02 PM" })
    expect(cell("ondansetron-8|needed", "2026-11-19").state).toBe("empty")
    expect(cell("unknown", "2026-11-18")).toMatchObject({ state: "unknown", time: "6:15 PM" })
  })

  it("changes its key whenever what it shows changes, so the change can glow", () => {
    const before = boardOf(sampleSnapshot()).cell("allopurinol-300|14:10", "2026-11-19").key
    const snapshot = sampleSnapshot()
    snapshot.doses[4] = { ...snapshot.doses[4]!, takenAt: "2026-11-19T19:44:00Z", scanned: true }
    const after = boardOf(snapshot).cell("allopurinol-300|14:10", "2026-11-19").key
    expect(after).not.toBe(before)
  })
})

describe("the red mark for “Don’t take now”", () => {
  it("goes on the dose an already-taken pill was taken for", () => {
    const { cell } = boardOf(sampleSnapshot())
    expect(cell("capecitabine-500|14:10", "2026-11-19").warned).toBe(true)
    expect(cell("capecitabine-500|14:10", "2026-11-19").label).toContain("Don’t take now")
    expect(cell("capecitabine-500|08:10", "2026-11-19").warned).toBe(false)
  })

  it("goes on the dose the app named for too early and too late, else the medication's nearest time", () => {
    const snapshot = sampleSnapshot()
    snapshot.scans = [
      { at: "2026-11-18T17:00:00Z", pills: [{ medicationId: "allopurinol-300", outcome: "tooEarly", doseTime: "14:10" }] },
      { at: "2026-11-17T20:00:00Z", pills: [{ medicationId: "dexamethasone-4", outcome: "missed", doseTime: "08:10" }] },
      { at: "2026-11-16T13:30:00Z", pills: [{ medicationId: "capecitabine-500", outcome: "notScheduledToday" }] },
      { at: "2026-11-15T19:20:00Z", pills: [{ medicationId: "capecitabine-500", outcome: "extra" }] },
    ]
    const { cell } = boardOf(snapshot)
    expect(cell("allopurinol-300|14:10", "2026-11-18").warned).toBe(true)
    expect(cell("dexamethasone-4|08:10", "2026-11-17").warned).toBe(true)
    expect(cell("capecitabine-500|08:10", "2026-11-16").warned).toBe(true)
    expect(cell("capecitabine-500|14:10", "2026-11-15").warned).toBe(true)
    expect(cell("capecitabine-500|14:10", "2026-11-16").warned).toBe(false)
  })
})

describe("what happened on a day", () => {
  it("lists what was taken, what the app said, and what wasn't taken, in the order it happened", () => {
    const maria = patient(sampleSnapshot())
    expect(dayEvents(maria, "2026-11-19", now).map((line) => [line.time, line.text])).toEqual([
      ["8:14 AM", "Took Capecitabine, scanned"],
      ["2:40 PM", "Took Capecitabine, scanned"],
      ["2:41 PM", "Don’t take now: Capecitabine, already taken at 2:40 PM"],
    ])
    expect(dayEvents(maria, "2026-11-18", now).map((line) => [line.time, line.tone, line.text])).toEqual([
      ["8:10 AM", "missed", "Not taken: Dexamethasone"],
      ["8:16 AM", "scanned", "Took Capecitabine, scanned"],
      ["3:02 PM", "asNeeded", "Took Ondansetron, when needed"],
      ["6:15 PM", "unknown", "Unknown – don’t take: a pill not on the list"],
    ])
  })

  it("puts doses taken together in the same minute on one line", () => {
    const snapshot = sampleSnapshot()
    snapshot.doses.push(
      { day: "2026-11-19", medicationId: "dexamethasone-4", time: "08:10", scheduledAt: "2026-11-19T13:10:00Z", takenAt: "2026-11-19T13:14:40Z", scanned: true },
      { day: "2026-11-17", medicationId: "capecitabine-500", time: "08:10", scheduledAt: "2026-11-17T13:10:00Z", takenAt: "2026-11-17T13:30:00Z", scanned: false },
      { day: "2026-11-17", medicationId: "dexamethasone-4", time: "08:10", scheduledAt: "2026-11-17T13:10:00Z", takenAt: "2026-11-17T13:30:10Z", scanned: false },
    )
    expect(dayEvents(patient(snapshot), "2026-11-19", now)[0]?.text).toBe("Took Capecitabine and Dexamethasone, scanned")
    expect(dayEvents(patient(snapshot), "2026-11-17", now)[0]?.text).toBe("Ticked Capecitabine and Dexamethasone by hand")
  })

  it("says why the app said not to take a pill, in the app's words", () => {
    const snapshot = sampleSnapshot()
    snapshot.scans = [
      { at: "2026-11-19T17:00:00Z", pills: [
        { medicationId: "allopurinol-300", outcome: "tooEarly", doseTime: "14:10" },
        { medicationId: "dexamethasone-4", outcome: "missed", doseTime: "08:10" },
        { medicationId: "capecitabine-500", outcome: "notScheduledToday" },
        { medicationId: "capecitabine-500", outcome: "extra" },
      ] },
    ]
    const texts = dayEvents(patient(snapshot), "2026-11-19", now).filter((line) => line.tone === "dont").map((line) => line.text)
    expect(texts).toEqual([
      "Don’t take now: Allopurinol, too early. Next dose at 2:10 PM.",
      "Don’t take now: Dexamethasone, too late for the 8:10 AM dose",
      "Don’t take now: Capecitabine, not for today",
      "Don’t take now: Capecitabine, one tablet per dose",
    ])
  })

  it("leaves out doses not taken before the phone's first record, and says why a day is quiet", () => {
    const snapshot = sampleSnapshot()
    snapshot.recordsSince = "2026-11-19"
    expect(dayEvents(patient(snapshot), "2026-11-18", now).some((line) => line.tone === "missed")).toBe(false)
    expect(quietDay(patient(snapshot), "2026-11-16")).toBe("No record yet: this phone’s records start Thursday, Nov 19.")
    expect(quietDay(patient(sampleSnapshot()), "2026-11-16")).toBe("Nothing happened this day.")
  })
})

describe("the people", () => {
  const ken = patient(sampleSnapshot(), { id: "ken", name: "Ken", joinedAt: "2026-11-19T18:00:00Z", updatedAt: "2026-11-19T19:30:00Z" })
  const maria = patient(sampleSnapshot(), { id: "maria", name: "maria", joinedAt: "2026-11-19T18:30:00Z", updatedAt: "2026-11-19T19:44:00Z" })
  const aiko = patient(null, { id: "aiko", name: "Aiko", joinedAt: "2026-11-19T19:40:00Z", updatedAt: "2026-11-19T19:40:00Z" })

  it("come in the order asked: latest update with people still waiting last, first to join, or by name", () => {
    const people = buildBoard([ken, maria, aiko], now, "updated", zone).people
    expect(people.map((person) => person.id)).toEqual(["maria", "ken", "aiko"])
    expect(orderPeople(people, "joined").map((person) => person.id)).toEqual(["ken", "maria", "aiko"])
    expect(orderPeople(people, "name").map((person) => person.id)).toEqual(["aiko", "ken", "maria"])
  })

  it("wait with no rows until their phone sends", () => {
    const [waiting] = buildBoard([aiko], now, "updated", zone).people
    expect(waiting).toMatchObject({ waiting: true, rows: [] })
  })

  it("are told apart by number when two have the same name", () => {
    const names = displayNames([
      { ...maria, id: "b", name: "maria", joinedAt: "2026-11-19T11:00:00Z" },
      { ...maria, id: "a", name: "Maria", joinedAt: "2026-11-19T10:00:00Z" },
    ])
    expect(names.get("a")).toBe("Maria")
    expect(names.get("b")).toBe("maria (2)")
  })
})
