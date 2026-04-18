import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { BrandWithCompetitors } from "@/lib/brands"

const mockReplace = vi.fn()
const mockUseAuth = vi.fn()
const mockRefreshAuthState = vi.fn()
const mockSaveBrandDraftStep = vi.fn()
const mockFetchOnboardingTopicPrompts = vi.fn()
const mockCompleteOnboarding = vi.fn()
const mockStartOnboardingAnalysis = vi.fn()
const mockPollOnboardingAnalysis = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/lib/insforge/browser-client", () => ({
  getInsforgeBrowserClient: () => ({
    auth: {},
    database: {},
  }),
}))

vi.mock("@/lib/onboarding/client", () => ({
  completeOnboarding: mockCompleteOnboarding,
  fetchOnboardingTopicPrompts: mockFetchOnboardingTopicPrompts,
  pollOnboardingAnalysis: mockPollOnboardingAnalysis,
  startOnboardingAnalysis: mockStartOnboardingAnalysis,
}))

vi.mock("@/lib/brands", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/brands")>("@/lib/brands")

  return {
    ...actual,
    saveBrandDraftStep: mockSaveBrandDraftStep,
  }
})

function makeUser() {
  return {
    id: "user-1",
    email: "jane@example.com",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    metadata: null,
    profile: {
      name: "Jane Doe",
    },
  }
}

function makeBrand(
  overrides: Partial<BrandWithCompetitors> = {}
): BrandWithCompetitors {
  return {
    company_name: "Acme",
    competitors: [],
    created_at: "2026-01-01T00:00:00.000Z",
    description: "",
    id: "brand-1",
    onboarding_completed_at: null,
    topics: [],
    updated_at: "2026-01-01T00:00:00.000Z",
    user_id: "user-1",
    website: "https://acme.com",
    ...overrides,
  }
}

