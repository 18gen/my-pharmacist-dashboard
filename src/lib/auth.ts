import { createHmac } from "node:crypto"

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

/**
 * A secret as set, without spaces or line breaks around it: a value pasted into Vercel
 * with the newline `openssl rand -hex 32 | pbcopy` copies would otherwise refuse
 * everyone, as the app and the dashboard send theirs trimmed.
 */
function secret(name: "APP_TOKEN" | "DASHBOARD_KEY"): string {
  return (process.env[name] ?? "").trim()
}

export function isApp(request: Request): boolean {
  return sameSecret(request.headers.get("x-app-token") ?? "", secret("APP_TOKEN"))
}

export function isDashboard(request: Request): boolean {
  const header = request.headers.get("authorization") ?? ""
  const key = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : ""
  return sameSecret(key, secret("DASHBOARD_KEY"))
}

/**
 * What lets the dashboard's <img> tags load one person's scanned pictures, which can't
 * carry the key in a header: a signature of the person's ID made with the dashboard's key,
 * handed out with the list (GET /api/patients) and checked by the picture route. It works
 * until the person is gone (Reset demo, stop sharing); empty without a key.
 */
export function photoToken(patientId: string): string {
  const key = secret("DASHBOARD_KEY")
  if (!key) return ""
  return createHmac("sha256", key).update(`photos:${patientId}`).digest("base64url")
}

export function isPhotoToken(patientId: string, token: string): boolean {
  return sameSecret(token, photoToken(patientId))
}

/** The caller's network address, as Vercel passes it on; "unknown" without one. */
export function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}
