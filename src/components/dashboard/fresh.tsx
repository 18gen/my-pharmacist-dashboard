"use client"

import { createContext, useContext, useState } from "react"

import type { PersonBoard } from "@/lib/board"

/**
 * What appeared since the dashboard last looked, so it can glow once:
 * - a person's name when they start sharing;
 * - a box when what it shows changed (a scan, a tick, the app's warning).
 * Nothing glows on the first load. A box's key includes what it shows, so a change
 * remounts it, and it decides when it mounts whether to glow.
 */
export interface Fresh {
  people: ReadonlySet<string>
  cells: ReadonlySet<string>
}

interface Keys {
  people: Set<string>
  cells: Set<string>
}

const nothing: Fresh = { people: new Set(), cells: new Set() }
const FreshContext = createContext<Fresh>(nothing)

export const FreshProvider = FreshContext.Provider

/** A box's key, unique across people. */
export function cellKey(personID: string, key: string): string {
  return `${personID}|${key}`
}

export function keysOf(people: PersonBoard[]): Keys {
  const cells = new Set<string>()
  for (const person of people) {
    for (const row of person.rows) for (const cell of row.cells) cells.add(cellKey(person.id, cell.key))
  }
  return { people: new Set(people.map((person) => person.id)), cells }
}

/** Compares each new set of keys with the one before ("storing information from previous renders"). */
export function useFresh(keys: Keys | null): Fresh {
  const [previous, setPrevious] = useState<Keys | null>(null)
  const [fresh, setFresh] = useState<Fresh>(nothing)
  if (keys && keys !== previous) {
    setPrevious(keys)
    setFresh(previous ? difference(previous, keys) : nothing)
  }
  return fresh
}

function difference(before: Keys, after: Keys): Fresh {
  const people = new Set([...after.people].filter((id) => !before.people.has(id)))
  const cells = new Set(
    [...after.cells].filter((key) => !before.cells.has(key) && !people.has(key.slice(0, key.indexOf("|")))),
  )
  return { people, cells }
}

/** Whether this person's name, or this box, glows: decided once, when it appears. */
export function useGlow(kind: "person" | "cell", key: string): boolean {
  const fresh = useContext(FreshContext)
  const [glows] = useState(() => (kind === "person" ? fresh.people : fresh.cells).has(key))
  return glows
}
