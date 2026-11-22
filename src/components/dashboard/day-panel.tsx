"use client"

import { X } from "lucide-react"
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
  events: DayEvent[]
  /** Said when there are no events: why the day is quiet. */
  quiet: string
}

/**
 * What happened on the day clicked, for that person, in the order it happened: beside the
 * table, or under it on a narrow screen, where it scrolls into view when a day is opened.
 */
export function DayPanel({ open, onClose, className }: { open: OpenDay | null; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const which = open ? `${open.name}|${open.day}` : null
  useEffect(() => {
    if (!which || !ref.current || !window.matchMedia("(max-width: 1023px)").matches) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ref.current.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" })
  }, [which])

  return (
    <Card
      ref={ref}
      aria-label={open ? `What happened: ${open.name}, ${open.day}` : "What happened"}
      className={cn("gap-2 rounded-3xl py-5 ring-edge shadow-[0_2px_3px_rgba(33,20,15,0.10)]", className)}
    >
      {open ? (
        <>
          <CardHeader className="px-5">
            <CardTitle className="font-sans text-[22px] leading-tight font-bold">{open.name}</CardTitle>
            <CardDescription className="text-base text-muted-foreground">{open.day}</CardDescription>
            <CardAction>
              <Button variant="secondary" size="icon-lg" onClick={onClose} aria-label="Close" className="rounded-full">
                <X aria-hidden strokeWidth={3} className="size-3.5" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-5">
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
          </CardContent>
        </>
      ) : (
        <CardContent className="px-5">
          <p className="text-[17px] leading-snug text-muted-foreground">Click a day in someone&apos;s row to see what happened.</p>
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
