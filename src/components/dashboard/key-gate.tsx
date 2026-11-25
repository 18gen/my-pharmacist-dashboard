"use client"

import { type FormEvent, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { saveKey } from "@/lib/dashboard-key"

/**
 * Asks for the dashboard's key: not an account, one key shared by the demo team.
 * `onSave` runs once the key is kept, so the page tries it even if it is the one refused.
 */
export function KeyGate({ rejected, onSave }: { rejected: boolean; onSave: () => void }) {
  const [key, setKey] = useState("")
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!key.trim()) return
    saveKey(key)
    onSave()
  }
  return (
    <main className="grid min-h-svh place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sample Pharmacy</CardTitle>
          <CardDescription>
            {rejected
              ? "That key didn't work. Check it and try again."
              : "Enter the dashboard key, or open the dashboard's link that includes it."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label htmlFor="dashboard-key" className="text-sm font-medium">
              Dashboard key
            </label>
            <Input
              id="dashboard-key"
              type="password"
              autoComplete="off"
              autoFocus
              value={key}
              onChange={(event) => setKey(event.target.value)}
              aria-invalid={rejected || undefined}
            />
            <Button type="submit" disabled={!key.trim()}>
              Open dashboard
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
