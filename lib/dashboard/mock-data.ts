export interface KpiMetric {
  label: string
  value: string
  change: number
  changeLabel: string
}

export interface VisibilityTrendPoint {
  date: string
  [brand: string]: number | string
}

export interface CompetitorRanking {
  rank: number
  name: string
  website: string
  visibility: number
  rankChange: number
}

export interface PlatformBreakdown {
  platform: string
  visibility: number
  change: number
}

export interface TopQuery {
  query: string
  mentions: number
  total: number
  platforms: string[]
}

export interface SentimentData {
  label: string
  value: number
}

export const mockKpis: KpiMetric[] = [
  {
    label: "Brand Visibility",
    value: "47.6%",
    change: 5.4,
    changeLabel: "vs last period",
  },
  {
    label: "Citation Share",
    value: "14.3%",
    change: 2.7,
    changeLabel: "vs last period",
  },
  {
    label: "Brand Ranking",
    value: "#2",
    change: 1,
    changeLabel: "positions up",
  },
  {
    label: "Sentiment Score",
    value: "84",
    change: 6,
    changeLabel: "vs last period",
  },
]

export const mockVisibilityTrend: VisibilityTrendPoint[] = [
  { date: "Apr 16", brand: 38, competitor1: 52, competitor2: 41, competitor3: 33 },
  { date: "Apr 17", brand: 39, competitor1: 51, competitor2: 42, competitor3: 32 },
  { date: "Apr 18", brand: 41, competitor1: 53, competitor2: 40, competitor3: 34 },
  { date: "Apr 19", brand: 40, competitor1: 52, competitor2: 41, competitor3: 33 },
  { date: "Apr 20", brand: 42, competitor1: 54, competitor2: 43, competitor3: 35 },
  { date: "Apr 21", brand: 43, competitor1: 53, competitor2: 42, competitor3: 34 },
  { date: "Apr 22", brand: 44, competitor1: 55, competitor2: 44, competitor3: 36 },
  { date: "Apr 23", brand: 45, competitor1: 54, competitor2: 43, competitor3: 35 },
  { date: "Apr 24", brand: 44, competitor1: 56, competitor2: 45, competitor3: 37 },
  { date: "Apr 25", brand: 46, competitor1: 55, competitor2: 44, competitor3: 36 },
  { date: "Apr 26", brand: 47, competitor1: 54, competitor2: 45, competitor3: 38 },
  { date: "Apr 27", brand: 46, competitor1: 56, competitor2: 46, competitor3: 37 },
  { date: "Apr 28", brand: 48, competitor1: 55, competitor2: 45, competitor3: 39 },
  { date: "Apr 29", brand: 48, competitor1: 54, competitor2: 46, competitor3: 38 },
]

export const mockCompetitorRankings: CompetitorRanking[] = [
  { rank: 1, name: "Brooklinen", website: "brooklinen.com", visibility: 53.7, rankChange: 0 },
  { rank: 2, name: "Your Brand", website: "pillows.com", visibility: 47.6, rankChange: 1 },
  { rank: 3, name: "Coop Home Goods", website: "coophomegoods.com", visibility: 45.2, rankChange: -1 },
  { rank: 4, name: "Tempur-Pedic", website: "tempurpedic.com", visibility: 39.8, rankChange: 0 },
  { rank: 5, name: "Casper", website: "casper.com", visibility: 34.1, rankChange: 1 },
  { rank: 6, name: "Saatva", website: "saatva.com", visibility: 28.6, rankChange: -1 },
]

export const mockPlatformBreakdown: PlatformBreakdown[] = [
  { platform: "ChatGPT", visibility: 56, change: 6.4 },
  { platform: "Claude", visibility: 51, change: 4.9 },
  { platform: "Gemini", visibility: 42, change: 2.1 },
  { platform: "Grok", visibility: 27, change: -1.2 },
]

