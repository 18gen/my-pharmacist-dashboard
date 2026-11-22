/**
 * The app's sample medications have photos of their tablets built in; the dashboard
 * carries copies (public/pills, from the app's Assets), so each row can show the pill it
 * expects beside the one that was scanned. Medications people add themselves have photos
 * only on their phone, which are never sent: their rows show a plain tablet.
 */
const samplePills = new Set([
  "allopurinol-300",
  "capecitabine-500",
  "dexamethasone-1-5",
  "dexamethasone-4",
  "exemestane-25",
  "metoclopramide-10",
  "ondansetron-8",
])

/** "/pills/capecitabine-500.png" for a sample medication; null for any other. */
export function pillPicture(medicationId: string | null): string | null {
  return medicationId && samplePills.has(medicationId) ? `/pills/${medicationId}.png` : null
}

/** Where the dashboard loads a scanned pill's picture: the photo route, with the person's token. */
export function scanPicture(patientId: string, photoId: string, photoToken: string): string {
  return `/api/patients/${encodeURIComponent(patientId)}/photos/${encodeURIComponent(photoId)}?t=${encodeURIComponent(photoToken)}`
}
