"use client"

import {
  MultiSelectPopover,
  type MultiSelectOption,
} from "@/components/dashboard/chats/filters/multi-select-popover"
import type { BrandEntity } from "@/lib/brand-entities/types"

export function BrandMultiSelect({
  brands,
  onChange,
  value,
}: {
  brands: BrandEntity[]
  onChange: (next: string[]) => void
  value: string[]
}) {
  const sorted = [...brands].sort((a, b) => {
    if (a.role === b.role) {
      return a.sort_order - b.sort_order
    }

    return a.role === "primary" ? -1 : 1
  })

  const options: MultiSelectOption[] = sorted.map((brand) => ({
    description: brand.role === "primary" ? "Primary" : "Competitor",
    label: brand.name,
    value: brand.id,
  }))

  return (
    <MultiSelectPopover
      ariaLabel="Brand filter"
      emptyMessage="No brands"
      label="Brand"
      onChange={onChange}
      options={options}
      placeholder="Search brands..."
      selected={value}
      triggerClassName="w-36"
    />
  )
}