export const mockTopQueries: TopQuery[] = [
  {
    query: "best pillows for side sleepers",
    mentions: 11,
    total: 14,
    platforms: ["ChatGPT", "Claude", "Gemini"],
  },
  {
    query: "best cooling pillows for hot sleepers",
    mentions: 9,
    total: 13,
    platforms: ["ChatGPT", "Claude", "Grok"],
  },
  {
    query: "best pillow for neck pain",
    mentions: 8,
    total: 12,
    platforms: ["ChatGPT", "Gemini"],
  },
  {
    query: "memory foam vs down pillow",
    mentions: 7,
    total: 11,
    platforms: ["Claude", "Gemini"],
  },
  {
    query: "best hotel-quality pillows for home",
    mentions: 6,
    total: 10,
    platforms: ["ChatGPT", "Claude"],
  },
  {
    query: "best pillows under $100",
    mentions: 5,
    total: 9,
    platforms: ["ChatGPT", "Gemini", "Grok"],
  },
]

export const mockSentiment: SentimentData[] = [
  { label: "Positive", value: 71 },
  { label: "Neutral", value: 23 },
  { label: "Negative", value: 6 },
]

// --- Comparison Matrix ---

export interface ComparisonMatrixRow {
  name: string
  website: string
  isOwnBrand: boolean
  scores: Record<string, number>
}

export const comparisonMatrixProviders = ["ChatGPT", "Claude", "Gemini", "Grok"]

export const mockComparisonMatrix: ComparisonMatrixRow[] = [
  {
    name: "Your Brand",
    website: "pillows.com",
    isOwnBrand: true,
    scores: { ChatGPT: 56, Claude: 51, Gemini: 42, Grok: 27 },
  },
  {
    name: "Brooklinen",
    website: "brooklinen.com",
    isOwnBrand: false,
    scores: { ChatGPT: 62, Claude: 58, Gemini: 49, Grok: 38 },
  },
  {
    name: "Coop Home Goods",
    website: "coophomegoods.com",
    isOwnBrand: false,
    scores: { ChatGPT: 58, Claude: 49, Gemini: 41, Grok: 32 },
  },
  {
    name: "Tempur-Pedic",
    website: "tempurpedic.com",
    isOwnBrand: false,
    scores: { ChatGPT: 44, Claude: 41, Gemini: 38, Grok: 31 },
  },
  {
    name: "Casper",
    website: "casper.com",
    isOwnBrand: false,
    scores: { ChatGPT: 38, Claude: 35, Gemini: 33, Grok: 25 },
  },
  {
    name: "Saatva",
    website: "saatva.com",
    isOwnBrand: false,
    scores: { ChatGPT: 31, Claude: 28, Gemini: 30, Grok: 22 },
  },
]

// --- Provider Rankings ---

export interface ProviderRankingRow {
  rank: number
  name: string
  website: string
  isOwnBrand: boolean
  visibility: number
  shareOfVoice: number
  sentiment: "Positive" | "Neutral" | "Negative"
}

export type ProviderRankingsData = Record<string, ProviderRankingRow[]>

