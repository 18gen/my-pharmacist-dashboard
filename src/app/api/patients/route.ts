import { clientAddress, isApp, isDashboard } from "@/lib/auth"
import { problem, readBody, RequestProblem, respond } from "@/lib/http"
import { type Patient, patientStore } from "@/lib/patients"
import { allow } from "@/lib/rate-limit"
import { joinSchema, limits } from "@/lib/snapshot"

/** People whose phone sent nothing for this long are removed when the dashboard next looks. */
const idleDays = 14
const day = 24 * 60 * 60 * 1000

/** POST /api/patients (the app): starts sharing under a name. Answers 201 {id}. */
export async function POST(request: Request): Promise<Response> {
  return respond(async () => {
    if (!isApp(request)) return problem(401, "Not allowed")
    if (!(await allow("join", clientAddress(request)))) {
      throw new RequestProblem(429, "Too many people joined from here; try again in a minute")
    }
    const { name } = await readBody(request, joinSchema, 4 * 1024)
    const store = patientStore()
    if ((await store.count()) >= limits.patients) {
      throw new RequestProblem(409, "The demo is full; reset it from the dashboard")
    }
    const now = new Date().toISOString()
    const patient: Patient = { id: crypto.randomUUID(), name, joinedAt: now, updatedAt: now, snapshot: null }
    await store.put(patient)
    return Response.json({ id: patient.id }, { status: 201 })
  })
}

/**
 * GET /api/patients (the dashboard): everyone sharing, as {patients}. The ETag changes
 * with every change, and at least once a day so idle people are cleared; a poll sending
 * the same one back gets 304 with no body.
 */
export async function GET(request: Request): Promise<Response> {
  return respond(async () => {
    if (!isDashboard(request)) return problem(401, "Not allowed")
    const store = patientStore()
    const tag = (version: number) => `"${version}.${Math.floor(Date.now() / day)}"`
    const headers = (version: number) => ({ ETag: tag(version), "Cache-Control": "no-cache" })

    const version = await store.version()
    if (request.headers.get("if-none-match") === tag(version)) {
      return new Response(null, { status: 304, headers: headers(version) })
    }

    const cutoff = Date.now() - idleDays * day
    const everyone = await store.all()
    const idle = everyone.filter((patient) => Date.parse(patient.updatedAt) < cutoff)
    if (idle.length > 0) await store.remove(idle.map((patient) => patient.id))
    const patients = everyone.filter((patient) => !idle.includes(patient))
    return Response.json({ patients }, { headers: headers(idle.length > 0 ? await store.version() : version) })
  })
}
