"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Smartphone } from "lucide-react"
import { useMemo, useSyncExternalStore } from "react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useNow } from "@/hooks/use-now"
import { fetchPatients, KeyRejected, removePatient, resetDemo } from "@/lib/api"
import { patientCards } from "@/lib/card"
import { currentKey, subscribeToKey } from "@/lib/dashboard-key"

import { FreshProvider, keysOf, useFresh } from "./fresh"
import { KeyGate } from "./key-gate"
import { PatientCard, WaitingCard } from "./patient-card"
import { TopBar } from "./top-bar"

/** How often the dashboard asks for changes. */
const pollInterval = 2000

/** The page: the key first, then everyone sharing. */
export function Dashboard() {
  // Undefined while rendered on the server, which can't see this browser's key.
  const key = useSyncExternalStore(subscribeToKey, currentKey, () => undefined)
  if (key === undefined) return null
  if (key === null) return <KeyGate rejected={false} />
  return <Board dashboardKey={key} />
}

function Board({ dashboardKey }: { dashboardKey: string }) {
  const queryClient = useQueryClient()
  const patients = useQuery({
    queryKey: ["patients", dashboardKey],
    queryFn: ({ signal }) => fetchPatients(dashboardKey, signal),
    refetchInterval: pollInterval,
    retry: false,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["patients"] })
  const reset = useMutation({ mutationFn: () => resetDemo(dashboardKey), onSettled: refresh })
  const remove = useMutation({ mutationFn: (id: string) => removePatient(dashboardKey, id), onSettled: refresh })

  const now = useNow()
  const cards = useMemo(() => (patients.data ? patientCards(patients.data, now) : null), [patients.data, now])
  const fresh = useFresh(useMemo(() => (cards ? keysOf(cards) : null), [cards]))

  if (patients.error instanceof KeyRejected) return <KeyGate rejected />

  const status = patients.isError ? "reconnecting" : patients.isSuccess ? "live" : "connecting"
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <TopBar
        sharing={cards?.length ?? null}
        status={status}
        resetError={reset.error ? reset.error.message : null}
        onReset={() => reset.mutate()}
      />
      <main className="flex-1">
        {cards && cards.length === 0 && <NoOneYet />}
        {cards && cards.length > 0 && (
          <FreshProvider value={fresh}>
            <div className="flex flex-col gap-6">
              {/* People who joined but whose phone hasn't sent anything yet: small, above the rest. */}
              {cards.some((card) => card.waiting) && (
                <div className="flex flex-wrap gap-3">
                  {cards
                    .filter((card) => card.waiting)
                    .map((card) => (
                      <WaitingCard key={card.id} card={card} onRemove={(id) => remove.mutate(id)} />
                    ))}
                </div>
              )}
              <div className="grid grid-cols-1 items-start gap-6 min-[1100px]:grid-cols-2">
                {cards
                  .filter((card) => !card.waiting)
                  .map((card) => (
                    <PatientCard key={card.id} card={card} now={now} onRemove={(id) => remove.mutate(id)} />
                  ))}
              </div>
            </div>
          </FreshProvider>
        )}
      </main>
      <footer className="border-t pt-4 text-xs text-muted-foreground">
        A demo with a fictional pharmacy. Records are deleted when a phone stops sharing, on Reset demo, or after 14
        days without updates. The pharmacy isn&apos;t alerted about anything; people still call their pharmacist if
        they&apos;re unsure about a dose.
      </footer>
    </div>
  )
}

function NoOneYet() {
  return (
    <Empty className="border border-dashed py-16">
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
