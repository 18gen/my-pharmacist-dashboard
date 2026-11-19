/** Times as the laptop showing the dashboard sees them. */

const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })

/** "2:05 PM", in this computer's time zone. */
export function localTime(instant: string): string {
  return clock.format(new Date(instant))
}

/** "just now", "12 s ago", "4 min ago", "2 h ago", "3 days ago". */
export function ago(instant: string, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(instant)) / 1000))
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds} s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}
