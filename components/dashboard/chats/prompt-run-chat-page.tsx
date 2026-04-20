"use client"

import * as React from "react"
import Link from "next/link"

import { Card } from "@/components/ui/card"
import { fetchPromptRunChatPayload } from "@/lib/prompt-pipeline/client"
import type { PromptRunChatPayload } from "@/lib/prompt-pipeline/types"

export function PromptRunChatPage({
  promptRunId,
}: {
  promptRunId: string | null
}) {
  const [payload, setPayload] = React.useState<PromptRunChatPayload | null>(null)
  const [activePlatform, setActivePlatform] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(Boolean(promptRunId))

  React.useEffect(() => {
    if (!promptRunId) {
      setPayload(null)
      setActivePlatform(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    const currentPromptRunId = promptRunId

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const result = (await fetchPromptRunChatPayload(
          currentPromptRunId
        )) as PromptRunChatPayload

        if (cancelled) {
          return
        }

        setPayload(result)
        setActivePlatform(result.providerResponses[0]?.platformCode ?? null)
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Unable to load replay."
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [promptRunId])

  const activeResponse =
    payload?.providerResponses.find(
      (response) => response.platformCode === activePlatform
    ) ?? payload?.providerResponses[0] ?? null

  if (!promptRunId) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
        <Card className="p-6 text-sm text-muted-foreground">
          Select a prompt run from the prompts table to replay the saved answers.
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      </div>
    )
  }

  if (isLoading || !payload || !activeResponse) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
        <Card className="p-6 text-sm text-muted-foreground">
          Loading replay...
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
      <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="space-y-3 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Recent prompt runs
          </p>
          <div className="space-y-2">
            {payload.recentPromptRuns.map((recentRun) => (
              <Link
                key={recentRun.id}
                className="block border border-border px-3 py-2 text-sm hover:bg-muted"
                href={`/dashboard/chats?promptRunId=${recentRun.id}`}
              >
                <p className="font-medium">{recentRun.promptText}</p>
                <p className="text-xs text-muted-foreground">
                  {recentRun.topicName}
                </p>
              </Link>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {payload.topicName}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                {payload.trackedPromptText}
              </h2>
            </div>

            <div
              aria-label="Provider tabs"
              className="flex gap-2 border-b border-border pb-3"
              role="tablist"
            >
              {payload.providerResponses.map((response) => (
                <button
                  key={response.platformCode}
                  aria-selected={activePlatform === response.platformCode}
                  className="border border-border px-3 py-1.5 text-sm aria-selected:bg-foreground aria-selected:text-background"
                  role="tab"
                  type="button"
                  onClick={() => setActivePlatform(response.platformCode)}
                >
                  {response.platformCode === "chatgpt"
                    ? "ChatGPT"
                    : response.platformCode === "claude"
                      ? "Claude"
                      : "Perplexity"}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <section className="space-y-2">
                <h2 className="text-sm font-medium">Answer</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  {activeResponse.rawResponseText ?? activeResponse.errorMessage}
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-medium">Citations</h2>
                <div className="space-y-2">
                  {activeResponse.citations.map((citation) => (
                    <a
                      key={citation.id}
                      className="block border border-border px-3 py-2 text-sm hover:bg-muted"
                      href={citation.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <p className="font-medium">
                        {citation.pageTitle ?? citation.url}
                      </p>
                      {citation.citationText ? (
                        <p className="text-xs text-muted-foreground">
                          {citation.citationText}
                        </p>
                      ) : null}
                    </a>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-medium">Extracted brands</h2>
                <div className="flex flex-wrap gap-2">
                  {activeResponse.brands.map((brand) => (
                    <span
                      key={brand.id}
                      className="border border-border px-2 py-1 text-xs"
                    >
                      {brand.name}
                    </span>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-medium">Raw JSON</h2>
                <pre className="overflow-x-auto border border-border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(activeResponse.rawResponseJson, null, 2)}
                </pre>
              </section>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
