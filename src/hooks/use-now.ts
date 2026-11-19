"use client"

import { useEffect, useState } from "react"

/** The time now, updated every `interval` milliseconds: for "updated 4 s ago" and doses falling due. */
export function useNow(interval = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), interval)
    return () => window.clearInterval(timer)
  }, [interval])
  return now
}
