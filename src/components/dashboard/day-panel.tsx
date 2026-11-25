"use client"

import { Pin, X } from "lucide-react"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { DayEvent } from "@/lib/board"
import { cn } from "@/lib/utils"

import { CautionTriangle, CheckCircle, CrossCircle, EmptyBox, QuestionCircle, TickedBox } from "./glyphs"

/** What the panel shows: a person's day, or nothing chosen yet. */
export interface OpenDay {
  name: string
  /** "Today, Saturday, Nov 21". */
  day: string
  /** "Saturday", or "today": for "Helen’s Saturday comes back". */
  weekday: string
  events: DayEvent[]
  /** Said when there are no events: why the day is quiet. */
  quiet: string
}

/**
 * What happened on a day, for one person, in the order it happened: the day pointed at
 * ("preview"), else the day clicked ("pinned"), which stays when the pointer leaves. Beside
 * the table, or under it on a narrow screen, where a newly pinned day scrolls into view
 * (never a pointed-at one, so moving the mouse doesn't move the page).
 */
export function DayPanel({
  open,
  mode,
  kept,
  pinnedKey,
  onClose,
  className,
}: {
  open: OpenDay | null
  mode: "preview" | "pinned"
  /** While previewing: the pinned day that comes back, "Helen’s Sunday". */
  kept: string | null
  /** Changes when another day is pinned. */
  pinnedKey: string | null
  onClose: () => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!pinnedKey || !ref.current || !window.matchMedia("(max-width: 1023px)").matches) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ref.current.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" })
  }, [pinnedKey])

  return (
    <Card
      ref={ref}
      aria-label={open ? `What happened: ${open.name}, ${open.day}` : "What happened"}
      className={cn("gap-2 rounded-3xl py-5 ring-edge shadow-[0_2px_3px_rgba(33,20,15,0.10)]", className)}
    >
      {open ? (
        <>
          <CardHeader className="px-5">
            <CardTitle className="flex flex-wrap items-center gap-2 font-sans text-[22px] leading-tight font-bold">
              {open.name}
              {mode === "preview" ? (
                <span className="inline-flex h-6 items-center rounded-full bg-secondary px-2.5 text-[13px] font-semibold text-muted-foreground">
                  Preview
                </span>
              ) : (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-primary px-2.5 text-[13px] font-semibold text-primary-foreground">
                  <Pin aria-hidden strokeWidth={2.6} className="size-3" />
                  Pinned
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">{open.day}</CardDescription>
            {mode === "pinned" && (
              <CardAction>
                <Button variant="secondary" size="icon-lg" onClick={onClose} aria-label="Unpin this day" className="rounded-full">
                  <X aria-hidden strokeWidth={3} className="size-3.5" />
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-5">
            {open.events.length > 0 ? (
              <ul className="flex flex-col">
                {open.events.map((event, index) => (
                  <li key={event.key} className={cn("flex items-start gap-2.5 py-2.5", index > 0 && "border-t border-border")}>
                    <Icon tone={event.tone} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-base leading-snug">{event.text}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">{event.time}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-1.5 text-base text-muted-foreground">{open.quiet}</p>
            )}
            <p className="border-t border-border pt-3 text-sm leading-snug text-muted-foreground">
              {mode === "preview" ? (
                kept ? (
                  `Click to keep this day here. Move away and ${kept} comes back.`
                ) : (
                  "Click the day to keep it here."
                )
              ) : (
                <>
                  <span className="pointer-coarse:hidden">Stays here when you move away. Click the day again, or the ×, to close it.</span>
                  <span className="hidden pointer-coarse:inline">Tap the day again, or the ×, to close it.</span>
                </>
              )}
            </p>
          </CardContent>
        </>
      ) : (
        <CardContent className="px-5">
          <p className="text-[17px] leading-snug text-muted-foreground">
            <span className="pointer-coarse:hidden">Point at a day in someone&apos;s row to see what happened. Click it to keep it here.</span>
            <span className="hidden pointer-coarse:inline">Tap a day in someone&apos;s row to see what happened.</span>
          </p>
        </CardContent>
      )}
    </Card>
  )
}

function Icon({ tone }: { tone: DayEvent["tone"] }) {
  const size = "mt-0.5 size-5 shrink-0"
  switch (tone) {
    case "scanned":
      return <CheckCircle className={cn(size, "text-ok")} />
    case "ticked":
      return <TickedBox className={cn(size, "text-ok")} />
    case "dont":
      return <CrossCircle className={cn(size, "text-danger")} />
    case "unknown":
      return <QuestionCircle className={cn(size, "text-danger")} />
    case "asNeeded":
      return <CautionTriangle className={cn(size, "text-caution")} />
    case "missed":
      return <EmptyBox className={cn(size, "text-late")} />
  }
}
