"use client"

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PatientCard as Card_, Today } from "@/lib/card"
import { ago, localTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { ConfirmAction } from "./confirm-action"
import { useGlow } from "./fresh"
import { WeekGrid } from "./week-grid"
import { WhatHappened } from "./what-happened"

/** One person sharing: today at a glance, their week, and what happened. */
export function PatientCard({ card, now, onRemove }: { card: Card_; now: Date; onRemove: (id: string) => void }) {
  const glows = useGlow("patient", card.id)
  return (
    <Card className={cn("gap-5", glows && "motion-safe:animate-fresh")}>
      <CardHeader>
        <CardTitle className="text-2xl">{card.name}</CardTitle>
        <CardDescription>
          Updated {ago(card.updatedAt, now)} · joined {localTime(card.joinedAt)}
        </CardDescription>
        <CardAction>
          <RemoveButton card={card} onRemove={onRemove} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <TodayLine today={card.today} />
        <WeekGrid patientID={card.id} columns={card.columns} medications={card.medications} />
        <WhatHappened patientID={card.id} happenings={card.happenings} />
      </CardContent>
    </Card>
  )
}

/** Someone who joined but whose phone hasn't sent its first update yet. */
export function WaitingCard({ card, onRemove }: { card: Card_; onRemove: (id: string) => void }) {
  const glows = useGlow("patient", card.id)
  return (
    <Card size="sm" className={cn("w-full sm:w-auto sm:min-w-80", glows && "motion-safe:animate-fresh")}>
      <CardHeader>
        <CardTitle className="text-lg">{card.name}</CardTitle>
        <CardDescription>Joined {localTime(card.joinedAt)} · nothing sent yet</CardDescription>
        <CardAction>
          <RemoveButton card={card} onRemove={onRemove} />
        </CardAction>
      </CardHeader>
    </Card>
  )
}

function RemoveButton({ card, onRemove }: { card: Card_; onRemove: (id: string) => void }) {
  return (
    <ConfirmAction
      label="Remove"
      variant="ghost"
      size="sm"
      title={`Remove ${card.name}?`}
      description="Their name and records are deleted from this page. Their phone shows that sharing stopped, and they can join again."
      confirm="Remove"
      onConfirm={() => onRemove(card.id)}
    />
  )
}

/** "Today: 3 taken · 1 due now · 1 told not to take". */
function TodayLine({ today }: { today: Today | null }) {
  if (!today) return <p className="text-sm text-muted-foreground">Nothing from today yet.</p>
  const parts: { text: string; className: string }[] = [
    { text: `${today.taken} taken`, className: "bg-ok-fill text-ok" },
  ]
  if (today.due > 0) parts.push({ text: `${today.due} due now`, className: "bg-due-fill text-due" })
  if (today.missed > 0) parts.push({ text: `${today.missed} missed`, className: "bg-danger-fill text-danger" })
  if (today.toldNotToTake > 0) {
    parts.push({ text: `${today.toldNotToTake} told not to take`, className: "bg-caution-fill text-caution" })
  }
  if (today.later > 0) parts.push({ text: `${today.later} later`, className: "bg-muted text-muted-foreground" })
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">Today</span>
      {parts.map((part) => (
        <span key={part.text} className={cn("rounded-full px-2.5 py-0.5 font-medium", part.className)}>
          {part.text}
        </span>
      ))}
    </div>
  )
}
