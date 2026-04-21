"use client"

import {
  MultiSelectPopover,
  type MultiSelectOption,
} from "@/components/dashboard/chats/filters/multi-select-popover"
import type { ProjectTopic } from "@/lib/project-topics/types"

export function TopicMultiSelect({
  onChange,
  topics,
  value,
}: {
  onChange: (next: string[]) => void
  topics: ProjectTopic[]
  value: string[]
}) {
  const options: MultiSelectOption[] = topics.map((topic) => ({
    label: topic.name,
    value: topic.id,
  }))

  return (
    <MultiSelectPopover
      ariaLabel="Topic filter"
      emptyMessage="No topics"
      label="Topic"
      onChange={onChange}
      options={options}
      placeholder="Search topics..."
      selected={value}
      triggerClassName="w-36"
    />
  )
}
