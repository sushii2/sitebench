import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    brand: {
      id: "project-1",
      company_name: "Acme",
      competitors: [],
      created_at: "2026-01-01T00:00:00.000Z",
      description: "",
      onboarding_completed_at: "2026-01-02T00:00:00.000Z",
      topics: [],
      updated_at: "2026-01-01T00:00:00.000Z",
      user_id: "user-1",
      website: "https://acme.test",
    },
  }),
}))

vi.mock("@/lib/insforge/browser-client", () => ({
  getInsforgeBrowserClient: () => ({}),
}))

vi.mock("@/lib/logo-dev/config", () => ({
  resolveLogoDevPublicConfig: () => ({ publishableKey: "pk_test" }),
}))

vi.mock("@/lib/project-topics/repository", () => ({
  loadProjectTopics: vi.fn(),
}))

vi.mock("@/lib/tracked-prompts/repository", () => ({
  loadTrackedPromptsByProject: vi.fn(),
}))

import { PromptsPage } from "@/components/dashboard/prompts/prompts-page"
import { loadProjectTopics } from "@/lib/project-topics/repository"
import { loadTrackedPromptsByProject } from "@/lib/tracked-prompts/repository"

const loadProjectTopicsMock = loadProjectTopics as unknown as ReturnType<
  typeof vi.fn
>
const loadTrackedPromptsByProjectMock =
  loadTrackedPromptsByProject as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  loadProjectTopicsMock.mockReset()
  loadTrackedPromptsByProjectMock.mockReset()
})

describe("PromptsPage", () => {
  it("renders topics and their prompts", async () => {
    loadProjectTopicsMock.mockResolvedValue([
      {
        id: "topic-1",
        project_id: "project-1",
        topic_catalog_id: null,
        name: "Business Credit Cards",
        normalized_name: "business credit cards",
        default_cadence: "weekly",
        source: "user_added",
        sort_order: 0,
        is_active: true,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
      },
    ])

    loadTrackedPromptsByProjectMock.mockResolvedValue([
      {
        id: "prompt-1",
        project_id: "project-1",
        project_topic_id: "topic-1",
        prompt_catalog_id: null,
        prompt_text: "Best business credit cards for startups",
        normalized_prompt: "best business credit cards for startups",
        cadence_override: null,
        added_via: "user_created",
        variant_type: null,
        pqs_score: null,
        pqs_rank: null,
        score_status: "unscored",
        score_metadata: {},
        source_analysis_run_id: null,
        is_active: true,
        last_chat_prompt_run_id: "prompt-run-1",
        last_failure_message: null,
        next_run_at: null,
        last_run_status: "completed",
        last_run_at: null,
        created_at: "2026-04-05T00:00:00.000Z",
        updated_at: "2026-04-05T00:00:00.000Z",
      },
    ])

    render(<PromptsPage />)

    expect(
      await screen.findByText("Business Credit Cards")
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByText("Best business credit cards for startups")
      ).toBeInTheDocument()
    })

    expect(screen.getByRole("heading", { name: "Prompts" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /add prompt/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /chatgpt/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /claude/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /perplexity/i })).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /open chat/i })
    ).toHaveAttribute("href", "/dashboard/chats?promptRunId=prompt-run-1")
  })

  it("shows the empty state when there are no topics", async () => {
    loadProjectTopicsMock.mockResolvedValue([])
    loadTrackedPromptsByProjectMock.mockResolvedValue([])

    render(<PromptsPage />)

    expect(
      await screen.findByText("No prompts tracked yet.")
    ).toBeInTheDocument()
  })
})
