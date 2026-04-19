import { beforeEach, describe, expect, it, vi } from "vitest"

const mockStart = vi.fn()
const mockCreateSiteCrawlRun = vi.fn()
const mockLoadSiteCrawlRun = vi.fn()
const mockUpdateSiteCrawlRun = vi.fn()

vi.mock("workflow/api", () => ({
  start: mockStart,
}))

vi.mock("@/lib/site-crawl-runs/repository", () => ({
  createSiteCrawlRun: mockCreateSiteCrawlRun,
  loadSiteCrawlRun: mockLoadSiteCrawlRun,
  updateSiteCrawlRun: mockUpdateSiteCrawlRun,
}))

vi.mock("@/lib/onboarding/analysis-logging", () => ({
  logOnboardingAnalysisError: vi.fn(),
  logOnboardingAnalysisEvent: vi.fn(),
}))

async function loadAnalysisModule() {
  return import("@/lib/onboarding/analysis")
}

describe("workflow-backed onboarding analysis", () => {
  beforeEach(() => {
    vi.resetModules()
    mockCreateSiteCrawlRun.mockReset()
    mockLoadSiteCrawlRun.mockReset()
    mockStart.mockReset()
    mockUpdateSiteCrawlRun.mockReset()

    mockCreateSiteCrawlRun.mockResolvedValue({
      analysis_version: 2,
      completed_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      error_message: null,
      firecrawl_job_ids: [],
      id: "analysis-1",
      project_id: "project-1",
      result_json: null,
      selected_url_count: 0,
      started_at: "2026-01-01T00:00:00.000Z",
      status: "mapping",
      trigger_type: "onboarding",
      updated_at: "2026-01-01T00:00:00.000Z",
      warnings: [],
      workflow_run_id: null,
    })
    mockStart.mockResolvedValue({
      runId: "workflow-run-1",
    })
    mockUpdateSiteCrawlRun.mockImplementation(async (_client, id, patch) => ({
      analysis_version: 2,
      completed_at: patch.completed_at ?? null,
      created_at: "2026-01-01T00:00:00.000Z",
      error_message: patch.error_message ?? null,
      firecrawl_job_ids: [],
      id,
      project_id: "project-1",
      result_json: patch.result_json ?? null,
      selected_url_count: patch.selected_url_count ?? 0,
      started_at: "2026-01-01T00:00:00.000Z",
      status: patch.status ?? "mapping",
      trigger_type: "onboarding",
      updated_at: "2026-01-01T00:00:00.000Z",
      warnings: patch.warnings ?? [],
      workflow_run_id: patch.workflow_run_id ?? "workflow-run-1",
    }))
  })

  it("creates a run, starts the workflow, and persists the workflow run id", async () => {
    const { startOnboardingAnalysisRun } = await loadAnalysisModule()
    const client = {
      auth: {} as never,
      database: {} as never,
    }

    const result = await startOnboardingAnalysisRun(
      client,
      {
        companyName: "Acme",
        projectId: "project-1",
        website: "https://acme.com",
      },
      "Bearer user-token"
    )

    expect(mockCreateSiteCrawlRun).toHaveBeenCalledWith(client, {
      analysisVersion: 2,
      projectId: "project-1",
    })
    expect(mockStart).toHaveBeenCalledWith(expect.any(Function), [
      {
        analysisId: "analysis-1",
        analysisVersion: 2,
        authToken: "user-token",
        companyName: "Acme",
        projectId: "project-1",
        website: "https://acme.com",
      },
    ])
    expect(mockUpdateSiteCrawlRun).toHaveBeenCalledWith(
      client,
      "analysis-1",
      expect.objectContaining({
        status: "mapping",
        workflow_run_id: "workflow-run-1",
      })
    )
    expect(result).toEqual({
      analysisId: "analysis-1",
      status: "mapping",
      warnings: [],
    })
  })

  it("rejects onboarding analysis start without a user bearer token", async () => {
    const { startOnboardingAnalysisRun } = await loadAnalysisModule()
    const client = {
      auth: {} as never,
      database: {} as never,
    }

    await expect(
      startOnboardingAnalysisRun(
        client,
        {
          companyName: "Acme",
          projectId: "project-1",
          website: "https://acme.com",
        },
        null
      )
    ).rejects.toThrow("You must be signed in to continue.")

    expect(mockCreateSiteCrawlRun).not.toHaveBeenCalled()
    expect(mockStart).not.toHaveBeenCalled()
  })

  it("returns persisted status without advancing the workflow", async () => {
    mockLoadSiteCrawlRun.mockResolvedValue({
      analysis_version: 2,
      completed_at: "2026-01-01T00:02:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      error_message: null,
      firecrawl_job_ids: [],
      id: "analysis-1",
      project_id: "project-1",
      result_json: {
        brandProfile: {
          careers: null,
          categories: ["security automation"],
          detailedDescription:
            "Acme helps security teams automate investigations and compliance workflows.",
          geography: "North America",
          jobsToBeDone: ["automate investigations"],
          keywords: ["security automation"],
          pricing: "enterprise SaaS pricing",
          primaryCategory: "security automation",
          primarySubcategory: "security automation platform",
          products: ["incident response automation"],
          siteArchetype: "saas",
          targetCustomers: ["security teams"],
          warnings: [],
        },
        competitors: [],
        description:
          "Acme helps security teams automate investigations and compliance workflows.",
        topics: [],
        warnings: [],
      },
      selected_url_count: 4,
      started_at: "2026-01-01T00:00:00.000Z",
      status: "completed",
      trigger_type: "onboarding",
      updated_at: "2026-01-01T00:02:00.000Z",
      warnings: [],
      workflow_run_id: "workflow-run-1",
    })

    const { loadOnboardingAnalysisRunStatus } = await loadAnalysisModule()
    const client = {
      auth: {} as never,
      database: {} as never,
    }

    const result = await loadOnboardingAnalysisRunStatus(client, "analysis-1")

    expect(mockLoadSiteCrawlRun).toHaveBeenCalledWith(client, "analysis-1")
    expect(result).toMatchObject({
      analysisId: "analysis-1",
      status: "completed",
      result: {
        brandProfile: {
          primaryCategory: "security automation",
          siteArchetype: "saas",
        },
      },
    })
  })
})
