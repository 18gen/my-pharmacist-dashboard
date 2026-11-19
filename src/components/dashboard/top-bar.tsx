import { cn } from "@/lib/utils"

import { ConfirmAction } from "./confirm-action"

/** The pharmacy's name, how many are sharing, whether the page is live, and Reset demo. */
export function TopBar({
  sharing,
  status,
  resetError,
  onReset,
}: {
  sharing: number | null
  status: "connecting" | "live" | "reconnecting"
  resetError: string | null
  onReset: () => void
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b pb-5">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          My Pharmacist · demo dashboard
        </p>
        <h1 className="font-heading text-3xl leading-tight font-medium text-balance sm:text-4xl">Sample Pharmacy</h1>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {sharing !== null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {sharing === 1 ? "1 sharing" : `${sharing} sharing`}
          </span>
        )}
        <LiveStatus status={status} />
        <div className="flex flex-col items-end gap-1">
          <ConfirmAction
            label="Reset demo"
            title="Reset the demo?"
            description="Everyone sharing is removed from this page. Their phones show that sharing stopped, and they can join again."
            confirm="Reset"
            onConfirm={onReset}
          />
          {resetError && (
            <p role="alert" className="text-xs text-destructive">
              Couldn&apos;t reset: {resetError}
            </p>
          )}
        </div>
      </div>
    </header>
  )
}

function LiveStatus({ status }: { status: "connecting" | "live" | "reconnecting" }) {
  const label = { connecting: "Connecting…", live: "Live", reconnecting: "Reconnecting…" }[status]
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm font-medium">
      <span
        aria-hidden
        className={cn(
          "size-2.5 rounded-full",
          status === "live" ? "bg-ok motion-safe:animate-pulse" : status === "reconnecting" ? "bg-caution" : "bg-muted-foreground",
        )}
      />
      {label}
    </span>
  )
}
