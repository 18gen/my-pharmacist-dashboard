import { cn } from "@/lib/utils"

import { ConfirmAction } from "./confirm-action"
import { Storefront } from "./glyphs"

/** The pharmacy, whether the page is live, and Reset demo. */
export function TopBar({
  status,
  resetError,
  onReset,
}: {
  status: "connecting" | "live" | "reconnecting"
  resetError: string | null
  onReset: () => void
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <Storefront className="size-6" />
      </span>
      {/* At least this wide, so on a phone "Live" and Reset demo go under the name, not over it. */}
      <div className="flex min-w-48 flex-1 flex-col">
        <h1 className="font-heading text-3xl leading-tight font-medium">Sample Pharmacy</h1>
        <p className="text-[15px] text-muted-foreground">Demo dashboard</p>
      </div>
      <LiveStatus status={status} />
      <div className="flex flex-col items-end gap-1">
        <ConfirmAction
          label="Reset demo"
          title="Reset the demo?"
          description="Everyone sharing is removed from this page, with their pictures. Their phones show that sharing stopped, and they can join again."
          confirm="Reset"
          onConfirm={onReset}
          variant="secondary"
          className="h-11 rounded-full px-5 text-base font-semibold"
        />
        {resetError && (
          <p role="alert" className="text-xs text-destructive">
            Couldn&apos;t reset: {resetError}
          </p>
        )}
      </div>
    </header>
  )
}

function LiveStatus({ status }: { status: "connecting" | "live" | "reconnecting" }) {
  const label = { connecting: "Connecting…", live: "Live", reconnecting: "Reconnecting…" }[status]
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-2 text-[17px] font-semibold",
        status === "live" ? "text-ok" : status === "reconnecting" ? "text-caution" : "text-muted-foreground",
      )}
    >
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
