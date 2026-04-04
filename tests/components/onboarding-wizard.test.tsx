import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { BrandWithCompetitors } from "@/lib/brands"

const mockReplace = vi.fn()
const mockUseAuth = vi.fn()
const mockRefreshAuthState = vi.fn()
const mockSaveBrandDraftStep = vi.fn()
const mockReplaceBrandCompetitors = vi.fn()
const mockMarkOnboardingComplete = vi.fn()
const mockFetchOnboardingBrandSuggestions = vi.fn()

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
  fetchOnboardingBrandSuggestions: mockFetchOnboardingBrandSuggestions,
}))

vi.mock("@/lib/brands", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/brands")>("@/lib/brands")

  return {
    ...actual,
    markOnboardingComplete: mockMarkOnboardingComplete,
    replaceBrandCompetitors: mockReplaceBrandCompetitors,
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
  mockReplaceBrandCompetitors.mockReset()
  mockMarkOnboardingComplete.mockReset()
  mockFetchOnboardingBrandSuggestions.mockReset()
  process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY = "pk_test_123"

  mockFetchOnboardingBrandSuggestions.mockResolvedValue({
    competitors: [
      { name: "Competitor 1", website: "https://competitor-1.com" },
      { name: "Competitor 2", website: "https://competitor-2.com" },
      { name: "Competitor 3", website: "https://competitor-3.com" },
      { name: "Competitor 4", website: "https://competitor-4.com" },
    ],
    description: "Suggested description",
    topics: ["ai search", "google ai mode", "perplexity"],
    warnings: [],
  })

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

    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "25"
    )
    expect(screen.getAllByText("Brand basics").length).toBeGreaterThan(0)
    expect(screen.getByLabelText("Company website")).toBeInTheDocument()
    expect(screen.getByLabelText("Company name")).toBeInTheDocument()
  })

  it("blocks invalid step 1 submissions", async () => {
    const user = userEvent.setup()

    await renderWizard()

    await user.click(screen.getByRole("button", { name: "Save and continue" }))

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
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

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
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(await screen.findByText("Schema mismatch")).toBeInTheDocument()
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument()
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
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    await waitFor(() =>
      expect(mockSaveBrandDraftStep).toHaveBeenCalledWith(expect.any(Object), {
        company_name: "Acme",
        website: "acme.com",
      })
    )
    await waitFor(() =>
      expect(mockFetchOnboardingBrandSuggestions).toHaveBeenCalledWith({
        companyName: "Acme",
        website: "acme.com",
      })
    )

    await waitFor(() =>
      expect(screen.getAllByText("Description").length).toBeGreaterThan(0)
    )
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Suggested description")).toBeInTheDocument()
  })

  it("shows an inline loading state while step 1 suggestions are in flight", async () => {
    const user = userEvent.setup()

    let resolveSuggestions: (
      value: {
        competitors: Array<{ name: string; website: string }>
        description: string
        topics: string[]
        warnings: string[]
      }
    ) => void

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )
    mockFetchOnboardingBrandSuggestions.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSuggestions = resolve
        })
    )

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(
      await screen.findByText("Generating suggestions from your homepage")
    ).toBeInTheDocument()

    resolveSuggestions!({
      competitors: [],
      description: "Suggested description",
      topics: ["ai search", "google ai mode", "perplexity"],
      warnings: [],
    })

    expect(await screen.findByText("Step 2 of 4")).toBeInTheDocument()
  })

  it("blocks invalid step 2 submissions", async () => {
    const user = userEvent.setup()

    await renderWizard(
      makeBrand({
        company_name: "Acme",
        website: "https://acme.com",
      })
    )

    expect(screen.getAllByText("Description").length).toBeGreaterThan(0)
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(mockSaveBrandDraftStep).not.toHaveBeenCalled()
    expect(
      await screen.findByText("Tell us about your business")
    ).toBeInTheDocument()
  })

  it("adds normalized topics, rejects duplicates, and enforces the cap", async () => {
    const user = userEvent.setup()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        description: "Description",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "https://acme.com",
      })
    )

    await renderWizard(
      makeBrand({
        company_name: "Acme",
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
    expect(screen.getByDisplayValue("Competitor 1")).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("https://competitor-2.com")
    ).toBeInTheDocument()
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
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(await screen.findByDisplayValue("Suggested description")).toBeInTheDocument()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        description: "Suggested description",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "https://acme.com",
      })
    )

    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(await screen.findByText("ai search")).toBeInTheDocument()
    expect(screen.getByText("google ai mode")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(await screen.findByDisplayValue("Competitor 1")).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("https://competitor-4.com")
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
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

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
    mockFetchOnboardingBrandSuggestions.mockResolvedValue({
      competitors: [],
      description: "",
      topics: [],
      warnings: [
        "We found fewer than 3 strong topics. Review and add topics before continuing.",
      ],
    })

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(await screen.findByText("Step 2 of 4")).toBeInTheDocument()
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
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(await screen.findByText("Step 3 of 4")).toBeInTheDocument()
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
    mockFetchOnboardingBrandSuggestions.mockResolvedValue({
      competitors: [],
      description: "Suggested description",
      topics: [],
      warnings: [],
    })

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(await screen.findByText("Step 2 of 4")).toBeInTheDocument()
    expect(
      screen.getByText(/The AI model could not load any topics\./)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/The AI model could not load any competitors\./)
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
    mockFetchOnboardingBrandSuggestions
      .mockResolvedValueOnce({
        competitors: [
          { name: "Competitor 1", website: "https://competitor-1.com" },
        ],
        description: "First suggestion",
        topics: ["ai search", "perplexity", "brand search"],
        warnings: [],
      })
      .mockResolvedValueOnce({
        competitors: [
          { name: "Competitor X", website: "https://competitor-x.com" },
        ],
        description: "Second suggestion",
        topics: ["llm visibility", "answer engines", "ai citations"],
        warnings: [],
      })

    await renderWizard()

    await user.type(screen.getByLabelText("Company website"), "acme.com")
    await user.type(screen.getByLabelText("Company name"), "Acme")
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(await screen.findByDisplayValue("First suggestion")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Back" }))
    await user.clear(screen.getByLabelText("Company website"))
    await user.type(screen.getByLabelText("Company website"), "acme.ai")
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(await screen.findByDisplayValue("Second suggestion")).toBeInTheDocument()

    mockSaveBrandDraftStep.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        description: "Second suggestion",
        topics: ["llm visibility", "answer engines", "ai citations"],
        website: "https://acme.ai",
      })
    )

    await user.click(screen.getByRole("button", { name: "Save and continue" }))
    expect(await screen.findByText("llm visibility")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Save and continue" }))
    expect(await screen.findByDisplayValue("Competitor X")).toBeInTheDocument()
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
    await user.click(screen.getByRole("button", { name: "Save and continue" }))

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

    expect(await screen.findByText("ai search")).toBeInTheDocument()
    expect(screen.getByText("google ai mode")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Save and continue" }))

    expect(await screen.findByDisplayValue("Competitor 1")).toBeInTheDocument()
  })

  it("adds and removes competitor rows, then completes onboarding", async () => {
    const user = userEvent.setup()

    mockReplaceBrandCompetitors.mockResolvedValue([
      {
        brand_id: "brand-1",
        created_at: "2026-01-01T00:00:00.000Z",
        id: "competitor-1",
        name: "Competitor 1",
        updated_at: "2026-01-01T00:00:00.000Z",
        user_id: "user-1",
        website: "https://competitor-1.com",
      },
    ])
    mockMarkOnboardingComplete.mockResolvedValue(
      makeBrand({
        company_name: "Acme",
        description: "Description",
        onboarding_completed_at: "2026-01-02T00:00:00.000Z",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "https://acme.com",
      })
    )

    await renderWizard(
      makeBrand({
        company_name: "Acme",
        description: "Description",
        topics: ["ai search", "google ai mode", "perplexity"],
        website: "https://acme.com",
      })
    )

    await user.click(screen.getByRole("button", { name: "Add competitor" }))

    const removeButtons = screen.getAllByRole("button", {
      name: /remove competitor/i,
    })
    await user.click(removeButtons[3]!)

    const nameInputs = screen.getAllByLabelText(/Competitor name/i)
    const websiteInputs = screen.getAllByLabelText(/Competitor website/i)

    await user.type(nameInputs[0]!, "Competitor 1")
    await user.type(websiteInputs[0]!, "competitor-1.com")
    await user.type(nameInputs[1]!, "Competitor 2")
    await user.type(websiteInputs[1]!, "competitor-2.com")
    await user.type(nameInputs[2]!, "Competitor 3")
    await user.type(websiteInputs[2]!, "competitor-3.com")

    await user.click(screen.getByRole("button", { name: "Complete setup" }))

    await waitFor(() =>
      expect(mockReplaceBrandCompetitors).toHaveBeenCalledWith(
        expect.any(Object),
        "brand-1",
        [
          { name: "Competitor 1", website: "competitor-1.com" },
          { name: "Competitor 2", website: "competitor-2.com" },
          { name: "Competitor 3", website: "competitor-3.com" },
        ]
      )
    )
    await waitFor(() =>
      expect(mockMarkOnboardingComplete).toHaveBeenCalledWith(
        expect.any(Object),
        "brand-1"
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

    mockReplaceBrandCompetitors.mockResolvedValue([
      {
        brand_id: "brand-1",
        created_at: "2026-01-01T00:00:00.000Z",
        id: "competitor-1",
        name: "Competitor 1",
        updated_at: "2026-01-01T00:00:00.000Z",
        user_id: "user-1",
        website: "https://competitor-1.com",
      },
    ])
    mockMarkOnboardingComplete.mockRejectedValue(
      new Error("Completion unavailable")
    )

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

    await user.click(screen.getByRole("button", { name: "Complete setup" }))

    expect(mockReplaceBrandCompetitors).not.toHaveBeenCalled()
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

    await user.click(screen.getByRole("button", { name: "Complete setup" }))

    expect(mockReplaceBrandCompetitors).not.toHaveBeenCalled()
    expect(await screen.findByText("Step 1 of 4")).toBeInTheDocument()
    expect(screen.getByText("Enter a valid website")).toBeInTheDocument()
    expect(screen.getByText("Enter a valid company name")).toBeInTheDocument()
  })
})
