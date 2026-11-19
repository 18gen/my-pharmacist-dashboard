import { Button } from "@/components/ui/button"

// The check from ui.shadcn.com/docs/installation/next: one shadcn/ui Button. The
// dashboard replaces it.
export default function Home() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Button>Click me</Button>
    </div>
  )
}