function makeAnalysisResult(
  overrides: Partial<{
    competitors: Array<{ name: string; website: string }>
    description: string
    topics: Array<{
      clusterId: string
      intentSummary: string
      prompts: Array<{
        addedVia: "ai_suggested" | "user_created"
        pqsRank?: number
        pqsScore?: number
        promptText: string
        scoreMetadata?: Record<string, number>
        scoreStatus?: "scored" | "stale" | "unscored"
        sourceAnalysisRunId?: string
        templateText?: string
        variantType?:
          | "discovery"
          | "comparison"
          | "alternatives"
          | "pricing"
          | "implementation"
          | "competitor_specific"
      }>
      source: "ai_suggested" | "user_added" | "system_seeded"
      sourceUrls: string[]
      topicName: string
    }>
    warnings: string[]
  }> = {}
) {
  return {
    competitors: [
      { name: "Competitor 1", website: "https://competitor-1.com" },
      { name: "Competitor 2", website: "https://competitor-2.com" },
      { name: "Competitor 3", website: "https://competitor-3.com" },
      { name: "Competitor 4", website: "https://competitor-4.com" },
    ],
    description: "Suggested description",
    topics: [
      {
        clusterId: "cluster-1",
        intentSummary: "Buyer discovery for AI search",
        prompts: [
          {
            addedVia: "ai_suggested",
            pqsRank: 1,
            pqsScore: 94,
            promptText:
              "Which platforms are best for measuring brand visibility across ChatGPT, Gemini, and Perplexity for brand teams?",
            scoreMetadata: { topicFit: 30 },
            scoreStatus: "scored",
            sourceAnalysisRunId: "analysis-1",
            templateText: "Which platforms are best for {topic}?",
            variantType: "discovery",
          },
          {
            addedVia: "ai_suggested",
            pqsRank: 2,
            pqsScore: 91,
            promptText:
              "For brand teams evaluating AI visibility platforms, how does Acme compare with Competitor 1 and Competitor 2 on coverage across AI answers, citation tracking, and executive reporting?",
            scoreMetadata: { topicFit: 29 },
            scoreStatus: "scored",
            sourceAnalysisRunId: "analysis-1",
            templateText:
              "How does {company} compare with {competitor_list} on {topic}?",
            variantType: "comparison",
          },
        ],
        source: "ai_suggested",
        sourceUrls: ["https://acme.com/compare/openai"],
        topicName: "ai search",
      },
      {
        clusterId: "cluster-2",
        intentSummary: "Evaluation of Google AI Mode workflows",
        prompts: [
          {
            addedVia: "ai_suggested",
            pqsRank: 1,
            pqsScore: 93,
            promptText:
              "What platforms help brand teams with measuring brand visibility across Google AI Mode, ChatGPT, and Gemini?",
            scoreMetadata: { topicFit: 30 },
            scoreStatus: "scored",
            sourceAnalysisRunId: "analysis-1",
            templateText: "What platforms help with {topic}?",
            variantType: "discovery",
          },
          {
            addedVia: "ai_suggested",
            pqsRank: 2,
            pqsScore: 90,
            promptText:
              "How does Acme stack up against Competitor 1 and Competitor 2 for coverage across AI answers, citation tracking, and executive reporting?",
            scoreMetadata: { topicFit: 29 },
            scoreStatus: "scored",
            sourceAnalysisRunId: "analysis-1",
            templateText:
              "How does {company} stack up against {competitor_list} for {topic}?",
            variantType: "comparison",
          },
        ],
        source: "ai_suggested",
        sourceUrls: ["https://acme.com/blog/google-ai-mode"],
        topicName: "google ai mode",
      },
      {
        clusterId: "cluster-3",
        intentSummary: "Perplexity evaluation and alternatives research",
        prompts: [
          {
            addedVia: "ai_suggested",
            pqsRank: 1,
            pqsScore: 92,
            promptText:
              "Which software do brand teams trust for measuring brand visibility across Perplexity, ChatGPT, and Gemini?",
            scoreMetadata: { topicFit: 30 },
            scoreStatus: "scored",
            sourceAnalysisRunId: "analysis-1",
            templateText:
              "Which software do teams trust for measuring {topic}?",
            variantType: "discovery",
          },
          {
            addedVia: "ai_suggested",
            pqsRank: 2,
            pqsScore: 89,
            promptText:
              "Which platform is stronger for teams that need coverage across AI answers, citation tracking, and executive reporting: Acme or Competitor 1 and Competitor 2?",
            scoreMetadata: { topicFit: 28 },
            scoreStatus: "scored",
            sourceAnalysisRunId: "analysis-1",
            templateText:
              "Which platform is stronger for teams that need {topic}: {company} or {competitor_list}?",
            variantType: "comparison",
          },
        ],
        source: "ai_suggested",
        sourceUrls: ["https://acme.com/alternatives/perplexity"],
        topicName: "perplexity",
      },
    ],
    warnings: [],
    ...overrides,
  }
}

function setAuthState(brand: BrandWithCompetitors | null) {
  mockUseAuth.mockReturnValue({
    authenticatedRedirectPath: "/onboarding",
    brand,
    isLoading: false,
    needsOnboarding: true,
    refreshAuthState: mockRefreshAuthState,
    refreshUser: vi.fn(),
    signOut: vi.fn(),
    user: makeUser(),
  })
}

async function renderWizard(brand: BrandWithCompetitors | null = null) {
  setAuthState(brand)

  const { OnboardingGate } = await import("@/components/onboarding-gate")

  return render(<OnboardingGate />)
}

async function renderWizardComponent(
  brand: BrandWithCompetitors | null = null
) {
  const { OnboardingWizard } = await import(
    "@/components/onboarding/onboarding-wizard"
  )

  return render(
    <OnboardingWizard
      brand={brand}
      refreshAuthState={mockRefreshAuthState}
    />
  )
}