export const mockProviderRankings: ProviderRankingsData = {
  ChatGPT: [
    { rank: 1, name: "Brooklinen", website: "brooklinen.com", isOwnBrand: false, visibility: 62, shareOfVoice: 26, sentiment: "Positive" },
    { rank: 2, name: "Coop Home Goods", website: "coophomegoods.com", isOwnBrand: false, visibility: 58, shareOfVoice: 22, sentiment: "Positive" },
    { rank: 3, name: "Your Brand", website: "pillows.com", isOwnBrand: true, visibility: 56, shareOfVoice: 21, sentiment: "Positive" },
    { rank: 4, name: "Tempur-Pedic", website: "tempurpedic.com", isOwnBrand: false, visibility: 44, shareOfVoice: 15, sentiment: "Neutral" },
    { rank: 5, name: "Casper", website: "casper.com", isOwnBrand: false, visibility: 38, shareOfVoice: 11, sentiment: "Neutral" },
    { rank: 6, name: "Saatva", website: "saatva.com", isOwnBrand: false, visibility: 31, shareOfVoice: 5, sentiment: "Neutral" },
  ],
  Claude: [
    { rank: 1, name: "Brooklinen", website: "brooklinen.com", isOwnBrand: false, visibility: 58, shareOfVoice: 25, sentiment: "Positive" },
    { rank: 2, name: "Your Brand", website: "pillows.com", isOwnBrand: true, visibility: 51, shareOfVoice: 23, sentiment: "Positive" },
    { rank: 3, name: "Coop Home Goods", website: "coophomegoods.com", isOwnBrand: false, visibility: 49, shareOfVoice: 20, sentiment: "Positive" },
    { rank: 4, name: "Tempur-Pedic", website: "tempurpedic.com", isOwnBrand: false, visibility: 41, shareOfVoice: 14, sentiment: "Neutral" },
    { rank: 5, name: "Casper", website: "casper.com", isOwnBrand: false, visibility: 35, shareOfVoice: 11, sentiment: "Neutral" },
    { rank: 6, name: "Saatva", website: "saatva.com", isOwnBrand: false, visibility: 28, shareOfVoice: 7, sentiment: "Neutral" },
  ],
  Gemini: [
    { rank: 1, name: "Brooklinen", website: "brooklinen.com", isOwnBrand: false, visibility: 49, shareOfVoice: 24, sentiment: "Positive" },
    { rank: 2, name: "Your Brand", website: "pillows.com", isOwnBrand: true, visibility: 42, shareOfVoice: 21, sentiment: "Positive" },
    { rank: 3, name: "Coop Home Goods", website: "coophomegoods.com", isOwnBrand: false, visibility: 41, shareOfVoice: 19, sentiment: "Positive" },
    { rank: 4, name: "Tempur-Pedic", website: "tempurpedic.com", isOwnBrand: false, visibility: 38, shareOfVoice: 16, sentiment: "Neutral" },
    { rank: 5, name: "Casper", website: "casper.com", isOwnBrand: false, visibility: 33, shareOfVoice: 12, sentiment: "Neutral" },
    { rank: 6, name: "Saatva", website: "saatva.com", isOwnBrand: false, visibility: 30, shareOfVoice: 8, sentiment: "Neutral" },
  ],
  Grok: [
    { rank: 1, name: "Brooklinen", website: "brooklinen.com", isOwnBrand: false, visibility: 38, shareOfVoice: 28, sentiment: "Positive" },
    { rank: 2, name: "Coop Home Goods", website: "coophomegoods.com", isOwnBrand: false, visibility: 32, shareOfVoice: 21, sentiment: "Neutral" },
    { rank: 3, name: "Tempur-Pedic", website: "tempurpedic.com", isOwnBrand: false, visibility: 31, shareOfVoice: 18, sentiment: "Neutral" },
    { rank: 4, name: "Your Brand", website: "pillows.com", isOwnBrand: true, visibility: 27, shareOfVoice: 14, sentiment: "Neutral" },
    { rank: 5, name: "Casper", website: "casper.com", isOwnBrand: false, visibility: 25, shareOfVoice: 12, sentiment: "Neutral" },
    { rank: 6, name: "Saatva", website: "saatva.com", isOwnBrand: false, visibility: 22, shareOfVoice: 7, sentiment: "Negative" },
  ],
}

// --- Recommendation Rate ---

export interface RecommendationRateData {
  mentioned: number
  recommended: number
  topRecommendedQuery: string
  byProvider: { platform: string; rate: number }[]
}

export const mockRecommendationRate: RecommendationRateData = {
  mentioned: 218,
  recommended: 134,
  topRecommendedQuery: "best pillows for side sleepers with neck pain",
  byProvider: [
    { platform: "ChatGPT", rate: 74 },
    { platform: "Claude", rate: 68 },
    { platform: "Gemini", rate: 52 },
    { platform: "Grok", rate: 36 },
  ],
}

