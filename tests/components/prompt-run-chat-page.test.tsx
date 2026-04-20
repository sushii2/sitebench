import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockFetchPromptRunChatPayload } = vi.hoisted(() => ({
  mockFetchPromptRunChatPayload: vi.fn(),
}))

vi.mock("@/lib/prompt-pipeline/client", () => ({
  fetchPromptRunChatPayload: mockFetchPromptRunChatPayload,
}))

import { PromptRunChatPage } from "@/components/dashboard/chats/prompt-run-chat-page"

describe("PromptRunChatPage", () => {
  beforeEach(() => {
    mockFetchPromptRunChatPayload.mockReset()
    mockFetchPromptRunChatPayload.mockResolvedValue({
      promptRun: {
        id: "prompt-run-1",
        status: "completed",
      },
      providerResponses: [
        {
          brands: [
            {
              citationCount: 1,
              id: "brand-1",
              name: "Acme",
              recommendationStatus: "recommended",
              sentimentLabel: "positive",
              visibilityScore: 91,
            },
          ],
          citations: [
            {
              citationText: "Independent review",
              id: "citation-1",
              pageTitle: "Acme Review",
              url: "https://example.com/review",
            },
          ],
          errorMessage: null,
          platformCode: "chatgpt",
          rawResponseJson: {
            text: "Acme is strong for observability teams.",
          },
          rawResponseText: "Acme is strong for observability teams.",
        },
      ],
      recentPromptRuns: [
        {
          id: "prompt-run-1",
          promptText: "Best observability platforms",
          ranAt: "2026-04-20T12:00:00.000Z",
          status: "completed",
          topicName: "Observability",
        },
      ],
      topicName: "Observability",
      trackedPromptText: "Best observability platforms",
    })
  })

  it("loads the replay payload and renders provider tabs with raw json", async () => {
    render(<PromptRunChatPage promptRunId="prompt-run-1" />)

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Best observability platforms" })
      ).toBeInTheDocument()
    })

    expect(screen.getByRole("tab", { name: /chatgpt/i })).toBeInTheDocument()
    expect(screen.getByText("Acme Review")).toBeInTheDocument()
    expect(screen.getByText("Acme")).toBeInTheDocument()
    expect(
      screen.getAllByText(/Acme is strong for observability teams\./i).length
    ).toBeGreaterThan(0)
    expect(mockFetchPromptRunChatPayload).toHaveBeenCalledWith("prompt-run-1")
  })
})
