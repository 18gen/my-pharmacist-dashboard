import { describe, expect, it } from "vitest"

import { patientCard, patientCards, timeOfDay, weekday } from "@/lib/card"
import type { Patient } from "@/lib/patients"

import { sampleSnapshot } from "./fixtures"

// 2:45 PM in Toronto on Thursday 19 November, five minutes after the fixture's last scan.
const now = new Date("2026-11-19T19:45:00Z")

function maria(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "maria",
    name: "Maria",
    joinedAt: "2026-11-19T19:00:00Z",
    updatedAt: "2026-11-19T19:41:03Z",
    snapshot: sampleSnapshot(),
    ...overrides,
  }
}

function cellOf(card: ReturnType<typeof patientCard>, medication: string, row: string, day: string) {
  const rows = card.medications.find((entry) => entry.name === medication)?.rows
  const index = card.columns.findIndex((column) => column.day === day)
  return rows?.find((entry) => entry.label === row)?.cells[index]
}

describe("the week grid", () => {
  const card = patientCard(maria(), "Maria", now)

  it("has the phone's 7 days, today last", () => {
    expect(card.columns.map((column) => column.label)).toEqual(["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Today"])
  })

  it("lists each medication's times in the phone's time zone", () => {
    expect(card.medications.map((medication) => medication.name)).toEqual([
      "Capecitabine 500 mg",
      "Dexamethasone 4 mg",
      "Allopurinol 300 mg",
      "Ondansetron 8 mg",
    ])
    expect(card.medications[0]?.rows.map((row) => row.label)).toEqual(["8:10 AM", "2:10 PM"])
  })

  it("says how and when a dose was taken", () => {
    expect(cellOf(card, "Capecitabine 500 mg", "2:10 PM", "2026-11-19")).toMatchObject({
      state: "taken",
      label: "Taken 2:40 PM, scanned",
    })
  })

  it("counts a dose missed once its window has passed", () => {
    expect(cellOf(card, "Dexamethasone 4 mg", "8:10 AM", "2026-11-18")).toMatchObject({
      state: "missed",
      label: "Not taken by 10:10 AM",
    })
  })

  it("shows a dose due now until the end of its window", () => {
    expect(cellOf(card, "Allopurinol 300 mg", "2:10 PM", "2026-11-19")).toMatchObject({
      state: "due",
      label: "Due now, until 4:10 PM",
    })
  })

  it("shows a dose more than an hour away as later", () => {
    const noon = patientCard(maria(), "Maria", new Date("2026-11-19T17:00:00Z"))
    expect(cellOf(noon, "Allopurinol 300 mg", "2:10 PM", "2026-11-19")).toMatchObject({
      state: "later",
      label: "Due 2:10 PM",
    })
  })

  it("leaves a day the phone sent nothing for empty", () => {
    expect(cellOf(card, "Dexamethasone 4 mg", "8:10 AM", "2026-11-13")?.state).toBe("none")
  })

  it("marks a when-needed medication on the days it was taken", () => {
    expect(cellOf(card, "Ondansetron 8 mg", "When needed", "2026-11-18")).toMatchObject({
      state: "taken",
      label: "Taken 3:02 PM, scanned",
    })
    expect(cellOf(card, "Ondansetron 8 mg", "When needed", "2026-11-19")?.state).toBe("none")
  })

  it("changes a cell's key when its state changes, and only then", () => {
    const later = patientCard(maria(), "Maria", new Date("2026-11-19T21:30:00Z"))
    const before = cellOf(card, "Allopurinol 300 mg", "2:10 PM", "2026-11-19")
    const after = cellOf(later, "Allopurinol 300 mg", "2:10 PM", "2026-11-19")
    expect(after?.state).toBe("missed")
    expect(after?.key).not.toBe(before?.key)
    expect(cellOf(later, "Capecitabine 500 mg", "2:10 PM", "2026-11-19")?.key).toBe(
      cellOf(card, "Capecitabine 500 mg", "2:10 PM", "2026-11-19")?.key,
    )
  })
})

