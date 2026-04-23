"use client"

import {
  MultiSelectPopover,
  type MultiSelectOption,
} from "@/components/dashboard/chats/filters/multi-select-popover"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

export function PromptMultiSelect({
  onChange,
  prompts,
  topicIds,
  value,
}: {
  onChange: (next: string[]) => void
  prompts: TrackedPrompt[]
  topicIds: string[]
  value: string[]
}) {
  const topicSet = new Set(topicIds)

  const filtered = prompts.filter((prompt) => {
    if (!prompt.is_active) {
      return false
    }

    if (topicSet.size === 0) {
      return true
    }

    return topicSet.has(prompt.project_topic_id)
  })

  const options: MultiSelectOption[] = filtered.map((prompt) => ({
    label: prompt.prompt_text,
    value: prompt.id,
  }))

  return (
    <MultiSelectPopover
      ariaLabel="Prompt filter"
      emptyMessage="No prompts"
      label="Prompt"
      onChange={onChange}
      options={options}
      placeholder="Search prompts..."
      selected={value}
      triggerClassName="w-40"
    />
  )
}
