import { isDashboard } from "@/lib/auth"
import { problem, respond } from "@/lib/http"
import { patientStore } from "@/lib/patients"
import { photoStore } from "@/lib/photos"

/** POST /api/reset (the dashboard): removes everyone and their pictures, for the next demo. */
export async function POST(request: Request): Promise<Response> {
  return respond(async () => {
    if (!isDashboard(request)) return problem(401, "Not allowed")
    const store = patientStore()
    const ids = (await store.all()).map((patient) => patient.id)
    await store.removeAll()
    await photoStore().removePatients(ids)
    return new Response(null, { status: 204 })
  })
}