beforeEach(() => {
  mockReplace.mockReset()
  mockUseAuth.mockReset()
  mockRefreshAuthState.mockReset()
  mockSaveBrandDraftStep.mockReset()
  mockFetchOnboardingTopicPrompts.mockReset()
  mockCompleteOnboarding.mockReset()
  mockStartOnboardingAnalysis.mockReset()
  mockPollOnboardingAnalysis.mockReset()
  process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY = "pk_test_123"

  mockStartOnboardingAnalysis.mockResolvedValue({
    analysisId: "analysis-1",
    status: "crawling",
    warnings: [],
  })
  mockPollOnboardingAnalysis.mockResolvedValue({
    analysisId: "analysis-1",
    result: makeAnalysisResult(),
    status: "completed",
    warnings: [],
  })
  mockFetchOnboardingTopicPrompts.mockResolvedValue({
    topics: [
      {
        prompts: [
          {
            addedVia: "ai_suggested",
            promptText:
              "Which platforms are best for measuring brand visibility across ChatGPT, Gemini, and Perplexity for brand teams?",
          },
          {
            addedVia: "ai_suggested",
            promptText:
              "For brand teams evaluating AI visibility platforms, how does Acme compare with Competitor 1 and Competitor 2 on coverage across AI answers, citation tracking, and executive reporting?",
          },
        ],
        source: "ai_suggested",
        topicName: "ai search",
      },
      {
        prompts: [
          {
            addedVia: "ai_suggested",
            promptText:
              "What platforms help brand teams with measuring brand visibility across Google AI Mode, ChatGPT, and Gemini?",
          },
          {
            addedVia: "ai_suggested",
            promptText:
              "How does Acme stack up against Competitor 1 and Competitor 2 for coverage across AI answers, citation tracking, and executive reporting?",
          },
        ],
        source: "ai_suggested",
        topicName: "google ai mode",
      },
      {
        prompts: [
          {
            addedVia: "ai_suggested",
            promptText:
              "Which software do brand teams trust for measuring brand visibility across Perplexity, ChatGPT, and Gemini?",
          },
          {
            addedVia: "ai_suggested",
            promptText:
              "Which platform is stronger for teams that need coverage across AI answers, citation tracking, and executive reporting: Acme or Competitor 1 and Competitor 2?",
          },
        ],
        source: "ai_suggested",
        topicName: "perplexity",
      },
    ],
    warnings: [],
  })
  mockCompleteOnboarding.mockResolvedValue(
    makeBrand({
      company_name: "Acme",
      description: "Description",
      onboarding_completed_at: "2026-01-02T00:00:00.000Z",
      topics: ["ai search", "google ai mode", "perplexity"],
      website: "https://acme.com",
    })
  )

  mockRefreshAuthState.mockResolvedValue({
    authenticatedRedirectPath: "/dashboard",
    brand: makeBrand({
      competitors: [
        {
          brand_id: "brand-1",
          created_at: "2026-01-01T00:00:00.000Z",
          id: "competitor-1",
          name: "Competitor 1",
          updated_at: "2026-01-01T00:00:00.000Z",
          user_id: "user-1",
          website: "https://competitor-1.com",
        },
        {
          brand_id: "brand-1",
          created_at: "2026-01-01T00:00:00.000Z",
          id: "competitor-2",
          name: "Competitor 2",
          updated_at: "2026-01-01T00:00:00.000Z",
          user_id: "user-1",
          website: "https://competitor-2.com",
        },
        {
          brand_id: "brand-1",
          created_at: "2026-01-01T00:00:00.000Z",
          id: "competitor-3",
          name: "Competitor 3",
          updated_at: "2026-01-01T00:00:00.000Z",
          user_id: "user-1",
          website: "https://competitor-3.com",
        },
      ],
      description: "Description",
      onboarding_completed_at: "2026-01-02T00:00:00.000Z",
      topics: ["ai search", "google ai mode", "perplexity"],
    }),
    needsOnboarding: false,
    user: makeUser(),
  })
})

