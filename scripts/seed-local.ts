/**
 * Fills a local dashboard with the sample people, as if four phones had joined:
 *   npm run seed:local                          (http://localhost:3000)
 *   npm run seed:local -- http://localhost:3019
 * It resets the demo first, so it only talks to this computer, never a deployed dashboard.
 * The keys come from .env.local.
 */
import { samplePeople } from "./sample-people"

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

async function main(appToken: string, dashboardKey: string): Promise<void> {
  const asApp = { "x-app-token": appToken }
  await call("/api/reset", "POST", { authorization: `Bearer ${dashboardKey}` })
  for (const person of samplePeople(new Date())) {
    const joined = await call("/api/patients", "POST", asApp, { name: person.name })
    const { id } = (await joined.json()) as { id: string }
    if (person.snapshot) await call(`/api/patients/${id}`, "PUT", asApp, person.snapshot)
    console.log(`${person.name}: ${person.snapshot ? "sent a week" : "joined, nothing sent yet"}`)
  }
  console.log(`Open ${new URL(`/#key=${encodeURIComponent(dashboardKey)}`, base)}`)
}

main(appToken, dashboardKey).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
