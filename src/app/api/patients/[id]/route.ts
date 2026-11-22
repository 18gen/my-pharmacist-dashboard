import { isApp, isDashboard } from "@/lib/auth"
import { problem, readBody, RequestProblem, respond } from "@/lib/http"
import { patientStore } from "@/lib/patients"
import { photoStore } from "@/lib/photos"
import { allow } from "@/lib/rate-limit"
import { limits, snapshotSchema } from "@/lib/snapshot"

/**
 * PUT /api/patients/:id (the app): the phone's whole state, replacing what it sent
 * before. 404 once the person is gone (the demo was reset, or they were removed): the
 * phone then stops sharing.
 */
export async function PUT(request: Request, context: RouteContext<"/api/patients/[id]">): Promise<Response> {
  return respond(async () => {
    if (!isApp(request)) return problem(401, "Not allowed")
    const { id } = await context.params
    if (!(await allow("write", id))) throw new RequestProblem(429, "Too many updates; try again in a minute")
    const snapshot = await readBody(request, snapshotSchema, limits.snapshotBytes)
    const store = patientStore()
    const patient = await store.get(id)
    if (!patient) throw new RequestProblem(404, "Not sharing: the demo was reset or this person was removed")
    await store.put({ ...patient, snapshot, updatedAt: new Date().toISOString() })
    return new Response(null, { status: 204 })
  })
}

/**
 * DELETE /api/patients/:id: the phone stops sharing, or the dashboard removes someone,
 * with their pictures. 204 even if they were already gone.
 */
export async function DELETE(request: Request, context: RouteContext<"/api/patients/[id]">): Promise<Response> {
  return respond(async () => {
    if (!isApp(request) && !isDashboard(request)) return problem(401, "Not allowed")
    const { id } = await context.params
    await patientStore().remove([id])
    await photoStore().removePatients([id])
    return new Response(null, { status: 204 })
  })
}
