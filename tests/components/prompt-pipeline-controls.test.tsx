import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PromptPipelineControls } from "@/components/dashboard/home/prompt-pipeline-controls"

const {
  fetchPromptPipelineConfigMock,
  savePromptPipelineConfigMock,
  startPromptPipelineQuickRunMock,
  terminatePromptPipelineRunMock,
} = vi.hoisted(() => ({
  fetchPromptPipelineConfigMock: vi.fn(),
  savePromptPipelineConfigMock: vi.fn(),
  startPromptPipelineQuickRunMock: vi.fn(),
  terminatePromptPipelineRunMock: vi.fn(),
}))

vi.mock("@/lib/prompt-pipeline/client", () => ({
  fetchPromptPipelineConfig: fetchPromptPipelineConfigMock,
  savePromptPipelineConfig: savePromptPipelineConfigMock,
  startPromptPipelineQuickRun: startPromptPipelineQuickRunMock,
  terminatePromptPipelineRun: terminatePromptPipelineRunMock,
}))

describe("PromptPipelineControls", () => {
  beforeEach(() => {
    fetchPromptPipelineConfigMock.mockReset()
    savePromptPipelineConfigMock.mockReset()
    startPromptPipelineQuickRunMock.mockReset()
    terminatePromptPipelineRunMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("explains that quick run requires a saved config", async () => {
    fetchPromptPipelineConfigMock.mockResolvedValue({
      activePrompts: [
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
          last_chat_prompt_run_id: null,
          last_failure_message: null,
          next_run_at: null,
          last_run_status: null,
          last_run_at: null,
          created_at: "2026-04-05T00:00:00.000Z",
          updated_at: "2026-04-05T00:00:00.000Z",
        },
      ],
      activeTopics: [
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
      ],
      config: null,
      hasActiveRun: false,
      reportingTimezone: "UTC",
    })

    render(<PromptPipelineControls />)

    await waitFor(() => {
      expect(
        screen.getByText(
          "Quick Run is enabled after you save a prompt pipeline config."
        )
      ).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: /quick run/i })).toBeDisabled()
  })

  it("polls active pipeline runs and re-enables quick run when a stopped workflow is reconciled", async () => {
    vi.useFakeTimers()

    fetchPromptPipelineConfigMock
      .mockResolvedValueOnce({
        activePrompts: [
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
            last_chat_prompt_run_id: null,
            last_failure_message: null,
            next_run_at: null,
            last_run_status: null,
            last_run_at: null,
            created_at: "2026-04-05T00:00:00.000Z",
            updated_at: "2026-04-05T00:00:00.000Z",
          },
        ],
        activeTopics: [
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
        ],
        config: {
          id: "config-1",
          project_id: "project-1",
          frequency: "weekly",
          is_enabled: true,
          next_run_at: null,
          last_run_at: "2026-04-20T20:00:00.000Z",
          last_run_status: "running",
          last_failure_message: null,
          last_pipeline_run_id: "pipeline-run-1",
          anchor_timezone: "UTC",
          selected_prompt_ids: ["prompt-1"],
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-20T20:00:00.000Z",
        },
        hasActiveRun: true,
        latestRun: {
          id: "pipeline-run-1",
          project_id: "project-1",
          config_id: "config-1",
          trigger_type: "manual",
          status: "running",
          scheduled_for: "2026-04-20T20:00:00.000Z",
          workflow_run_id: "workflow-run-1",
          request_id: "request-1",
          selection_snapshot_json: {},
          prompt_count_total: 1,
          prompt_count_completed: 0,
          prompt_count_partial: 0,
          prompt_count_failed: 0,
          failure_reason: null,
          created_at: "2026-04-20T20:00:00.000Z",
          updated_at: "2026-04-20T20:00:00.000Z",
          traces: [
            {
              id: "trace-1",
              pipeline_run_id: "pipeline-run-1",
              step_key: "initialize_pipeline_run",
              status: "completed",
              message: "Initialized pipeline run with 1 prompt.",
              detail_json: {
                promptCount: 1,
              },
              created_at: "2026-04-20T20:00:01.000Z",
            },
          ],
        },
        reportingTimezone: "UTC",
      })
      .mockResolvedValueOnce({
        activePrompts: [
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
            last_chat_prompt_run_id: null,
            last_failure_message: null,
            next_run_at: null,
            last_run_status: null,
            last_run_at: null,
            created_at: "2026-04-05T00:00:00.000Z",
            updated_at: "2026-04-05T00:00:00.000Z",
          },
        ],
        activeTopics: [
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
        ],
        config: {
          id: "config-1",
          project_id: "project-1",
          frequency: "weekly",
          is_enabled: true,
          next_run_at: null,
          last_run_at: "2026-04-20T20:00:10.000Z",
          last_run_status: "cancelled",
          last_failure_message: "Workflow was stopped before completion.",
          last_pipeline_run_id: "pipeline-run-1",
          anchor_timezone: "UTC",
          selected_prompt_ids: ["prompt-1"],
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-20T20:00:10.000Z",
        },
        hasActiveRun: false,
        latestRun: {
          id: "pipeline-run-1",
          project_id: "project-1",
          config_id: "config-1",
          trigger_type: "manual",
          status: "cancelled",
          scheduled_for: "2026-04-20T20:00:00.000Z",
          workflow_run_id: "workflow-run-1",
          request_id: "request-1",
          selection_snapshot_json: {},
          prompt_count_total: 1,
          prompt_count_completed: 0,
          prompt_count_partial: 0,
          prompt_count_failed: 0,
          failure_reason: "Workflow was stopped before completion.",
          created_at: "2026-04-20T20:00:00.000Z",
          updated_at: "2026-04-20T20:00:10.000Z",
          traces: [
            {
              id: "trace-1",
              pipeline_run_id: "pipeline-run-1",
              step_key: "initialize_pipeline_run",
              status: "completed",
              message: "Initialized pipeline run with 1 prompt.",
              detail_json: {
                promptCount: 1,
              },
              created_at: "2026-04-20T20:00:01.000Z",
            },
            {
              id: "trace-2",
              pipeline_run_id: "pipeline-run-1",
              step_key: "workflow_cancelled",
              status: "cancelled",
              message: "Workflow was stopped before completion.",
              detail_json: {},
              created_at: "2026-04-20T20:00:10.000Z",
            },
          ],
        },
        reportingTimezone: "UTC",
      })

    render(<PromptPipelineControls />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      screen.getByText(
        "Quick Run is disabled while another pipeline run is queued or running."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /terminate run/i })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Initialized pipeline run with 1 prompt.")
    ).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchPromptPipelineConfigMock).toHaveBeenCalledTimes(2)

    expect(screen.getByRole("button", { name: /quick run/i })).toBeEnabled()

    expect(
      screen.getAllByText("Workflow was stopped before completion.").length
    ).toBeGreaterThan(0)
  })

  it("shows a terminate action for active runs and removes the run after termination", async () => {
    fetchPromptPipelineConfigMock.mockResolvedValueOnce({
      activePrompts: [
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
          last_chat_prompt_run_id: null,
          last_failure_message: null,
          next_run_at: null,
          last_run_status: null,
          last_run_at: null,
          created_at: "2026-04-05T00:00:00.000Z",
          updated_at: "2026-04-05T00:00:00.000Z",
        },
      ],
      activeTopics: [],
      config: {
        id: "config-1",
        project_id: "project-1",
        frequency: "weekly",
        is_enabled: true,
        next_run_at: null,
        last_run_at: "2026-04-20T20:00:00.000Z",
        last_run_status: "running",
        last_failure_message: null,
        last_pipeline_run_id: "pipeline-run-1",
        anchor_timezone: "UTC",
        selected_prompt_ids: ["prompt-1"],
        created_at: "2026-04-10T00:00:00.000Z",
        updated_at: "2026-04-20T20:00:00.000Z",
      },
      hasActiveRun: true,
      latestRun: {
        id: "pipeline-run-1",
        project_id: "project-1",
        config_id: "config-1",
        trigger_type: "manual",
        status: "running",
        scheduled_for: "2026-04-20T20:00:00.000Z",
        workflow_run_id: "workflow-run-1",
        request_id: "request-1",
        selection_snapshot_json: {},
        prompt_count_total: 40,
        prompt_count_completed: 0,
        prompt_count_partial: 0,
        prompt_count_failed: 0,
        failure_reason: null,
        created_at: "2026-04-20T20:00:00.000Z",
        updated_at: "2026-04-20T20:00:00.000Z",
        traces: [],
      },
      reportingTimezone: "UTC",
    })
    terminatePromptPipelineRunMock.mockResolvedValue({
      activePrompts: [
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
          last_chat_prompt_run_id: null,
          last_failure_message: null,
          next_run_at: null,
          last_run_status: null,
          last_run_at: null,
          created_at: "2026-04-05T00:00:00.000Z",
          updated_at: "2026-04-05T00:00:00.000Z",
        },
      ],
      activeTopics: [],
      config: {
        id: "config-1",
        project_id: "project-1",
        frequency: "weekly",
        is_enabled: true,
        next_run_at: null,
        last_run_at: null,
        last_run_status: null,
        last_failure_message: null,
        last_pipeline_run_id: null,
        anchor_timezone: "UTC",
        selected_prompt_ids: ["prompt-1"],
        created_at: "2026-04-10T00:00:00.000Z",
        updated_at: "2026-04-20T20:05:00.000Z",
      },
      hasActiveRun: false,
      latestRun: null,
      reportingTimezone: "UTC",
    })

    render(<PromptPipelineControls />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /terminate run/i })
      ).toBeInTheDocument()
    })

    await act(async () => {
      screen.getByRole("button", { name: /terminate run/i }).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(terminatePromptPipelineRunMock).toHaveBeenCalledTimes(1)
    expect(terminatePromptPipelineRunMock).toHaveBeenCalledWith("pipeline-run-1")
    expect(
      screen.queryByRole("button", { name: /terminate run/i })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /quick run/i })).toBeEnabled()
    expect(
      screen.getByText("Terminated the active run and removed its data.")
    ).toBeInTheDocument()
  })
})
