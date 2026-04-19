"use client"

import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import { PlatformFilter } from "@/components/dashboard/prompts/platform-filter"
import { PromptsHeader } from "@/components/dashboard/prompts/prompts-header"
import { PromptsTable } from "@/components/dashboard/prompts/prompts-table"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { PromptPlatformId } from "@/lib/dashboard/prompt-platforms"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import { loadProjectTopics } from "@/lib/project-topics/repository"
import type { ProjectTopic } from "@/lib/project-topics/types"
import { loadTrackedPromptsByProject } from "@/lib/tracked-prompts/repository"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

const NEXT_RUN_OFFSET_MS = 4 * 60 * 60 * 1000

export function PromptsPage() {
  const { brand } = useAuth()
  const projectId = brand?.id ?? null
  const [topics, setTopics] = React.useState<ProjectTopic[]>([])
  const [prompts, setPrompts] = React.useState<TrackedPrompt[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [platform, setPlatform] = React.useState<PromptPlatformId>("chatgpt")
  const nextRunAt = React.useMemo(
    () => new Date(Date.now() + NEXT_RUN_OFFSET_MS),
    []
  )

  React.useEffect(() => {
    if (!projectId) {
      return
    }

    let cancelled = false
    const client = getInsforgeBrowserClient()

    async function load(currentProjectId: string) {
      setIsLoading(true)
      setError(null)

      try {
        const [loadedTopics, loadedPrompts] = await Promise.all([
          loadProjectTopics(client, currentProjectId),
          loadTrackedPromptsByProject(client, currentProjectId),
        ])

        if (cancelled) {
          return
        }

        setTopics(
          loadedTopics
            .filter((topic) => topic.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
        )
        setPrompts(loadedPrompts.filter((prompt) => prompt.is_active))
      } catch (caught) {
        if (cancelled) {
          return
        }

        setError(
          caught instanceof Error ? caught.message : "Unable to load prompts."
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load(projectId)

    return () => {
      cancelled = true
    }
  }, [projectId])

  const promptsByTopic = React.useMemo(() => {
    const map = new Map<string, TrackedPrompt[]>()

    for (const prompt of prompts) {
      const list = map.get(prompt.project_topic_id) ?? []

      list.push(prompt)
      map.set(prompt.project_topic_id, list)
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at))
    }

    return map
  }, [prompts])

  const competitors = brand?.competitors ?? []
  const hasData = topics.length > 0

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
      <PromptsHeader
        nextRunAt={nextRunAt}
        onAddPrompt={() => {}}
        onEditSchedule={() => {}}
      />
      <PlatformFilter value={platform} onChange={setPlatform} />
      {error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : hasData ? (
        <PromptsTable
          topics={topics}
          promptsByTopic={promptsByTopic}
          competitors={competitors}
          platform={platform}
        />
      ) : (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No prompts tracked yet.
          </p>
        </Card>
      )}
    </div>
  )
}
