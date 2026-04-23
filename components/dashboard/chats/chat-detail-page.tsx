"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { ChatBrandsPanel } from "@/components/dashboard/chats/chat-brands-panel"
import { ChatDetailHeader } from "@/components/dashboard/chats/chat-detail-header"
import { ChatPlatformToggle } from "@/components/dashboard/chats/chat-platform-toggle"
import { ChatResponseBody } from "@/components/dashboard/chats/chat-response-body"
import { ChatSourcesSection } from "@/components/dashboard/chats/chat-sources-section"
import { Skeleton } from "@/components/ui/skeleton"
import { loadActiveAiPlatforms } from "@/lib/ai-platforms/repository"
import { loadBrandEntitiesByProject } from "@/lib/brand-entities/repository"
import type { BrandEntity } from "@/lib/brand-entities/types"
import { getChatDetail } from "@/lib/chats/repository"
import type { ChatDetail } from "@/lib/chats/types"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"

export function ChatDetailPage({
  promptRunId,
}: {
  promptRunId: string
}) {
  const { brand } = useAuth()
  const projectId = brand?.id ?? null
  const searchParams = useSearchParams()

  const [detail, setDetail] = React.useState<ChatDetail | null>(null)
  const [projectBrands, setProjectBrands] = React.useState<BrandEntity[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activePlatform, setActivePlatform] = React.useState<string | null>(
    null
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
        const [platforms, brands] = await Promise.all([
          loadActiveAiPlatforms(client),
          loadBrandEntitiesByProject(client, currentProjectId),
        ])

        const loaded = await getChatDetail(client, {
          brands,
          platforms,
          projectId: currentProjectId,
          promptRunId,
        })

        if (cancelled) {
          return
        }

        setProjectBrands(brands)
        setDetail(loaded)
        setActivePlatform(
          loaded?.responses[0]?.response.platform_code ?? null
        )
      } catch (caught) {
        if (cancelled) {
          return
        }

        setError(
          caught instanceof Error ? caught.message : "Unable to load chat."
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
  }, [projectId, promptRunId])

  const backHref = React.useMemo(() => {
    const qs = searchParams.toString()

    return qs ? `/dashboard/chats?${qs}` : "/dashboard/chats"
  }, [searchParams])

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-2/3" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.35fr)]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          This chat could not be found.
        </div>
      </div>
    )
  }

  const activeView =
    detail.responses.find(
      (view) => view.response.platform_code === activePlatform
    ) ?? detail.responses[0]

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
      <ChatDetailHeader
        backHref={backHref}
        chatSentiment={detail.chatSentiment}
        promptRun={detail.promptRun}
        topic={detail.topic}
        trackedPrompt={detail.trackedPrompt}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.35fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <ChatPlatformToggle
            activeCode={activeView?.response.platform_code ?? ""}
            onChange={setActivePlatform}
            responses={detail.responses}
          />

          {activeView ? (
            <>
              <div className="rounded-xl border border-border bg-card p-6">
                <ChatResponseBody view={activeView} />
              </div>
              <ChatSourcesSection group={activeView.sources} />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No responses yet for this chat.
            </div>
          )}
        </div>

        <ChatBrandsPanel
          mentions={activeView?.brands ?? []}
          projectBrands={projectBrands}
        />
      </div>
    </div>
  )
}
