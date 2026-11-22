/**
 * Fills a local dashboard with the sample people, as if five phones had joined, with the
 * pictures of their scans (scripts/fixtures):
 *   npm run seed:local                          (http://localhost:3000)
 *   npm run seed:local -- http://localhost:3019
 * It resets the demo first, so it only talks to this computer, never a deployed dashboard.
 * The keys come from .env.local. Run it from the project's folder, as npm does.
 */
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { type SamplePhoto, samplePeople } from "./sample-people"

const base = new URL(process.argv[2] ?? "http://localhost:3000")
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  console.error(`Only seeds a dashboard on this computer, not ${base.origin}: it resets everyone first.`)
  process.exit(1)
}

try {
  process.loadEnvFile(".env.local")
} catch {
  // Already in the environment, or no .env.local: checked below.
}
const appToken = process.env.APP_TOKEN
const dashboardKey = process.env.DASHBOARD_KEY
if (!appToken || !dashboardKey) {
  console.error("Set APP_TOKEN and DASHBOARD_KEY in .env.local (see .env.example).")
  process.exit(1)
}

async function call(path: string, method: string, headers: Record<string, string>, body?: unknown): Promise<Response> {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${method} ${path} answered ${response.status}: ${await response.text()}`)
  return response
}

/** Sends a scan's picture as the app does: the JPEG itself, before the snapshot that names it. */
async function sendPhoto(id: string, photo: SamplePhoto, appToken: string): Promise<void> {
  const jpeg = await readFile(join(process.cwd(), "scripts", "fixtures", `${photo.fixture}.jpg`))
  const path = `/api/patients/${id}/photos/${photo.photoId}`
  const response = await fetch(new URL(path, base), {
    method: "PUT",
    headers: { "content-type": "image/jpeg", "x-app-token": appToken },
    body: jpeg,
  })
  if (!response.ok) throw new Error(`PUT ${path} answered ${response.status}: ${await response.text()}`)
}

async function main(appToken: string, dashboardKey: string): Promise<void> {
  const asApp = { "x-app-token": appToken }
  await call("/api/reset", "POST", { authorization: `Bearer ${dashboardKey}` })
  for (const person of samplePeople(new Date())) {
    const joined = await call("/api/patients", "POST", asApp, { name: person.name })
    const { id } = (await joined.json()) as { id: string }
    for (const photo of person.photos) await sendPhoto(id, photo, appToken)
    if (person.snapshot) await call(`/api/patients/${id}`, "PUT", asApp, person.snapshot)
    const pictures = person.photos.length > 0 ? `, with ${person.photos.length} scan pictures` : ""
    console.log(`${person.name}: ${person.snapshot ? `sent a week${pictures}` : "joined, nothing sent yet"}`)
  }
  console.log(`Open ${new URL(`/#key=${encodeURIComponent(dashboardKey)}`, base)}`)
}

main(appToken, dashboardKey).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
