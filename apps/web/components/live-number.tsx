"use client"

import * as React from "react"
import { useReducedMotion } from "motion/react"

export type LiveFormat = "compact" | "int" | "hours"

function format(value: number, kind: LiveFormat): string {
  if (kind === "hours") {
    const h = value / 3600
    return h < 10
      ? h.toFixed(1)
      : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Math.round(h))
  }
  if (kind === "int") return Math.floor(value).toLocaleString("en-US")
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Math.floor(value))
}

/**
 * A number that keeps rising while the page is open. Starts from the
 * server-rendered value and advances at `rate` per second with slight
 * irregularity, so it reads as real activity rather than a metronome.
 */
export function LiveNumber({
  value,
  rate,
  kind = "compact",
  className,
}: {
  value: number
  rate: number
  kind?: LiveFormat
  className?: string
}) {
  const reduced = useReducedMotion()
  const [current, setCurrent] = React.useState(value)

  React.useEffect(() => {
    if (reduced || rate <= 0) return
    let last = performance.now()
    let acc = value
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      // Jitter between 0.4x and 1.6x of the nominal rate, averaging to 1x.
      acc += rate * dt * (0.4 + Math.random() * 1.2)
      setCurrent(acc)
      timer = setTimeout(tick, 900 + Math.random() * 1800)
    }
    timer = setTimeout(tick, 1200)
    return () => clearTimeout(timer)
  }, [value, rate, reduced])

  return (
    <span className={className} suppressHydrationWarning>
      {format(current, kind)}
    </span>
  )
}
