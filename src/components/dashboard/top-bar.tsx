import { Switch } from "@/components/ui/switch"

import { ConfirmAction } from "./confirm-action"
import { Storefront } from "./glyphs"

/** The pharmacy, the sample patients' switch and Reset demo; a notice only while the page can't update. */
export function TopBar({
  status,
  samples,
  onSamples,
  resetError,
  onReset,
}: {
  status: "connecting" | "live" | "reconnecting"
  samples: boolean
  onSamples: (on: boolean) => void
  resetError: string | null
  onReset: () => void
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <Storefront className="size-6" />
      </span>
      {/* At least this wide, so on a phone the controls go under the name, not over it. */}
      <div className="flex min-w-48 flex-1 flex-col">
        <h1 className="font-heading text-3xl leading-tight font-medium">Sample Pharmacy</h1>
        <p className="text-[15px] text-muted-foreground">Demo dashboard</p>
      </div>
      {status === "reconnecting" && (
        <span role="status" className="inline-flex items-center gap-2 text-[15px] font-semibold text-caution">
          <span aria-hidden className="size-2.5 rounded-full bg-caution" />
          Reconnecting…
        </span>
      )}
      <label className="inline-flex cursor-pointer items-center gap-2.5 text-[15px] font-semibold">
        <Switch checked={samples} onCheckedChange={(checked) => onSamples(checked)} />
        Sample patients
      </label>
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