// --- Content Gaps ---

export interface ContentGap {
  query: string
  competitorsMentioned: string[]
  yourVisibility: number
  estimatedVolume: "High" | "Medium" | "Low"
}

export const mockContentGaps: ContentGap[] = [
  {
    query: "best organic pillows made in the USA",
    competitorsMentioned: ["Brooklinen", "Avocado", "Coop Home Goods"],
    yourVisibility: 0,
    estimatedVolume: "High",
  },
  {
    query: "best adjustable pillows for back and side sleepers",
    competitorsMentioned: ["Coop Home Goods", "Tempur-Pedic"],
    yourVisibility: 0,
    estimatedVolume: "High",
  },
  {
    query: "best pillows for stomach sleepers 2026",
    competitorsMentioned: ["Brooklinen", "Casper"],
    yourVisibility: 6,
    estimatedVolume: "High",
  },
  {
    query: "hypoallergenic pillows for allergy sufferers",
    competitorsMentioned: ["Brooklinen", "Coop Home Goods"],
    yourVisibility: 11,
    estimatedVolume: "Medium",
  },
  {
    query: "best buckwheat pillows for neck support",
    competitorsMentioned: ["Coop Home Goods"],
    yourVisibility: 0,
    estimatedVolume: "Medium",
  },
  {
    query: "luxury hotel pillows you can buy at home",
    competitorsMentioned: ["Brooklinen", "Saatva"],
    yourVisibility: 14,
    estimatedVolume: "Low",
  },
]

// --- Category Leaderboard ---

export interface CategoryPosition {
  category: string
  rank: number
  totalCompetitors: number
  visibility: number
  trend: number
}

export const mockCategoryPositions: CategoryPosition[] = [
  { category: "Memory Foam Pillows", rank: 1, totalCompetitors: 14, visibility: 62, trend: 4 },
  { category: "Cooling Pillows", rank: 2, totalCompetitors: 16, visibility: 54, trend: 3 },
  { category: "Side Sleeper Pillows", rank: 2, totalCompetitors: 18, visibility: 51, trend: 2 },
  { category: "Down & Down Alternative", rank: 4, totalCompetitors: 13, visibility: 36, trend: -1 },
  { category: "Hotel-Quality Pillows", rank: 3, totalCompetitors: 11, visibility: 44, trend: 1 },
  { category: "Organic & Natural Pillows", rank: 6, totalCompetitors: 12, visibility: 18, trend: 0 },
]

// --- Weekly Alerts ---

export interface WeeklyAlert {
  type: "gain" | "loss" | "new" | "opportunity"
  title: string
  description: string
}

export const mockWeeklyAlerts: WeeklyAlert[] = [
  {
    type: "gain",
    title: "#1 on ChatGPT for Memory Foam",
    description: "Pillows.com overtook Coop Home Goods for the top spot in memory foam pillow recommendations on ChatGPT this week.",
  },
  {
    type: "gain",
    title: "Sentiment up across Claude",
    description: "Positive sentiment rose from 64% to 71% on Claude, driven by mentions of your 100-night trial and free returns.",
  },
  {
    type: "loss",
    title: "Slipped in Down Alternative",
    description: "Rank fell from #3 to #4 for down alternative pillow queries. Brooklinen gained citations from a Wirecutter feature.",
  },
  {
    type: "opportunity",
    title: "Organic pillows is wide open",
    description: "\"best organic pillows made in the USA\" is high volume — Avocado and Brooklinen rank, you don't appear at all.",
  },
  {
    type: "new",
    title: "New competitor: Marlow",
    description: "Marlow Pillow is now appearing in 4 of your tracked queries, mostly on ChatGPT and Gemini.",
  },
]
