import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockUseAuth = vi.fn()

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/lib/insforge/browser-client", () => ({
  getInsforgeBrowserClient: () => ({}),
}))

vi.mock("@/lib/logo-dev/config", () => ({
  resolveLogoDevPublicConfig: () => ({ publishableKey: "pk_test" }),
}))

vi.mock("@/lib/project-topics/repository", () => ({
  loadProjectTopics: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/tracked-prompts/repository", () => ({
  loadTrackedPromptsByProject: vi.fn().mockResolvedValue([]),
}))

const dashboardPages = [
  { heading: "Home", modulePath: "@/app/dashboard/page" },
  { heading: "Prompts", modulePath: "@/app/dashboard/prompts/page" },
  { heading: "Chats", modulePath: "@/app/dashboard/chats/page" },
  { heading: "Insights", modulePath: "@/app/dashboard/insights/page" },
  { heading: "Sources", modulePath: "@/app/dashboard/sources/page" },
  { heading: "Queries", modulePath: "@/app/dashboard/queries/page" },
] as const

describe("dashboard pages", () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
    mockUseAuth.mockReturnValue({
      brand: {
        company_name: "Acme",
        competitors: [],
        created_at: "2026-01-01T00:00:00.000Z",
        description: "Description",
        id: "brand-1",
        onboarding_completed_at: "2026-01-02T00:00:00.000Z",
        topics: ["ai search", "google ai mode", "perplexity"],
        updated_at: "2026-01-01T00:00:00.000Z",
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        website: "https://acme.com",
      },
    })
  })

  it.each(dashboardPages)(
    "renders the $heading page heading",
    async ({ heading, modulePath }) => {
      const pageModule = await import(modulePath)
      const Page = pageModule.default

      render(<Page />)

      if (heading === "Home") {
        expect(screen.getByText("Provider Rankings")).toBeInTheDocument()
        return
      }

      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument()
    }
  )

  it.each(dashboardPages)(
    "renders a skeleton loading shell for the $heading page",
    async ({ heading, modulePath }) => {
      const loadingModulePath = modulePath.replace("/page", "/loading")
      const loadingModule = await import(loadingModulePath)
      const Page = loadingModule.default

      const { container } = render(<Page />)

      expect(screen.getByText(heading)).toBeInTheDocument()
      expect(
        container.querySelectorAll('[data-slot="skeleton"]').length
      ).toBeGreaterThan(0)
      expect(screen.getByText("Loading page shell...")).toBeInTheDocument()
    }
  )
})
