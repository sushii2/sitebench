"use client"

import * as React from "react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Input } from "@/components/ui/input"

export function SearchInput({
  onChange,
  value,
}: {
  onChange: (next: string) => void
  value: string
}) {
  const [local, setLocal] = React.useState(value)
  const [syncedValue, setSyncedValue] = React.useState(value)

  if (syncedValue !== value) {
    setSyncedValue(value)
    setLocal(value)
  }

  React.useEffect(() => {
    if (local === value) {
      return
    }

    const handle = window.setTimeout(() => {
      onChange(local)
    }, 200)

    return () => window.clearTimeout(handle)
  }, [local, onChange, value])

  return (
    <div className="relative w-full sm:w-64">
      <HugeiconsIcon
        icon={Search01Icon}
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        placeholder="Search prompts..."
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        className="h-9 pl-8"
      />
    </div>
  )
}
