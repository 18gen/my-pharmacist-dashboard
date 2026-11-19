/**
 * The dashboard's key, kept in this browser. Opening the dashboard with "#key=…" keeps
 * the key and takes it out of the address, so it isn't left on screen or in history.
 * Without one, the page asks for it. Browser storage may be blocked (a private window);
 * then the key is kept until the page is closed.
 */

const storageKey = "my-pharmacist.dashboard-key"
const changeEvent = "my-pharmacist:dashboard-key"

let unstored: string | null = null
let linkRead = false

function keyFromLink(): void {
  if (linkRead) return
  linkRead = true
  const match = /(?:^#|&)key=([^&]+)/.exec(window.location.hash)
  if (!match?.[1]) return
  store(decodeURIComponent(match[1]))
  window.history.replaceState(null, "", window.location.pathname + window.location.search)
}

function store(key: string | null): void {
  try {
    if (key === null) window.localStorage.removeItem(storageKey)
    else window.localStorage.setItem(storageKey, key)
    unstored = null
  } catch {
    unstored = key
  }
}

/** The key, or null when there is none yet. */
export function currentKey(): string | null {
  keyFromLink()
  try {
    return window.localStorage.getItem(storageKey) ?? unstored
  } catch {
    return unstored
  }
}

export function saveKey(key: string): void {
  store(key.trim())
  window.dispatchEvent(new Event(changeEvent))
}

/** For useSyncExternalStore: calls back when the key changes here or in another tab. */
export function subscribeToKey(onChange: () => void): () => void {
  window.addEventListener(changeEvent, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(changeEvent, onChange)
    window.removeEventListener("storage", onChange)
  }
}
