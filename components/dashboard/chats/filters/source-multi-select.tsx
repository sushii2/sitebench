"use client"

import {
  MultiSelectPopover,
  type MultiSelectOption,
} from "@/components/dashboard/chats/filters/multi-select-popover"
import type { SourceDomain } from "@/lib/source-domains/types"

export function SourceMultiSelect({
  domains,
  onChange,
  value,
}: {
  domains: SourceDomain[]
  onChange: (next: string[]) => void
  value: string[]
}) {
  const options: MultiSelectOption[] = domains.map((domain) => ({
    label: domain.display_name ?? domain.domain,
    value: domain.id,
  }))

  return (
    <MultiSelectPopover
      ariaLabel="Source filter"
      emptyMessage="No sources"
      label="Source"
      onChange={onChange}
      options={options}
      placeholder="Search sources..."
      selected={value}
      triggerClassName="w-36"
    />
  )
}
