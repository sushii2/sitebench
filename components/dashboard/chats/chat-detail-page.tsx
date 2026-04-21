"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { ChatBrandsPanel } from "@/components/dashboard/chats/chat-brands-panel"
import { ChatDetailHeader } from "@/components/dashboard/chats/chat-detail-header"
import { ChatPlatformToggle } from "@/components/dashboard/chats/chat-platform-toggle"
import { ChatResponseBody } from "@/components/dashboard/chats/chat-response-body"
import { ChatSourcesSection } from "@/components/dashboard/chats/chat-sources-section"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { loadActiveAiPlatforms } from "@/lib/ai-platforms/repository"
import { loadBrandEntitiesByProject } from "@/lib/brand-entities/repository"
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
      <div className="flex flex-1 flex-col p-4 pt-0">
        <Card className="min-h-[calc(100svh-6rem)]">
          <CardHeader>
            <CardTitle className="text-2xl">Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !detail) {
    return (
      <div className="flex flex-1 flex-col p-4 pt-0">
        <Card className="min-h-[calc(100svh-6rem)]">
          <CardHeader>
            <Skeleton className="h-6 w-2/3" />
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.4fr)]">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeView =
    detail.responses.find(
      (view) => view.response.platform_code === activePlatform
    ) ?? detail.responses[0]

  return (
    <div className="flex flex-1 flex-col p-4 pt-0">
      <Card className="min-h-[calc(100svh-6rem)]">
        <CardHeader className="space-y-4 border-b">
          <ChatDetailHeader
            backHref={backHref}
            promptRun={detail.promptRun}
            topic={detail.topic}
            trackedPrompt={detail.trackedPrompt}
          />
        </CardHeader>
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.4fr)]">
          <div className="flex flex-col gap-4">
            <ChatPlatformToggle
              activeCode={activeView?.response.platform_code ?? ""}
              onChange={setActivePlatform}
              responses={detail.responses}
            />
            {activeView ? (
              <>
                <ChatResponseBody view={activeView} />
                <ChatSourcesSection group={activeView.sources} />
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                No responses yet.
              </div>
            )}
          </div>
          <ChatBrandsPanel mentions={activeView?.brands ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
