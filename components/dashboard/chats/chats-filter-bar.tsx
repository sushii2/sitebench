"use client"

import { Button } from "@/components/ui/button"
import { BrandMultiSelect } from "@/components/dashboard/chats/filters/brand-multi-select"
import { PipelineRunSelect } from "@/components/dashboard/chats/filters/pipeline-run-select"
import { PromptMultiSelect } from "@/components/dashboard/chats/filters/prompt-multi-select"
import { SearchInput } from "@/components/dashboard/chats/filters/search-input"
import { SourceMultiSelect } from "@/components/dashboard/chats/filters/source-multi-select"
import { TimeframeSelect } from "@/components/dashboard/chats/filters/timeframe-select"
import { TopicMultiSelect } from "@/components/dashboard/chats/filters/topic-multi-select"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { ChatFilters } from "@/lib/chats/filters"
import { emptyFilters, hasActiveFilters } from "@/lib/chats/filters"
import type { PipelineRunBatch } from "@/lib/chats/types"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

export function ChatsFilterBar({
  batches,
  brands,
  domains,
  filters,
  onChange,
  prompts,
  topics,
}: {
  batches: PipelineRunBatch[]
  brands: BrandEntity[]
  domains: SourceDomain[]
  filters: ChatFilters
  onChange: (next: ChatFilters) => void
  prompts: TrackedPrompt[]
  topics: ProjectTopic[]
}) {
  const timeframeDisabled = filters.pipelineRunDate !== null

  function update<K extends keyof ChatFilters>(key: K, value: ChatFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function handleTopicsChange(next: string[]) {
    const topicSet = new Set(next)
    const trackedPromptIds = filters.trackedPromptIds.filter((promptId) => {
      const prompt = prompts.find((candidate) => candidate.id === promptId)

      if (!prompt) {
        return false
      }

      if (topicSet.size === 0) {
        return true
      }

      return topicSet.has(prompt.project_topic_id)
    })

    onChange({ ...filters, topicIds: next, trackedPromptIds })
  }

  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PipelineRunSelect
        batches={batches}
        onChange={(value) => update("pipelineRunDate", value)}
        value={filters.pipelineRunDate}
      />
      <TimeframeSelect
        disabled={timeframeDisabled}
        onChange={(value) => update("timeframe", value)}
        value={filters.timeframe}
      />
      <TopicMultiSelect
        onChange={handleTopicsChange}
        topics={topics}
        value={filters.topicIds}
      />
      <PromptMultiSelect
        onChange={(value) => update("trackedPromptIds", value)}
        prompts={prompts}
        topicIds={filters.topicIds}
        value={filters.trackedPromptIds}
      />
      <BrandMultiSelect
        brands={brands}
        onChange={(value) => update("brandEntityIds", value)}
        value={filters.brandEntityIds}
      />
      <SourceMultiSelect
        domains={domains}
        onChange={(value) => update("sourceDomainIds", value)}
        value={filters.sourceDomainIds}
      />
      <div className="ml-auto flex items-center gap-2">
        <SearchInput
          onChange={(value) => update("search", value)}
          value={filters.search}
        />
        {active ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(emptyFilters())}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
