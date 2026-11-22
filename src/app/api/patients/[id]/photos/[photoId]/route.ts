import { isApp, isPhotoToken } from "@/lib/auth"
import { problem, readBytes, RequestProblem, respond } from "@/lib/http"
import { patientStore } from "@/lib/patients"
import { isJpeg, isPhotoId, photoLimits, photoStore } from "@/lib/photos"
import { allow } from "@/lib/rate-limit"

/**
 * PUT /api/patients/:id/photos/:photoId (the app): the picture of one scanned pill, as a
 * small JPEG. The phone sends it before the snapshot that names it. 404 once the person
 * is gone, as for snapshots.
 */
export async function PUT(
  request: Request,
  context: RouteContext<"/api/patients/[id]/photos/[photoId]">,
): Promise<Response> {
  return respond(async () => {
    if (!isApp(request)) return problem(401, "Not allowed")
    const { id, photoId } = await context.params
    if (!isPhotoId(photoId)) throw new RequestProblem(400, "Expected a picture ID like a UUID")
    if (!(await allow("photo", id))) throw new RequestProblem(429, "Too many pictures; try again in a minute")
    const jpeg = await readBytes(request, photoLimits.bytes)
    if (!isJpeg(jpeg)) throw new RequestProblem(400, "Expected a JPEG picture")
    if (!(await patientStore().get(id))) {
      throw new RequestProblem(404, "Not sharing: the demo was reset or this person was removed")
    }
    const photos = photoStore()
    if ((await photos.count(id)) >= photoLimits.perPatient) {
      throw new RequestProblem(409, "This person has as many pictures as the demo keeps")
    }
    await photos.put(id, photoId.toLowerCase(), jpeg)
    return new Response(null, { status: 204 })
  })
}

/**
 * GET /api/patients/:id/photos/:photoId?t=… (the dashboard's <img>): the picture, with
 * the person's photo token from the list. A picture never changes, so it is cached.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/patients/[id]/photos/[photoId]">,
): Promise<Response> {
  return respond(async () => {
    const { id, photoId } = await context.params
    const token = new URL(request.url).searchParams.get("t") ?? ""
    if (!isPhotoToken(id, token)) return problem(401, "Not allowed")
    const jpeg = isPhotoId(photoId) ? await photoStore().get(id, photoId.toLowerCase()) : null
    if (!jpeg) return problem(404, "No such picture")
    return new Response(jpeg, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "private, max-age=604800, immutable",
        "x-content-type-options": "nosniff",
      },
    })
  })
}
