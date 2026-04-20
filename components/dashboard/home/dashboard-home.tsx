"use client"

import { CategoryLeaderboard } from "@/components/dashboard/home/category-leaderboard"
import { ComparisonMatrix } from "@/components/dashboard/home/comparison-matrix"
import { CompetitorRankings } from "@/components/dashboard/home/competitor-rankings"
import { ContentGaps } from "@/components/dashboard/home/content-gaps"
import { DashboardFilters } from "@/components/dashboard/home/dashboard-filters"
import { KpiCards } from "@/components/dashboard/home/kpi-cards"
import { PlatformBreakdown } from "@/components/dashboard/home/platform-breakdown"
import { PromptPipelineControls } from "@/components/dashboard/home/prompt-pipeline-controls"
import { ProviderRankings } from "@/components/dashboard/home/provider-rankings"
import { RecommendationRate } from "@/components/dashboard/home/recommendation-rate"
import { SentimentOverview } from "@/components/dashboard/home/sentiment-overview"
import { TopQueries } from "@/components/dashboard/home/top-queries"
import { VisibilityTrendChart } from "@/components/dashboard/home/visibility-trend-chart"
import { WeeklyAlerts } from "@/components/dashboard/home/weekly-alerts"
import {
  mockCategoryPositions,
  mockComparisonMatrix,
  mockCompetitorRankings,
  mockContentGaps,
  mockKpis,
  mockPlatformBreakdown,
  mockProviderRankings,
  mockRecommendationRate,
  mockSentiment,
  mockTopQueries,
  mockVisibilityTrend,
  mockWeeklyAlerts,
} from "@/lib/dashboard/mock-data"

export function DashboardHome() {
  return (
    <div className="flex flex-col gap-4 p-6 pt-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <DashboardFilters />
        <PromptPipelineControls />
      </div>

      <KpiCards metrics={mockKpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(320px,0.6fr)]">
        <VisibilityTrendChart data={mockVisibilityTrend} />
        <CompetitorRankings rankings={mockCompetitorRankings} />
      </div>

      <ComparisonMatrix data={mockComparisonMatrix} />

      <ProviderRankings data={mockProviderRankings} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,0.45fr)_1fr]">
        <div className="flex flex-col gap-4">
          <PlatformBreakdown platforms={mockPlatformBreakdown} />
          <RecommendationRate data={mockRecommendationRate} />
          <SentimentOverview data={mockSentiment} />
        </div>
        <div className="flex flex-col gap-4">
          <TopQueries queries={mockTopQueries} />
          <ContentGaps gaps={mockContentGaps} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryLeaderboard categories={mockCategoryPositions} />
        <WeeklyAlerts alerts={mockWeeklyAlerts} />
      </div>
    </div>
  )
}
