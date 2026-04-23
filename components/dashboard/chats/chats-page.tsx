"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { ChatsFilterBar } from "@/components/dashboard/chats/chats-filter-bar"
import { ChatsTable } from "@/components/dashboard/chats/chats-table"
import { Skeleton } from "@/components/ui/skeleton"
import { loadActiveAiPlatforms } from "@/lib/ai-platforms/repository"
import { loadBrandEntitiesByProject } from "@/lib/brand-entities/repository"
import type { BrandEntity } from "@/lib/brand-entities/types"
import {
  applyFilters,
  filtersFromQueryString,
  filtersToQueryString,
  normalizeChatFilters,
  type ChatFilters,
} from "@/lib/chats/filters"
import {
  listChats,
  listPipelineRunBatches,
  listProjectSourceDomains,
} from "@/lib/chats/repository"
import type {
  ChatSummary,
  PipelineRunBatch,
} from "@/lib/chats/types"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import { loadProjectTopics } from "@/lib/project-topics/repository"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import { loadTrackedPromptsByProject } from "@/lib/tracked-prompts/repository"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

export function ChatsPage() {
  const { brand } = useAuth()
  const projectId = brand?.id ?? null
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = React.useMemo<ChatFilters>(
    () => filtersFromQueryString(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [chats, setChats] = React.useState<ChatSummary[]>([])
  const [topics, setTopics] = React.useState<ProjectTopic[]>([])
  const [prompts, setPrompts] = React.useState<TrackedPrompt[]>([])
  const [brands, setBrands] = React.useState<BrandEntity[]>([])
  const [domains, setDomains] = React.useState<SourceDomain[]>([])
  const [batches, setBatches] = React.useState<PipelineRunBatch[]>([])
  const effectiveFilters = React.useMemo(
    () =>
      normalizeChatFilters(filters, {
        brands,
        domains,
        prompts,
        topics,
      }),
    [brands, domains, filters, prompts, topics]
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
        const platformList = await loadActiveAiPlatforms(client)

        const [
          loadedTopics,
          loadedPrompts,
          loadedBrands,
          loadedDomains,
          loadedBatches,
        ] = await Promise.all([
          loadProjectTopics(client, currentProjectId),
          loadTrackedPromptsByProject(client, currentProjectId),
          loadBrandEntitiesByProject(client, currentProjectId),
          listProjectSourceDomains(client, currentProjectId),
          listPipelineRunBatches(client, currentProjectId),
        ])
        const normalizedFilters = normalizeChatFilters(filters, {
          brands: loadedBrands,
          domains: loadedDomains,
          prompts: loadedPrompts,
          topics: loadedTopics,
        })

        const loadedChats = await listChats(client, {
          filters: normalizedFilters,
          platforms: platformList,
          projectId: currentProjectId,
        })

        if (cancelled) {
          return
        }

        setTopics(loadedTopics.filter((topic) => topic.is_active))
        setPrompts(loadedPrompts)
        setBrands(loadedBrands)
        setDomains(loadedDomains)
        setBatches(loadedBatches)
        setChats(loadedChats)

        const nextQs = filtersToQueryString(normalizedFilters)
        const currentQs = searchParams.toString()

        if (nextQs !== currentQs) {
          router.replace(nextQs ? `${pathname}?${nextQs}` : pathname)
        }
      } catch (caught) {
        if (cancelled) {
          return
        }

        setError(
          caught instanceof Error ? caught.message : "Unable to load chats."
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
  }, [filters, pathname, projectId, router, searchParams])

  const filteredChats = React.useMemo(
    () => applyFilters(chats, effectiveFilters),
    [chats, effectiveFilters]
  )

  function setFilters(next: ChatFilters) {
    const qs = filtersToQueryString(next)

    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  function hrefForChat(promptRunId: string): string {
    const qs = searchParams.toString()

    return qs
      ? `/dashboard/chats/${promptRunId}?${qs}`
      : `/dashboard/chats/${promptRunId}`
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-6 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every prompt run across your tracked topics and platforms.
          </p>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {filteredChats.length} result{filteredChats.length === 1 ? "" : "s"}
        </div>
      </div>

      <ChatsFilterBar
        batches={batches}
        brands={brands}
        domains={domains}
        filters={effectiveFilters}
        onChange={setFilters}
        prompts={prompts}
        topics={topics}
      />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <ChatsTable chats={filteredChats} hrefForChat={hrefForChat} />
      )}
    </div>
  )
}
