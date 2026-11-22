"use client"

import Image from "next/image"
import { useState } from "react"

import type { Cell, Column, PersonBoard, Row } from "@/lib/board"
import { pillPicture, scanPicture } from "@/lib/pills"
import { cn } from "@/lib/utils"

import { cellKey, useGlow } from "./fresh"
import { CornerMarks, CrossCircle, QuestionCircle, Tablet, TickedBox } from "./glyphs"

/**
 * One dose on one day, as a box to click: it opens what happened that day. A scanned dose
 * shows the pill as the scan saw it, inside the camera's corner marks, as Home does (the
 * medication's own picture when the scan's isn't here); a dose ticked by hand, the ticked
 * box. The time it was taken goes under the box.
 */
export function DoseCell({
  person,
  row,
  column,
  cell,
  selected,
  first,
  last,
  onSelect,
}: {
  person: PersonBoard
  row: Row
  column: Column
  cell: Cell
  /** Its day is the one open in the panel, for this person. */
  selected: boolean
  /** The person's first and last rows: the selected day's band is rounded there. */
  first: boolean
  last: boolean
  onSelect: () => void
}) {
  const glows = useGlow("cell", cellKey(person.id, cell.key))
  const label = `${person.name}, ${column.long}: ${[row.name, row.strength].filter(Boolean).join(" ")}, ${row.when}: ${cell.label}. Show what happened that day.`
  const timeColor =
    cell.state === "unknown" ? "text-danger" : cell.state === "due" ? "text-due" : "text-ok"

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "relative flex h-full w-full cursor-pointer flex-col items-center gap-0.5 px-0 pt-1.5 pb-1 outline-none",
        "focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/60",
        selected ? "bg-secondary" : "hover:bg-secondary/50",
        first && "rounded-t-xl",
        last && "rounded-b-xl",
      )}
    >
      <span className={cn("grid size-12 place-items-center rounded-xl", glows && "motion-safe:animate-fresh")}>
        <Box person={person} row={row} cell={cell} selected={selected} />
      </span>
      <span className={cn("h-4 text-xs leading-4 font-semibold whitespace-nowrap tabular-nums", timeColor)}>{cell.time}</span>
      {cell.warned && <CrossCircle ring className="absolute top-0.5 right-1 size-5 text-danger" />}
      {cell.state === "unknown" && cell.photoId && (
        <QuestionCircle ring className="absolute top-0.5 right-1 size-5 text-danger" />
      )}
    </button>
  )
}

function Box({ person, row, cell, selected }: { person: PersonBoard; row: Row; cell: Cell; selected: boolean }) {
  // The beige tiles turn white on the selected day's beige band.
  const tile = selected ? "bg-card" : "bg-secondary"
  switch (cell.state) {
    case "scanned":
    case "unknown":
      return <ScannedPill person={person} row={row} cell={cell} tile={tile} />
    case "ticked":
      return <TickedBox className="size-10 text-ok" />
    case "missed":
      return <span className="size-[34px] rounded-lg border-[2.5px] border-late bg-late-fill" />
    case "due":
      return <span className="size-[34px] rounded-lg border-3 border-due bg-card" />
    case "later":
      return <span className="size-[34px] rounded-lg border-2 border-dashed border-edge" />
    case "noRecord":
      return <span className={cn("size-[34px] rounded-lg", tile)} />
    case "empty":
      return null
  }
}

/**
 * The pill as the scan saw it, or, until its picture loads or when there is none, the
 * medication's own picture: green corner marks for a pill OK'd, red for one not on the list.
 */
function ScannedPill({ person, row, cell, tile }: { person: PersonBoard; row: Row; cell: Cell; tile: string }) {
  const [failed, setFailed] = useState(false)
  const unknown = cell.state === "unknown"
  const reference = pillPicture(row.medicationId)
  const photo = cell.photoId && !failed ? scanPicture(person.id, cell.photoId, person.photoToken) : null
  return (
    <span className={cn("relative grid size-12 place-items-center rounded-xl", tile)}>
      {photo ? (
        <Image
          src={photo}
          alt=""
          width={38}
          height={38}
          unoptimized
          onError={() => setFailed(true)}
          className="size-[38px] rounded-[5px] object-cover"
        />
      ) : unknown ? (
        <QuestionCircle className="size-7 text-danger" />
      ) : reference ? (
        <Image src={reference} alt="" width={34} height={34} unoptimized className="size-[34px] object-contain" />
      ) : (
        <Tablet className="w-7 text-muted-foreground" />
      )}
      <CornerMarks className={cn("absolute inset-0 size-12", unknown ? "text-danger" : "text-ok")} />
    </span>
  )
}

/** The medication's own picture on a beige tile, at the start of its row. */
export function PillTile({ medicationId, unknown = false }: { medicationId: string | null; unknown?: boolean }) {
  const picture = pillPicture(medicationId)
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-secondary">
      {unknown ? (
        <QuestionCircle className="size-6 text-danger" />
      ) : picture ? (
        <Image src={picture} alt="" width={33} height={33} unoptimized className="size-[33px] object-contain" />
      ) : (
        <Tablet className="w-6 text-muted-foreground" />
      )}
    </span>
  )
}
