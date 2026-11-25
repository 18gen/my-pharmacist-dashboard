"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Smartphone } from "lucide-react"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useNow } from "@/hooks/use-now"
import { fetchPatients, KeyRejected, resetDemo } from "@/lib/api"
import { buildBoard, dayEvents, type Order, orders, quietDay } from "@/lib/board"
import { currentKey, subscribeToKey } from "@/lib/dashboard-key"
import { samplePatients } from "@/lib/sample-patients"

import { BoardTable, type Selection } from "./board-table"
import { DayPanel, type OpenDay } from "./day-panel"
import { FreshProvider, keysOf, useFresh } from "./fresh"
import { KeyGate } from "./key-gate"
import { TopBar } from "./top-bar"

/** How often the dashboard asks for changes. */
const pollInterval = 2000
/** Where this browser remembers the order chosen, and whether it shows the sample patients. */
const orderKey = "my-pharmacist.dashboard-order"
const samplesKey = "my-pharmacist.dashboard-samples"

/** The page: the key first, then everyone sharing. */
export function Dashboard() {
  // Undefined while rendered on the server, which can't see this browser's key.
  const key = useSyncExternalStore(subscribeToKey, currentKey, () => undefined)
  // The key the server refused. The board (and its polling) is gone while the page asks
  // for another: polling on would swap the form for a new, empty one every 2 seconds, as
  // TanStack Query clears a query's error each time it fetches before any data.
  const [refused, setRefused] = useState<string | null>(null)
  if (key === undefined) return null
  if (key === null || key === refused) {
    return <KeyGate rejected={key !== null} onSave={() => setRefused(null)} />
  }
  return <Board dashboardKey={key} onRefused={() => setRefused(key)} />
}

function Board({ dashboardKey, onRefused }: { dashboardKey: string; onRefused: () => void }) {
  const queryClient = useQueryClient()
  const patients = useQuery({
    queryKey: ["patients", dashboardKey],
    queryFn: ({ signal }) => fetchPatients(dashboardKey, signal),
    refetchInterval: pollInterval,
    retry: false,
  })
  const reset = useMutation({
    mutationFn: () => resetDemo(dashboardKey),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["patients"] }),
  })

  const [order, setOrder] = useState<Order>(savedOrder)
  const [samples, setSamples] = useState(savedSamples)
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const [selection, setSelection] = useState<Selection | null>(null)

  const now = useNow()
  // Made afresh each minute, so their doses keep being taken as the day goes on.
  const minuteNow = Math.floor(now.getTime() / 60_000)
  const sampled = useMemo(() => (samples ? samplePatients(new Date(minuteNow * 60_000)) : []), [samples, minuteNow])
  const everyone = useMemo(() => [...(patients.data ?? []), ...sampled], [patients.data, sampled])
  const board = useMemo(
    () => (patients.data || samples ? buildBoard(everyone, now, order) : null),
    [patients.data, samples, everyone, now, order],
  )
  const fresh = useFresh(useMemo(() => (board ? keysOf(board.people) : null), [board]))

  const refused = patients.error instanceof KeyRejected
  useEffect(() => {
    if (refused) onRefused()
  }, [refused, onRefused])
  if (refused) return null

  // errorUpdateCount survives the refetches that clear the error before any data, so the
  // label doesn't swap between Connecting and Reconnecting every poll while unreachable.
  const status =
    patients.isError || (patients.isPending && patients.errorUpdateCount > 0)
      ? "reconnecting"
      : patients.isSuccess
        ? "live"
        : "connecting"
  const open = openDay(selection, board, everyone, now)
  const chooseOrder = (next: Order) => {
    setOrder(next)
    remember(orderKey, next)
  }
  const showSamples = (on: boolean) => {
    setSamples(on)
    remember(samplesKey, on ? "on" : "off")
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1240px] flex-col gap-5 px-4 py-7 sm:px-6">
      <TopBar
        status={status}
        samples={samples}
        onSamples={showSamples}
        resetError={reset.error ? reset.error.message : null}
        onReset={() => {
          setSelection(null)
          reset.mutate()
        }}
      />
      <main className="flex flex-1 flex-wrap items-start gap-5">
        {board && board.people.length === 0 && <NoOneYet />}
        {board && board.people.length > 0 && (
          <FreshProvider value={fresh}>
            <section
              aria-label="Doses this week"
              className="max-w-full min-w-0 flex-[0_1_auto] rounded-3xl border border-edge bg-card px-4 pt-3 pb-4 shadow-[0_2px_3px_rgba(33,20,15,0.10)]"
            >
              <BoardTable
                board={board}
                order={order}
                onOrder={chooseOrder}
                now={now}
                folded={folded}
                onFold={(id) => setFolded((before) => toggled(before, id))}
                selection={open ? selection : null}
                onSelect={(chosen) =>
                  setSelection((before) =>
                    before?.personId === chosen.personId && before.day === chosen.day ? null : chosen,
                  )
                }
              />
            </section>
            <DayPanel open={open} onClose={() => setSelection(null)} className="min-w-0 flex-[1_1_300px] lg:sticky lg:top-4" />
          </FreshProvider>
        )}
      </main>
    </div>
  )
}

/** The order this browser chose last time; latest update first otherwise. */
function savedOrder(): Order {
  try {
    const saved = window.localStorage.getItem(orderKey)
    return orders.find((order) => order === saved) ?? "updated"
  } catch {
    return "updated"
  }
}

/** Whether this browser showed the sample patients last time; off at first. */
function savedSamples(): boolean {
  try {
    return window.localStorage.getItem(samplesKey) === "on"
  } catch {
    return false
  }
}

function remember(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Not remembered (a private window): it still applies until the page closes.
  }
}

function toggled(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set)
  if (!next.delete(id)) next.add(id)
  return next
}

/** The day the panel shows, while its person is still sharing. */
function openDay(
  selection: Selection | null,
  board: ReturnType<typeof buildBoard> | null,
  patients: NonNullable<Parameters<typeof buildBoard>[0]>,
  now: Date,
): OpenDay | null {
  if (!selection || !board) return null
  const person = board.people.find((entry) => entry.id === selection.personId)
  const patient = patients.find((entry) => entry.id === selection.personId)
  const column = board.columns.find((entry) => entry.day === selection.day)
  if (!person || !patient || !column) return null
  return {
    name: person.name,
    day: column.long,
    events: dayEvents(patient, selection.day, now),
    quiet: quietDay(patient, selection.day),
  }
}

function NoOneYet() {
  return (
    <Empty className="w-full border border-dashed border-edge py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Smartphone />
        </EmptyMedia>
        <EmptyTitle>No one is sharing yet</EmptyTitle>
        <EmptyDescription>On a phone with My Pharmacist: My pharmacy → Share my doses.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