describe("today", () => {
  it("counts today's doses and what the app said not to take", () => {
    expect(patientCard(maria(), "Maria", now).today).toEqual({
      taken: 2,
      due: 1,
      missed: 0,
      later: 0,
      toldNotToTake: 1,
    })
  })

  it("is unknown when the phone sent nothing about today", () => {
    expect(patientCard(maria(), "Maria", new Date("2026-11-21T15:00:00Z")).today).toBeNull()
  })
})

describe("what happened", () => {
  it("lists what matters, newest first, in the phone's time zone", () => {
    const lines = patientCard(maria(), "Maria", now).happenings.map(({ when, tone, title, detail }) => ({
      when,
      tone,
      title,
      detail,
    }))
    expect(lines).toEqual([
      { when: "2:41 PM", tone: "caution", title: "Told not to take Capecitabine 500 mg", detail: "already taken at 2:40 PM" },
      { when: "2:40 PM", tone: "ok", title: "Took Capecitabine 500 mg", detail: "2:10 PM dose · scanned" },
      { when: "8:14 AM", tone: "ok", title: "Took Capecitabine 500 mg", detail: "8:10 AM dose · scanned" },
      { when: "Wed 6:15 PM", tone: "caution", title: "Scanned a pill that isn't on the list", detail: undefined },
      { when: "Wed 3:02 PM", tone: "ok", title: "Took Ondansetron 8 mg", detail: "when needed · scanned" },
      { when: "Wed 10:10 AM", tone: "danger", title: "Missed Dexamethasone 4 mg", detail: "8:10 AM dose" },
    ])
  })

  it("says why each pill was not to be taken", () => {
    const snapshot = sampleSnapshot()
    snapshot.scans = [
      {
        at: "2026-11-19T19:30:00Z",
        pills: [
          { medicationId: "capecitabine-500", outcome: "take" },
          { medicationId: "capecitabine-500", outcome: "extra" },
          { medicationId: "allopurinol-300", outcome: "tooEarly", doseTime: "20:00" },
          { medicationId: "dexamethasone-4", outcome: "missed", doseTime: "08:10" },
          { medicationId: "exemestane-25", outcome: "notScheduledToday" },
          { medicationId: "ondansetron-8", outcome: "asNeeded" },
        ],
      },
    ]
    const details = patientCard(maria({ snapshot }), "Maria", now)
      .happenings.filter((line) => line.title.startsWith("Told not to take"))
      .map((line) => `${line.title}: ${line.detail}`)
    expect(details).toEqual([
      "Told not to take Capecitabine 500 mg: a second tablet in the same photo",
      "Told not to take Allopurinol 300 mg: too early: the next dose is at 8:00 PM",
      "Told not to take Dexamethasone 4 mg: the 8:10 AM dose was more than 2 hours late",
      "Told not to take exemestane-25: not scheduled today",
    ])
  })
})

describe("the cards", () => {
  it("number a name someone else joined with first, and put the latest update first", () => {
    const cards = patientCards(
      [
        maria({ id: "a", joinedAt: "2026-11-19T18:00:00Z", updatedAt: "2026-11-19T18:05:00Z" }),
        maria({ id: "b", name: "maria ", joinedAt: "2026-11-19T18:30:00Z", updatedAt: "2026-11-19T19:41:00Z" }),
        maria({ id: "c", name: "Ken", joinedAt: "2026-11-19T18:10:00Z", updatedAt: "2026-11-19T19:00:00Z" }),
      ],
      now,
    )
    expect(cards.map((card) => card.name)).toEqual(["maria  (2)", "Ken", "Maria"])
  })

  it("wait for a phone that hasn't sent anything yet", () => {
    const card = patientCard(maria({ snapshot: null }), "Maria", now)
    expect(card.waiting).toBe(true)
    expect(card.medications).toEqual([])
  })
})

describe("formatting", () => {
  it("writes times of day on a 12-hour clock", () => {
    expect(["00:05", "08:10", "12:30", "14:10", "23:55"].map(timeOfDay)).toEqual([
      "12:05 AM",
      "8:10 AM",
      "12:30 PM",
      "2:10 PM",
      "11:55 PM",
    ])
  })

  it("names the weekday of a day", () => {
    expect(weekday("2026-11-19")).toBe("Thu")
  })
})
