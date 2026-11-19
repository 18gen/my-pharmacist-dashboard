"use client"

import { CircleCheck, CircleX, OctagonAlert } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { Happening, Tone } from "@/lib/card"
import { cn } from "@/lib/utils"

import { itemKey, useGlow } from "./fresh"

/** How many lines show before "Show all". */
const shownAtFirst = 6

const icons: Record<Tone, { icon: typeof CircleCheck; className: string }> = {
  ok: { icon: CircleCheck, className: "text-ok" },
  danger: { icon: CircleX, className: "text-danger" },
  caution: { icon: OctagonAlert, className: "text-caution" },
}

/** The newest things first: doses taken today, missed doses, and what the app said not to take. */
export function WhatHappened({ patientID, happenings }: { patientID: string; happenings: Happening[] }) {
  const [showsAll, setShowsAll] = useState(false)
  const shown = showsAll ? happenings : happenings.slice(0, shownAtFirst)
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">What happened</h3>
      {happenings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {shown.map((happening) => (
            <Line key={happening.key} happening={happening} glowKey={itemKey(patientID, happening.key)} />
          ))}
        </ol>
      )}
      {happenings.length > shownAtFirst && (
        <Button variant="link" size="sm" className="self-start px-0" onClick={() => setShowsAll(!showsAll)}>
          {showsAll ? "Show fewer" : `Show all ${happenings.length}`}
        </Button>
      )}
    </section>
  )
}

function Line({ happening, glowKey }: { happening: Happening; glowKey: string }) {
  const glows = useGlow("item", glowKey)
  const { icon: Icon, className } = icons[happening.tone]
  return (
    <li className={cn("flex items-start gap-3 rounded-md px-2 py-1.5 text-sm", glows && "motion-safe:animate-fresh")}>
      <span className="w-24 shrink-0 pt-px text-muted-foreground tabular-nums">{happening.when}</span>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", className)} />
      <div className="min-w-0">
        <p className="font-medium">{happening.title}</p>
        {happening.detail && <p className="text-muted-foreground">{happening.detail}</p>}
      </div>
    </li>
  )
}
