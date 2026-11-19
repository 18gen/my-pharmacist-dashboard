"use client"

import { createContext, useContext, useState } from "react"

import type { PatientCard } from "@/lib/card"

/**
 * What appeared since the dashboard last looked, so it can glow once:
 * - a whole card when someone new starts sharing;
 * - a cell or a line of "What happened" when it changed for someone already there.
 * Nothing glows on the first load. A cell's key includes its state, so a change
 * remounts it, and it decides when it mounts whether to glow.
 */
export interface Fresh {
  patients: ReadonlySet<string>
  items: ReadonlySet<string>
}

interface Keys {
  patients: Set<string>
  items: Set<string>
}

const nothing: Fresh = { patients: new Set(), items: new Set() }
const FreshContext = createContext<Fresh>(nothing)

export const FreshProvider = FreshContext.Provider

/** A key for an item on a patient's card, unique across cards. */
export function itemKey(patientID: string, key: string): string {
  return `${patientID}|${key}`
}

export function keysOf(cards: PatientCard[]): Keys {
  const items = new Set<string>()
  for (const card of cards) {
    for (const medication of card.medications) {
      for (const row of medication.rows) for (const cell of row.cells) items.add(itemKey(card.id, cell.key))
    }
    for (const line of card.happenings) items.add(itemKey(card.id, line.key))
  }
  return { patients: new Set(cards.map((card) => card.id)), items }
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
  const patients = new Set([...after.patients].filter((id) => !before.patients.has(id)))
  const items = new Set(
    [...after.items].filter((key) => !before.items.has(key) && !patients.has(key.slice(0, key.indexOf("|")))),
  )
  return { patients, items }
}

/** Whether this card, or this item, glows: decided once, when it appears. */
export function useGlow(kind: "patient" | "item", key: string): boolean {
  const fresh = useContext(FreshContext)
  const [glows] = useState(() => (kind === "patient" ? fresh.patients : fresh.items).has(key))
  return glows
}
