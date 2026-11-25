"use client"

import { ChevronDown } from "lucide-react"
import { type PointerEvent, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { type Board, type Order, orders, type PersonBoard } from "@/lib/board"
import { ago, localTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { DoseCell, PillTile } from "./dose-cell"
import { useGlow } from "./fresh"

/** The day open in the panel: whose, and which. */
export interface Selection {
  personId: string
  day: string
}

/** An update this recent shows in blue, as the phone on stage. */
const freshFor = 10 * 1000

/**
 * Everyone in one table: the last 7 days across, and for each person a row per dose time.
 * Each person starts with their name, which folds their rows away; the corner holds the
 * order. Clicking a box opens that day in the panel.
 */
export function BoardTable({
  board,
  order,
  onOrder,
  now,
  folded,
  onFold,
  selection,
  onSelect,
}: {
  board: Board
  order: Order
  onOrder: (order: Order) => void
  now: Date
  folded: ReadonlySet<string>
  onFold: (personId: string) => void
  selection: Selection | null
  onSelect: (selection: Selection) => void
}) {
  // Too narrow for every day (a phone): the days scroll under the names, starting at today.
  const table = useRef<HTMLTableElement>(null)
  useEffect(() => {
    const box = table.current?.parentElement
    if (box && box.scrollWidth > box.clientWidth) box.scrollLeft = box.scrollWidth
  }, [])

  return (
    <Table ref={table} className="w-auto table-fixed border-separate border-spacing-0">
      <colgroup>
        <col className="w-[180px] sm:w-[230px]" />
        {board.columns.map((column) => (
          <col key={column.day} className="w-[72px]" />
        ))}
      </colgroup>
      <TableHeader className="[&_tr]:border-0">
        <TableRow className="hover:bg-transparent">
          <TableHead className="sticky left-0 z-10 h-auto bg-card px-0 pr-3 align-middle">
            <OrderToggle order={order} onOrder={onOrder} />
          </TableHead>
          {board.columns.map((column) => (
            <TableHead
              key={column.day}
              scope="col"
              className={cn(
                "h-auto px-0 py-1.5 text-center leading-tight",
                column.isToday ? "font-bold text-foreground" : "font-medium text-muted-foreground",
              )}
            >
              <span className="block text-[13px]">{column.weekday}</span>
              <span className="block text-lg">{column.date}</span>
              <span className="sr-only">{column.long}</span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      {board.people.map((person, index) => (
        <Person
          key={person.id}
          person={person}
          board={board}
          order={order}
          now={now}
          first={index === 0}
          folded={folded.has(person.id)}
          onFold={() => onFold(person.id)}
          selectedDay={selection?.personId === person.id ? selection.day : null}
          onSelect={(day) => onSelect({ personId: person.id, day })}
        />
      ))}
    </Table>
  )
}

/** Updated, Joined, A–Z: always one of them. */
function OrderToggle({ order, onOrder }: { order: Order; onOrder: (order: Order) => void }) {
  const labels: Record<Order, [string, string]> = {
    updated: ["Updated", "Order by latest update"],
    joined: ["Joined", "Order by when they joined"],
    name: ["A–Z", "Order by name"],
  }
  return (
    <ToggleGroup
      value={[order]}
      onValueChange={(value: unknown[]) => {
        const chosen = orders.find((candidate) => value.includes(candidate))
        if (chosen) onOrder(chosen)
      }}
      spacing={0.5}
      aria-label="Order people"
      className="rounded-full bg-secondary p-[3px]"
    >
      {orders.map((value) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={labels[value][1]}
          className="h-[34px] rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-[0_1px_2px_rgba(33,20,15,0.18)]"
        >
          {labels[value][0]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function Person({
  person,
  board,
  order,
  now,
  first,
  folded,
  onFold,
  selectedDay,
  onSelect,
}: {
  person: PersonBoard
  board: Board
  order: Order
  now: Date
  first: boolean
  folded: boolean
  onFold: () => void
  selectedDay: string | null
  onSelect: (day: string) => void
}) {
  const glows = useGlow("person", person.id)
  // The day under the mouse: its whole column lights up for this person, the band a click
  // would open. Found from the box under the pointer, so moving between boxes of one day
  // keeps it lit; touch has no hover, so taps leave it alone.
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const hover = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return
    const box = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-day]") : null
    setHoveredDay(box?.dataset.day ?? null)
  }
  const rowsId = `rows-${person.id}`
  const recent = !person.waiting && order !== "joined" && now.getTime() - Date.parse(person.updatedAt) < freshFor
  const sub = person.waiting
    ? `Joined ${localTime(person.joinedAt)} · waiting`
    : order === "joined"
      ? `Joined ${localTime(person.joinedAt)}`
      : `Updated ${ago(person.updatedAt, now)}`

  return (
    <>
      <TableBody>
        {/* No shading for an open person: shadcn's rows shade when they hold an open toggle. */}
        <TableRow className="border-0 hover:bg-transparent has-aria-expanded:bg-transparent">
          <TableHead colSpan={board.columns.length + 1} scope="rowgroup" className={cn("h-auto px-0 pt-2 pb-1", !first && "border-t border-border")}>
            <Button
              variant="ghost"
              onClick={onFold}
              aria-expanded={!folded}
              aria-controls={rowsId}
              className="sticky left-0 mt-1 h-auto w-[min(100%,calc(100vw-4.5rem))] justify-start gap-2.5 rounded-xl px-1 py-1.5 text-left font-normal hover:bg-secondary/60 aria-expanded:bg-transparent"
            >
              <span className={cn("rounded-md px-0.5 text-[21px] font-bold", glows && "motion-safe:animate-fresh")}>{person.name}</span>
              <span className={cn("text-[15px]", recent ? "text-due" : "text-muted-foreground")}>{sub}</span>
              <span className="flex-1" />
              <ChevronDown aria-hidden className={cn("size-4 text-muted-foreground transition-transform", !folded && "rotate-180")} strokeWidth={3} />
            </Button>
          </TableHead>
        </TableRow>
      </TableBody>
      <TableBody id={rowsId} hidden={folded} onPointerOver={hover} onPointerLeave={() => setHoveredDay(null)}>
        {person.waiting && (
          <TableRow className="border-0 hover:bg-transparent">
            <TableCell colSpan={board.columns.length + 1} className="px-1 pb-3 text-base text-muted-foreground">
              <span className="sticky left-1">Waiting for the phone&apos;s first update.</span>
            </TableCell>
          </TableRow>
        )}
        {person.rows.map((row, index) => (
          <TableRow key={row.key} className="border-0 hover:bg-transparent">
            <TableHead scope="row" className="sticky left-0 z-10 h-auto border-r border-border bg-card px-0 py-0.5 pr-3 font-normal whitespace-normal">
              <span className="flex items-center gap-2.5">
                <PillTile medicationId={row.medicationId} unknown={row.kind === "unknown"} />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="text-base font-semibold">
                    {row.name}{" "}
                    {row.strength && <span className="font-normal whitespace-nowrap text-muted-foreground">{row.strength}</span>}
                  </span>
                  <span className={cn("text-sm tabular-nums", row.kind === "unknown" ? "text-danger" : "text-muted-foreground")}>
                    {row.when}
                  </span>
                </span>
              </span>
            </TableHead>
            {row.cells.map((cell, column) => (
              // Keyed by what the box shows, so a change mounts it afresh and it can glow once.
              <TableCell key={cell.key} className="px-[3px] py-0">
                <DoseCell
                  person={person}
                  row={row}
                  column={board.columns[column]!}
                  cell={cell}
                  selected={selectedDay === cell.day}
                  hovered={hoveredDay === cell.day}
                  first={index === 0}
                  last={index === person.rows.length - 1}
                  onSelect={() => onSelect(cell.day)}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </>
  )
}
