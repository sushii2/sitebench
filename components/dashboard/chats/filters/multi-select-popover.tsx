"use client"

import * as React from "react"
import {
  ArrowDown01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface MultiSelectOption {
  value: string
  label: string
  description?: string
}

export function MultiSelectPopover({
  ariaLabel,
  disabled = false,
  emptyMessage = "No options",
  label,
  onChange,
  options,
  placeholder = "Search...",
  selected,
  triggerClassName,
}: {
  ariaLabel: string
  disabled?: boolean
  emptyMessage?: string
  label: string
  onChange: (next: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
  selected: string[]
  triggerClassName?: string
}) {
  const selectedSet = React.useMemo(() => new Set(selected), [selected])

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((id) => id !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const count = selected.length
  const triggerLabel = count === 0 ? label : `${label} · ${count}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn("justify-between gap-2", triggerClassName)}
        >
          <span>{triggerLabel}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className="size-3.5"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-2">
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="mr-2 size-3.5 text-muted-foreground"
            />
            <CommandInput placeholder={placeholder} className="h-9 border-0" />
          </div>
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value)

                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.description ?? ""}`}
                    onSelect={() => toggle(option.value)}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="mr-2"
                      aria-hidden
                      tabIndex={-1}
                    />
                    <div className="grid flex-1">
                      <span className="truncate text-sm">{option.label}</span>
                      {option.description ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
