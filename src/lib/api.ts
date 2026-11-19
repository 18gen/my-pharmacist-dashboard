import type { Patient } from "@/lib/patients"

/** The server didn't accept the dashboard's key. */
export class KeyRejected extends Error {
  constructor() {
    super("The dashboard key wasn't accepted")
  }
}

/** The last list and its ETag: a poll sends the tag back, and a 304 means it still holds. */
let last: { key: string; etag: string; patients: Patient[] } | null = null

function headers(key: string): Record<string, string> {
  return { authorization: `Bearer ${key}` }
}

async function check(response: Response): Promise<Response> {
  if (response.status === 401) throw new KeyRejected()
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `The server answered ${response.status}`)
  }
  return response
}

/** Everyone sharing. Cheap to call every couple of seconds: unchanged lists come back as 304. */
export async function fetchPatients(key: string, signal?: AbortSignal): Promise<Patient[]> {
  const request = headers(key)
  if (last?.key === key) request["if-none-match"] = last.etag
  // "no-store" leaves the ETag to this code, so a 304 arrives here as a 304.
  const response = await fetch("/api/patients", { headers: request, cache: "no-store", signal })
  if (response.status === 304 && last?.key === key) return last.patients
  await check(response)
  const { patients } = (await response.json()) as { patients: Patient[] }
  const etag = response.headers.get("etag")
  last = etag ? { key, etag, patients } : null
  return patients
}

/** Removes everyone, for the next demo. */
export async function resetDemo(key: string): Promise<void> {
  await check(await fetch("/api/reset", { method: "POST", headers: headers(key) }))
}

/** Removes one person; their phone stops sharing the next time it sends. */
export async function removePatient(key: string, id: string): Promise<void> {
  await check(await fetch(`/api/patients/${encodeURIComponent(id)}`, { method: "DELETE", headers: headers(key) }))
}
