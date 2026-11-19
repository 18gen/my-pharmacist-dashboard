import { describe, expect, it } from "vitest"

import { joinSchema, limits, snapshotSchema } from "@/lib/snapshot"

import { sampleSnapshot } from "./fixtures"

describe("snapshotSchema", () => {
  it("accepts what the app sends", () => {
    expect(snapshotSchema.safeParse(sampleSnapshot()).success).toBe(true)
  })

  it("accepts a dose time with fractional seconds", () => {
    const snapshot = sampleSnapshot()
    snapshot.sentAt = "2026-11-19T19:41:03.123Z"
    expect(snapshotSchema.safeParse(snapshot).success).toBe(true)
  })

  it("rejects another version", () => {
    expect(snapshotSchema.safeParse({ ...sampleSnapshot(), v: 2 }).success).toBe(false)
  })

  it("rejects more medications than a scan can compare", () => {
    const snapshot = sampleSnapshot()
    const one = snapshot.medications[0]!
    snapshot.medications = Array.from({ length: limits.medications + 1 }, (_, index) => ({ ...one, id: `m${index}` }))
    expect(snapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it("rejects more than 7 days", () => {
    const snapshot = sampleSnapshot()
    snapshot.days = [...snapshot.days, "2026-11-20"]
    expect(snapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it("rejects a time of day that isn't one", () => {
    const snapshot = sampleSnapshot()
    snapshot.doses[0] = { ...snapshot.doses[0]!, time: "8:10" }
    expect(snapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it("rejects an outcome the app doesn't have", () => {
    const snapshot = structuredClone(sampleSnapshot()) as unknown as { scans: { pills: { outcome: string }[] }[] }
    snapshot.scans[0]!.pills[0]!.outcome = "maybe"
    expect(snapshotSchema.safeParse(snapshot).success).toBe(false)
  })
})

describe("joinSchema", () => {
  it("trims the name", () => {
    expect(joinSchema.parse({ name: "  Maria  " }).name).toBe("Maria")
  })

  it("rejects an empty or too long name", () => {
    expect(joinSchema.safeParse({ name: "   " }).success).toBe(false)
    expect(joinSchema.safeParse({ name: "x".repeat(limits.nameLength + 1) }).success).toBe(false)
  })
})
