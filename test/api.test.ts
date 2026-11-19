import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { DELETE, PUT } from "@/app/api/patients/[id]/route"
import { GET, POST } from "@/app/api/patients/route"
import { POST as reset } from "@/app/api/reset/route"
import type { Patient } from "@/lib/patients"
import { limits } from "@/lib/snapshot"

import { sampleSnapshot } from "./fixtures"

// No Redis variables are set here, so the routes use the in-memory store.
const appToken = "test-app-token"
const dashboardKey = "test-dashboard-key"
const base = "http://localhost/api"

const asApp = { "x-app-token": appToken }
const asDashboard = { authorization: `Bearer ${dashboardKey}` }

function request(path: string, method: string, headers: Record<string, string>, body?: unknown): Request {
  return new Request(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  })
}

function context(id: string): RouteContext<"/api/patients/[id]"> {
  return { params: Promise.resolve({ id }) }
}

async function join(name: string): Promise<string> {
  const response = await POST(request("/patients", "POST", asApp, { name }))
  expect(response.status).toBe(201)
  const { id } = (await response.json()) as { id: string }
  return id
}

async function everyone(): Promise<Patient[]> {
  const response = await GET(request("/patients", "GET", asDashboard))
  expect(response.status).toBe(200)
  return ((await response.json()) as { patients: Patient[] }).patients
}

beforeAll(() => {
  process.env.APP_TOKEN = appToken
  process.env.DASHBOARD_KEY = dashboardKey
})

beforeEach(async () => {
  expect((await reset(request("/reset", "POST", asDashboard))).status).toBe(204)
})

describe("joining", () => {
  it("needs the app's token", async () => {
    expect((await POST(request("/patients", "POST", {}, { name: "Maria" }))).status).toBe(401)
    expect((await POST(request("/patients", "POST", { "x-app-token": "wrong" }, { name: "Maria" }))).status).toBe(401)
  })

  it("gives each person their own ID, even with the same name", async () => {
    const first = await join("Maria")
    const second = await join(" Maria ")
    expect(first).not.toBe(second)
    const patients = await everyone()
    expect(patients.map((patient) => patient.name)).toEqual(["Maria", "Maria"])
    expect(patients.every((patient) => patient.snapshot === null)).toBe(true)
  })

  it("rejects a missing name and a body that isn't JSON", async () => {
    expect((await POST(request("/patients", "POST", asApp, { name: "" }))).status).toBe(400)
    expect((await POST(request("/patients", "POST", asApp, "{not json"))).status).toBe(400)
  })

  it("stops when the demo is full", async () => {
    for (let index = 0; index < limits.patients; index += 1) await join(`Person ${index}`)
    expect((await POST(request("/patients", "POST", asApp, { name: "One more" }))).status).toBe(409)
  })
})

describe("sending a snapshot", () => {
  it("keeps the latest one", async () => {
    const id = await join("Maria")
    expect((await PUT(request(`/patients/${id}`, "PUT", asApp, sampleSnapshot()), context(id))).status).toBe(204)
    const [maria] = await everyone()
    expect(maria?.snapshot).toEqual(sampleSnapshot())
  })

  it("rejects a snapshot that doesn't fit the format", async () => {
    const id = await join("Maria")
    const response = await PUT(request(`/patients/${id}`, "PUT", asApp, { ...sampleSnapshot(), v: 2 }), context(id))
    expect(response.status).toBe(400)
  })

  it("rejects one that is too big", async () => {
    const id = await join("Maria")
    const tooBig = JSON.stringify({ ...sampleSnapshot(), padding: "x".repeat(limits.snapshotBytes) })
    expect((await PUT(request(`/patients/${id}`, "PUT", asApp, tooBig), context(id))).status).toBe(413)
  })

  it("answers 404 once the demo was reset, so the phone stops sharing", async () => {
    const id = await join("Maria")
    await reset(request("/reset", "POST", asDashboard))
    expect((await PUT(request(`/patients/${id}`, "PUT", asApp, sampleSnapshot()), context(id))).status).toBe(404)
  })

  it("needs the app's token", async () => {
    const id = await join("Maria")
    expect((await PUT(request(`/patients/${id}`, "PUT", asDashboard, sampleSnapshot()), context(id))).status).toBe(401)
  })
})

describe("the dashboard's list", () => {
  it("needs the dashboard's key", async () => {
    expect((await GET(request("/patients", "GET", {}))).status).toBe(401)
    expect((await GET(request("/patients", "GET", asApp))).status).toBe(401)
  })

  it("answers 304 until something changes", async () => {
    await join("Maria")
    const first = await GET(request("/patients", "GET", asDashboard))
    const tag = first.headers.get("etag")
    expect(tag).toBeTruthy()

    const same = await GET(request("/patients", "GET", { ...asDashboard, "if-none-match": tag ?? "" }))
    expect(same.status).toBe(304)

    await join("Ken")
    const changed = await GET(request("/patients", "GET", { ...asDashboard, "if-none-match": tag ?? "" }))
    expect(changed.status).toBe(200)
    expect(changed.headers.get("etag")).not.toBe(tag)
  })
})

describe("removing", () => {
  it("lets the phone or the dashboard remove someone", async () => {
    const maria = await join("Maria")
    const ken = await join("Ken")
    expect((await DELETE(request(`/patients/${maria}`, "DELETE", asApp), context(maria))).status).toBe(204)
    expect((await DELETE(request(`/patients/${ken}`, "DELETE", asDashboard), context(ken))).status).toBe(204)
    expect(await everyone()).toEqual([])
  })

  it("answers 204 for someone already gone, and 401 without a token or key", async () => {
    const id = crypto.randomUUID()
    expect((await DELETE(request(`/patients/${id}`, "DELETE", asApp), context(id))).status).toBe(204)
    expect((await DELETE(request(`/patients/${id}`, "DELETE", {}), context(id))).status).toBe(401)
  })

  it("resets only with the dashboard's key", async () => {
    await join("Maria")
    expect((await reset(request("/reset", "POST", asApp))).status).toBe(401)
    expect(await everyone()).toHaveLength(1)
  })
})
