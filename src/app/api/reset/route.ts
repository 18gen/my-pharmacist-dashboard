import { isDashboard } from "@/lib/auth"
import { problem, respond } from "@/lib/http"
import { patientStore } from "@/lib/patients"

/** POST /api/reset (the dashboard): removes everyone, for the next demo. */
export async function POST(request: Request): Promise<Response> {
  return respond(async () => {
    if (!isDashboard(request)) return problem(401, "Not allowed")
    await patientStore().removeAll()
    return new Response(null, { status: 204 })
  })
}
