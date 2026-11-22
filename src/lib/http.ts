import { z } from "zod"

/** A request that can't be served as sent, with the status and message to answer. */
export class RequestProblem extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function problem(status: number, message: string): Response {
  return Response.json({ error: message }, { status })
}

/**
 * Runs a route's work, answering a RequestProblem with its status and anything else with
 * a 500 that gives nothing away (the error goes to the server's log).
 */
export async function respond(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work()
  } catch (error) {
    if (error instanceof RequestProblem) return problem(error.status, error.message)
    console.error(error)
    return problem(500, "The dashboard's server had a problem")
  }
}

/** The body as it came, at most `maxBytes` long: a picture. */
export async function readBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > maxBytes) throw new RequestProblem(413, "Too much to send")
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length > maxBytes) throw new RequestProblem(413, "Too much to send")
  return bytes
}

/** The body as JSON checked against `schema`; at most `maxBytes` long. */
export async function readBody<T>(request: Request, schema: z.ZodType<T>, maxBytes: number): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > maxBytes) throw new RequestProblem(413, "Too much to send")
  const text = await request.text()
  if (new TextEncoder().encode(text).length > maxBytes) throw new RequestProblem(413, "Too much to send")
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new RequestProblem(400, "The request isn't JSON")
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new RequestProblem(400, z.prettifyError(parsed.error))
  return parsed.data
}