describe("Onboarding wizard", () => {
  it("renders step 1 by default for a first-time user", async () => {
    await renderWizard()

    expect(
      screen.getByRole("heading", { name: "Let's set up your brand" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Brand basics").length).toBeGreaterThan(0)
    expect(screen.getByLabelText("Company website")).toBeInTheDocument()
    expect(screen.getByLabelText("Company name")).toBeInTheDocument()
  })

  it("blocks invalid step 1 submissions", async () => {
    const user = userEvent.setup()

    await renderWizard()

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(mockSaveBrandDraftStep).not.toHaveBeenCalled()
    expect(
      await screen.findByText("Enter your company website")
    ).toBeInTheDocument()
    expect(screen.getByText("Enter your company name")).toBeInTheDocument()
  })

  it("blocks malformed brand details on step 1", async () => {
    const user = userEvent.setup()

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "foo")
    await user.type(screen.getByLabelText("Company name"), "acme.com")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(mockSaveBrandDraftStep).not.toHaveBeenCalled()
    expect(await screen.findByText("Enter a valid website")).toBeInTheDocument()
    expect(
      screen.getByText("Enter a valid company name")
    ).toBeInTheDocument()
    expect(screen.queryByText("https://foo")).not.toBeInTheDocument()
  })

  it("shows a live brand preview on step 1 when the website is valid", async () => {
    const user = userEvent.setup()

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")

    expect(await screen.findByText("https://acme.com")).toBeInTheDocument()
  })

  it("shows an inline error when saving step 1 fails", async () => {
    const user = userEvent.setup()

    mockSaveBrandDraftStep.mockRejectedValue(new Error("Schema mismatch"))

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByText("Schema mismatch")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Let's set up your brand" })
    ).toBeInTheDocument()
  })

  it("saves step 1 and advances to step 2", async () => {
    const user = userEvent.setup()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() =>
      expect(mockSaveBrandDraftStep).toHaveBeenCalledWith(expect.any(Object), {
        company_name: "Acme",
        website: "acme.com",
      })
    )
    await waitFor(() =>
      expect(mockStartOnboardingAnalysis).toHaveBeenCalledWith({
        companyName: "Acme",
        projectId: "brand-1",
        website: "acme.com",
      })
    )
    await waitFor(() =>
      expect(mockPollOnboardingAnalysis).toHaveBeenCalledWith("analysis-1")
    )

    await waitFor(() =>
      expect(screen.getAllByText("Description").length).toBeGreaterThan(0)
    )
    expect(
      screen.getByRole("heading", { name: "Describe what you do" })
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue("Suggested description")).toBeInTheDocument()
  })

  it("shows an inline loading state while step 1 analysis is in flight", async () => {
    const user = userEvent.setup()

    let resolveAnalysis: (
      value: {
        analysisId: string
        result: ReturnType<typeof makeAnalysisResult>
        status: "completed"
        warnings: string[]
      }
    ) => void

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )
    mockPollOnboardingAnalysis.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAnalysis = resolve
        })
    )

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByText("Analyzing your website context")
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(mockPollOnboardingAnalysis).toHaveBeenCalledWith("analysis-1")
    )

    resolveAnalysis!({
      analysisId: "analysis-1",
      result: makeAnalysisResult(),
      status: "completed",
      warnings: [],
    })

    expect(
      await screen.findByRole("heading", { name: "Describe what you do" })
    ).toBeInTheDocument()
  })

  it("keeps polling until the analysis reaches a terminal state", async () => {
    const user = userEvent.setup()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )

    mockPollOnboardingAnalysis
      .mockResolvedValueOnce({
        analysisId: "analysis-1",
        status: "crawling",
        warnings: [],
      })
      .mockResolvedValueOnce({
        analysisId: "analysis-1",
        result: makeAnalysisResult(),
        status: "completed",
        warnings: [],
      })

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() =>
      expect(mockPollOnboardingAnalysis).toHaveBeenCalledTimes(1)
    )

    await waitFor(
      () => expect(mockPollOnboardingAnalysis).toHaveBeenCalledTimes(2),
      {
        timeout: 2000,
      }
    )

    expect(
      await screen.findByRole("heading", { name: "Describe what you do" })
    ).toBeInTheDocument()
  })

  it(
    "does not fail long-running analysis before completion",
    async () => {
    const user = userEvent.setup()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )

    let pollCount = 0
    mockPollOnboardingAnalysis.mockImplementation(async () => {
      pollCount += 1

      if (pollCount <= 22) {
        return {
          analysisId: "analysis-1",
          status: "crawling" as const,
          warnings: [],
        }
      }

      return {
        analysisId: "analysis-1",
        result: makeAnalysisResult(),
        status: "completed" as const,
        warnings: [],
      }
    })

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(
      () => expect(mockPollOnboardingAnalysis).toHaveBeenCalledTimes(23),
      {
        timeout: 10000,
      }
    )

    expect(
      await screen.findByRole("heading", { name: "Describe what you do" })
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        "Analysis timed out before the crawl finished. Continue manually."
      )
    ).not.toBeInTheDocument()
    },
    15000
  )

  it("blocks invalid step 2 submissions", async () => {
    const user = userEvent.setup()

    await renderWizard(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )

    expect(screen.getAllByText("Description").length).toBeGreaterThan(0)
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(mockSaveBrandDraftStep).not.toHaveBeenCalled()
    expect(
      await screen.findByText("Tell us about your business")
    ).toBeInTheDocument()
  })

  it("adds normalized topics, rejects duplicates, and enforces the cap", async () => {
    const user = userEvent.setup()

    await renderWizard(
      makeBrand({
        company_name: "Acme",
        competitors: [
          {
            brand_id: "brand-1",
            created_at: "2026-01-01T00:00:00.000Z",
            id: "competitor-1",
            name: "Competitor 1",
            updated_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            website: "https://competitor-1.com",
          },
          {
            brand_id: "brand-1",
            created_at: "2026-01-01T00:00:00.000Z",
            id: "competitor-2",
            name: "Competitor 2",
            updated_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            website: "https://competitor-2.com",
          },
          {
            brand_id: "brand-1",
            created_at: "2026-01-01T00:00:00.000Z",
            id: "competitor-3",
            name: "Competitor 3",
            updated_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            website: "https://competitor-3.com",
          },
        ],
        description: "Description",
        topics: [],
        website: "https://acme.com",
      })
    )

    const topicInput = screen.getByLabelText("Add a topic")

    await user.type(topicInput, "AI Search")
    await user.keyboard("{Enter}")
    await user.type(topicInput, "ai search")
    await user.keyboard("{Enter}")

    expect(screen.getAllByText("ai search")).toHaveLength(1)
    expect(
      await screen.findByText("That topic is already added.")
    ).toBeInTheDocument()

    for (const topic of [
      "Google AI Mode",
      "Perplexity",
      "LLM visibility",
      "Brand search",
      "Answer engines",
      "AI citations",
      "Generated snippets",
      "AIO",
      "Discoverability",
    ]) {
      await user.clear(topicInput)
      await user.type(topicInput, topic)
      await user.keyboard("{Enter}")
    }

    await user.clear(topicInput)
    await user.type(topicInput, "One too many")
    await user.keyboard("{Enter}")

    expect(
      await screen.findByText("You can add up to 10 topics.")
    ).toBeInTheDocument()
  })

  it("restores saved draft values and lands on the first incomplete step", async () => {
    await renderWizard(
      makeBrand({
        company_name: "Acme",
        competitors: [
          {
            brand_id: "brand-1",
            created_at: "2026-01-01T00:00:00.000Z",
            id: "competitor-1",
            name: "Competitor 1",
            updated_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            website: "https://competitor-1.com",
          },
          {
            brand_id: "brand-1",
            created_at: "2026-01-01T00:00:00.000Z",
            id: "competitor-2",
            name: "Competitor 2",
            updated_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            website: "https://competitor-2.com",
          },
        ],
        description: "Description",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "https://acme.com",
      })
    )

    expect(screen.getAllByText("Competitors").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Competitor 1").length).toBeGreaterThan(0)
    expect(
      screen.getAllByText("https://competitor-2.com").length
    ).toBeGreaterThan(0)
  })

  it("prefills the later onboarding steps from generated suggestions", async () => {
    const user = userEvent.setup()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByDisplayValue("Suggested description")).toBeInTheDocument()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        description: "Suggested description",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "https://acme.com",
      })
    )

    await user.click(screen.getByRole("button", { name: "Continue" }))

    const competitorOneMatches = await screen.findAllByText("Competitor 1")
    expect(competitorOneMatches.length).toBeGreaterThan(0)
    expect(
      screen.getAllByText("https://competitor-4.com").length
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByText("ai search")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Which platforms are best for measuring brand visibility across ChatGPT, Gemini, and Perplexity for brand teams?"
      )
    ).toBeInTheDocument()
  })

  it("logs the fetched onboarding suggestions before applying them to wizard state", async () => {
    const user = userEvent.setup()
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByDisplayValue("Suggested description")).toBeInTheDocument()
    expect(logSpy).toHaveBeenCalledWith(
      "[onboarding] Applying generated suggestions to wizard",
      {
        competitorCount: 4,
        descriptionLength: "Suggested description".length,
        topics: ["ai search", "google ai mode", "perplexity"],
        warnings: [],
      }
    )

    logSpy.mockRestore()
  })

  it("shows warnings from generated suggestions and still advances", async () => {
    const user = userEvent.setup()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )
    mockPollOnboardingAnalysis.mockResolvedValue({
      analysisId: "analysis-1",
      result: makeAnalysisResult({
        competitors: [],
        description: "",
        topics: [],
        warnings: [
          "We found fewer than 3 strong topics. Review and add topics before continuing.",
        ],
      }),
      status: "completed",
      warnings: [],
    })

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByRole("heading", { name: "Describe what you do" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/We found fewer than 3 strong topics\./)
    ).toBeInTheDocument()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        description: "Manual description",
        topics: [],
        website: "https://acme.com",
      })
    )

    await user.type(
      screen.getByLabelText("Business description"),
      "Manual description"
    )
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByRole("heading", { name: "Add your competitors" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/We found fewer than 3 strong topics\./)
    ).toBeInTheDocument()
  })

  it("shows a page warning when the AI could not load any topics or competitors", async () => {
    const user = userEvent.setup()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )
    mockPollOnboardingAnalysis.mockResolvedValue({
      analysisId: "analysis-1",
      result: makeAnalysisResult({
        competitors: [],
        topics: [],
      }),
      status: "completed",
      warnings: [],
    })

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      await screen.findByRole("heading", { name: "Describe what you do" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/The analysis could not load any topics\./)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/The analysis could not load any competitors\./)
    ).toBeInTheDocument()
  })

  it("replaces local generated values when step 1 is submitted again", async () => {
    const user = userEvent.setup()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )
    mockStartOnboardingAnalysis
      .mockResolvedValueOnce({
        analysisId: "analysis-1",
        status: "crawling",
        warnings: [],
      })
      .mockResolvedValueOnce({
        analysisId: "analysis-2",
        status: "crawling",
        warnings: [],
      })
    mockPollOnboardingAnalysis
      .mockResolvedValueOnce({
        analysisId: "analysis-1",
        result: makeAnalysisResult({
          competitors: [
            { name: "Competitor 1", website: "https://competitor-1.com" },
            { name: "Competitor 2", website: "https://competitor-2.com" },
            { name: "Competitor 3", website: "https://competitor-3.com" },
          ],
          description: "First suggestion",
          topics: [
            {
              clusterId: "cluster-1",
              intentSummary: "AI search evaluation",
              prompts: [],
              source: "ai_suggested",
              sourceUrls: ["https://acme.com/compare"],
              topicName: "ai search",
            },
            {
              clusterId: "cluster-2",
              intentSummary: "Perplexity evaluation",
              prompts: [],
              source: "ai_suggested",
              sourceUrls: ["https://acme.com/alternatives"],
              topicName: "perplexity",
            },
            {
              clusterId: "cluster-3",
              intentSummary: "Brand search evaluation",
              prompts: [],
              source: "ai_suggested",
              sourceUrls: ["https://acme.com/blog/brand-search"],
              topicName: "brand search",
            },
          ],
          warnings: [],
        }),
        status: "completed",
        warnings: [],
      })
      .mockResolvedValueOnce({
        analysisId: "analysis-2",
        result: makeAnalysisResult({
          competitors: [
            { name: "Competitor X", website: "https://competitor-x.com" },
            { name: "Competitor Y", website: "https://competitor-y.com" },
            { name: "Competitor Z", website: "https://competitor-z.com" },
          ],
          description: "Second suggestion",
          topics: [
            {
              clusterId: "cluster-1",
              intentSummary: "LLM visibility evaluation",
              prompts: [],
              source: "ai_suggested",
              sourceUrls: ["https://acme.ai/pricing"],
              topicName: "llm visibility",
            },
            {
              clusterId: "cluster-2",
              intentSummary: "Answer engines evaluation",
              prompts: [],
              source: "ai_suggested",
              sourceUrls: ["https://acme.ai/blog/answer-engines"],
              topicName: "answer engines",
            },
            {
              clusterId: "cluster-3",
              intentSummary: "AI citations evaluation",
              prompts: [],
              source: "ai_suggested",
              sourceUrls: ["https://acme.ai/compare/citations"],
              topicName: "ai citations",
            },
          ],
          warnings: [],
        }),
        status: "completed",
        warnings: [],
      })

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByDisplayValue("First suggestion")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Back" }))
    await user.clear(screen.getByLabelText("Company website"))
    await user.type(screen.getByLabelText("Company website"), "acme.ai")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByDisplayValue("Second suggestion")).toBeInTheDocument()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        description: "Second suggestion",
        topics: ["llm visibility", "answer engines", "ai citations"],
        website: "https://acme.ai",
      })
    )

    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect(
      (await screen.findAllByText("Competitor X")).length
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect(await screen.findByText("llm visibility")).toBeInTheDocument()
  })

  it("preserves generated topics and competitors when the brand prop updates mid-onboarding", async () => {
    const user = userEvent.setup()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )

    const view = await renderWizardComponent()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(await screen.findByDisplayValue("Suggested description")).toBeInTheDocument()

    const { OnboardingWizard } = await import(
      "@/components/onboarding/onboarding-wizard"
    )

    view.rerender(
      <OnboardingWizard
        brand={makeBrand({
          company_name: "Acme",
          description: "Suggested description",
          topics: [],
          website: "https://acme.com",
        })}
        refreshAuthState={mockRefreshAuthState}
      />
    )

    expect((await screen.findAllByText("Competitor 1")).length).toBeGreaterThan(
      0
    )

    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect(await screen.findByText("ai search")).toBeInTheDocument()
  })

  it("adds and removes competitor rows, then completes onboarding", async () => {
    const user = userEvent.setup()

    await renderWizard(
      makeBrand({
        company_name: "Acme",
        description: "Description",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "https://acme.com",
      })
    )

    await user.click(screen.getByRole("button", { name: "Add competitor" }))

    // The newly added 4th row is in edit mode with empty fields; its Cancel
    // button removes the row when there's more than one competitor.
    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" })
    await user.click(cancelButtons[3]!)

    const nameInputs = screen.getAllByLabelText(/Competitor name/i)
    const websiteInputs = screen.getAllByLabelText(/Competitor website/i)

    await user.type(nameInputs[0]!, "Competitor 1")
    await user.type(websiteInputs[0]!, "competitor-1.com")
    await user.type(nameInputs[1]!, "Competitor 2")
    await user.type(websiteInputs[1]!, "competitor-2.com")
    await user.type(nameInputs[2]!, "Competitor 3")
    await user.type(websiteInputs[2]!, "competitor-3.com")

    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect(await screen.findByRole("button", { name: "Complete setup" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Complete setup" }))

    await waitFor(() =>
      expect(mockCompleteOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: "Acme",
          competitors: [
            { name: "Competitor 1", website: "competitor-1.com" },
            { name: "Competitor 2", website: "competitor-2.com" },
            { name: "Competitor 3", website: "competitor-3.com" },
          ],
          projectId: "brand-1",
        })
      )
    )
    await waitFor(() => expect(mockRefreshAuthState).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"))
    expect(mockRefreshAuthState.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0]
    )
  })

  it("shows live competitor previews as websites are entered", async () => {
    const user = userEvent.setup()

    await renderWizard(
      makeBrand({
        company_name: "Acme",
        description: "Description",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "https://acme.com",
      })
    )

    const websiteInputs = screen.getAllByLabelText(/Competitor website/i)

    await user.type(websiteInputs[0]!, "competitor-1.com")

    expect(
      await screen.findByText("https://competitor-1.com")
    ).toBeInTheDocument()
  })

  it("shows an inline error when final completion fails", async () => {
    const user = userEvent.setup()
    mockCompleteOnboarding.mockRejectedValue(new Error("Completion unavailable"))

    await renderWizard(
      makeBrand({
        company_name: "Acme",
        description: "Description",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "https://acme.com",
      })
    )

    const nameInputs = screen.getAllByLabelText(/Competitor name/i)
    const websiteInputs = screen.getAllByLabelText(/Competitor website/i)

    await user.type(nameInputs[0]!, "Competitor 1")
    await user.type(websiteInputs[0]!, "competitor-1.com")
    await user.type(nameInputs[1]!, "Competitor 2")
    await user.type(websiteInputs[1]!, "competitor-2.com")
    await user.type(nameInputs[2]!, "Competitor 3")
    await user.type(websiteInputs[2]!, "competitor-3.com")

    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Complete setup" }))

    expect(
      await screen.findByText("Completion unavailable")
    ).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("blocks completion until three valid competitors exist", async () => {
    const user = userEvent.setup()

    await renderWizard(
      makeBrand({
        company_name: "Acme",
        description: "Description",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "https://acme.com",
      })
    )

    const nameInputs = screen.getAllByLabelText(/Competitor name/i)
    const websiteInputs = screen.getAllByLabelText(/Competitor website/i)

    await user.type(nameInputs[0]!, "Competitor 1")
    await user.type(websiteInputs[0]!, "competitor-1.com")
    await user.type(nameInputs[1]!, "Competitor 2")
    await user.type(websiteInputs[1]!, "competitor-2.com")

    await user.click(screen.getByRole("button", { name: "Continue" }))

    expect(mockFetchOnboardingTopicPrompts).not.toHaveBeenCalled()
    expect(
      await screen.findByText("Add at least 3 competitors.")
    ).toBeInTheDocument()
  })

  it("revalidates earlier steps before completing onboarding", async () => {
    const user = userEvent.setup()

    await renderWizard(
      makeBrand({
        company_name: "acme.com",
        description: "Description",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "foo",
      })
    )

    const nameInputs = screen.getAllByLabelText(/Competitor name/i)
    const websiteInputs = screen.getAllByLabelText(/Competitor website/i)

    await user.type(nameInputs[0]!, "Competitor 1")
    await user.type(websiteInputs[0]!, "competitor-1.com")
    await user.type(nameInputs[1]!, "Competitor 2")
    await user.type(websiteInputs[1]!, "competitor-2.com")
    await user.type(nameInputs[2]!, "Competitor 3")
    await user.type(websiteInputs[2]!, "competitor-3.com")

    await user.click(screen.getByRole("button", { name: "Continue" }))
    await user.click(screen.getByRole("button", { name: "Complete setup" }))

    expect(mockCompleteOnboarding).not.toHaveBeenCalled()
    expect(
      await screen.findByRole("heading", { name: "Let's set up your brand" })
    ).toBeInTheDocument()
    expect(screen.getByText("Enter a valid website")).toBeInTheDocument()
    expect(screen.getByText("Enter a valid company name")).toBeInTheDocument()
  })
})
