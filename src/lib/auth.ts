/**
 * Who may call the API. Not accounts: the app sends one shared token, and the dashboard
 * one shared key, both set as environment variables.
 * - APP_TOKEN: the iOS app, in the X-App-Token header (as the pill-check server does).
 * - DASHBOARD_KEY: the dashboard, as "Authorization: Bearer <key>".
 */

/** Compares in time that doesn't depend on where they differ. False when `expected` is empty. */
export function sameSecret(given: string, expected: string): boolean {
  const encoder = new TextEncoder()
  const a = encoder.encode(given)
  const b = encoder.encode(expected)
  let difference = a.length ^ b.length
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0)
  }
  return difference === 0 && expected.length > 0
}

export function isApp(request: Request): boolean {
  return sameSecret(request.headers.get("x-app-token") ?? "", process.env.APP_TOKEN ?? "")
}

export function isDashboard(request: Request): boolean {
  const header = request.headers.get("authorization") ?? ""
  const key = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : ""
  return sameSecret(key, process.env.DASHBOARD_KEY ?? "")
}

/** The caller's network address, as Vercel passes it on; "unknown" without one. */
export function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}
