"use client"

import { Check, Clock, Dot, Minus, X } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Cell, CellState, Column, MedicationRows } from "@/lib/card"
import { cn } from "@/lib/utils"

import { itemKey, useGlow } from "./fresh"

const look: Record<CellState, { icon: typeof Check; className: string }> = {
  taken: { icon: Check, className: "bg-ok-fill text-ok" },
  missed: { icon: X, className: "bg-danger-fill text-danger" },
  due: { icon: Clock, className: "bg-due-fill text-due ring-1 ring-due" },
  later: { icon: Dot, className: "text-muted-foreground" },
  none: { icon: Minus, className: "text-muted-foreground/50" },
}

/** The last 7 days, a row per dose time, like a pharmacy's administration record. */
export function WeekGrid({
  patientID,
  columns,
  medications,
}: {
  patientID: string
  columns: Column[]
  medications: MedicationRows[]
}) {
  if (medications.length === 0) {
    return <p className="text-sm text-muted-foreground">No medications on this phone&apos;s list.</p>
  }
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-separate border-spacing-x-0.5 border-spacing-y-0.5 text-sm sm:border-spacing-x-1">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Dose</span>
            </th>
            {columns.map((column) => (
              <th
                key={column.day}
                scope="col"
                className={cn(
                  "w-7 pb-1 text-center text-xs sm:w-10",
                  column.isToday ? "font-semibold text-foreground" : "font-normal text-muted-foreground",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        {medications.map((medication) => (
          <tbody key={medication.key}>
            <tr>
              <th scope="rowgroup" colSpan={columns.length + 1} className="pt-2 text-left font-medium">
                {medication.name}
              </th>
            </tr>
            {medication.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="pr-1 pl-1 text-left font-normal whitespace-nowrap text-muted-foreground sm:pr-2 sm:pl-3">
                  {row.label}
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.key} className="text-center">
                    <Mark cell={cell} glowKey={itemKey(patientID, cell.key)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function Mark({ cell, glowKey }: { cell: Cell; glowKey: string }) {
  const glows = useGlow("item", glowKey)
  const { icon: Icon, className } = look[cell.state]
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              // Seven days fit on a phone at 28 px; 32 px from tablet width up.
              "inline-flex size-7 items-center justify-center rounded-md sm:size-8",
              className,
              glows && "motion-safe:animate-fresh",
            )}
          />
        }
      >
        <Icon aria-hidden className="size-4" strokeWidth={2.5} />
        <span className="sr-only">{cell.label}</span>
      </TooltipTrigger>
      <TooltipContent>{cell.label}</TooltipContent>
    </Tooltip>
  )
}
