"use client"

import * as React from "react"

function formatHHMMSS(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => value.toString().padStart(2, "0")

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function NextRunTimer({ target }: { target: Date }) {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const remaining = Math.max(0, (target.getTime() - now) / 1000)

  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      Next Prompt Run:{" "}
      <span className="font-medium text-foreground">
        {formatHHMMSS(remaining)}
      </span>
    </span>
  )
}
