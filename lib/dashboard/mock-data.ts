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
    value: "51.8%",
    change: 3.2,
    changeLabel: "vs last period",
  },
  {
    label: "Citation Share",
    value: "12.0%",
    change: 1.8,
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
    value: "82",
    change: 4,
    changeLabel: "vs last period",
  },
]

export const mockVisibilityTrend: VisibilityTrendPoint[] = [
  { date: "Apr 1", brand: 42, competitor1: 38, competitor2: 30, competitor3: 25 },
  { date: "Apr 2", brand: 44, competitor1: 37, competitor2: 31, competitor3: 24 },
  { date: "Apr 3", brand: 43, competitor1: 39, competitor2: 29, competitor3: 26 },
  { date: "Apr 4", brand: 46, competitor1: 40, competitor2: 32, competitor3: 25 },
  { date: "Apr 5", brand: 45, competitor1: 38, competitor2: 30, competitor3: 27 },
  { date: "Apr 6", brand: 47, competitor1: 41, competitor2: 33, competitor3: 26 },
  { date: "Apr 7", brand: 48, competitor1: 39, competitor2: 31, competitor3: 28 },
  { date: "Apr 8", brand: 46, competitor1: 42, competitor2: 34, competitor3: 27 },
  { date: "Apr 9", brand: 49, competitor1: 40, competitor2: 32, competitor3: 29 },
  { date: "Apr 10", brand: 50, competitor1: 41, competitor2: 35, competitor3: 28 },
  { date: "Apr 11", brand: 48, competitor1: 43, competitor2: 33, competitor3: 30 },
  { date: "Apr 12", brand: 51, competitor1: 42, competitor2: 36, competitor3: 29 },
  { date: "Apr 13", brand: 50, competitor1: 44, competitor2: 34, competitor3: 31 },
  { date: "Apr 14", brand: 52, competitor1: 43, competitor2: 37, competitor3: 30 },
]

export const mockCompetitorRankings: CompetitorRanking[] = [
  { rank: 1, name: "Allbirds", website: "allbirds.com", visibility: 54.2, rankChange: 0 },
  { rank: 2, name: "Your Brand", website: "yourbrand.com", visibility: 51.8, rankChange: 1 },
  { rank: 3, name: "Bombas", website: "bombas.com", visibility: 43.1, rankChange: -1 },
  { rank: 4, name: "Warby Parker", website: "warbyparker.com", visibility: 36.8, rankChange: 0 },
  { rank: 5, name: "Casper", website: "casper.com", visibility: 29.5, rankChange: 2 },
]

export const mockPlatformBreakdown: PlatformBreakdown[] = [
  { platform: "ChatGPT", visibility: 58, change: 4.2 },
  { platform: "Claude", visibility: 52, change: 3.8 },
  { platform: "Gemini", visibility: 47, change: 1.2 },
  { platform: "Grok", visibility: 31, change: -0.5 },
]

export const mockTopQueries: TopQuery[] = [
  {
    query: "best sustainable sneakers",
    mentions: 9,
    total: 12,
    platforms: ["ChatGPT", "Claude", "Gemini"],
  },
  {
    query: "eco-friendly running shoes",
    mentions: 7,
    total: 10,
    platforms: ["ChatGPT", "Claude"],
  },
  {
    query: "comfortable everyday shoes under $150",
    mentions: 6,
    total: 11,
    platforms: ["ChatGPT", "Gemini", "Grok"],
  },
  {
    query: "best direct-to-consumer shoe brands",
    mentions: 5,
    total: 9,
    platforms: ["Claude", "Gemini"],
  },
  {
    query: "organic cotton sneakers review",
    mentions: 4,
    total: 8,
    platforms: ["ChatGPT"],
  },
]

export const mockSentiment: SentimentData[] = [
  { label: "Positive", value: 68 },
  { label: "Neutral", value: 24 },
  { label: "Negative", value: 8 },
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
    website: "yourbrand.com",
    isOwnBrand: true,
    scores: { ChatGPT: 60, Claude: 55, Gemini: 48, Grok: 35 },
  },
  {
    name: "Allbirds",
    website: "allbirds.com",
    isOwnBrand: false,
    scores: { ChatGPT: 65, Claude: 50, Gemini: 52, Grok: 40 },
  },
  {
    name: "Bombas",
    website: "bombas.com",
    isOwnBrand: false,
    scores: { ChatGPT: 40, Claude: 45, Gemini: 38, Grok: 30 },
  },
  {
    name: "Warby Parker",
    website: "warbyparker.com",
    isOwnBrand: false,
    scores: { ChatGPT: 35, Claude: 30, Gemini: 42, Grok: 25 },
  },
  {
    name: "Casper",
    website: "casper.com",
    isOwnBrand: false,
    scores: { ChatGPT: 20, Claude: 25, Gemini: 30, Grok: 20 },
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
    { rank: 1, name: "Allbirds", website: "allbirds.com", isOwnBrand: false, visibility: 65, shareOfVoice: 28, sentiment: "Positive" },
    { rank: 2, name: "Your Brand", website: "yourbrand.com", isOwnBrand: true, visibility: 60, shareOfVoice: 24, sentiment: "Positive" },
    { rank: 3, name: "Bombas", website: "bombas.com", isOwnBrand: false, visibility: 40, shareOfVoice: 18, sentiment: "Neutral" },
    { rank: 4, name: "Warby Parker", website: "warbyparker.com", isOwnBrand: false, visibility: 35, shareOfVoice: 15, sentiment: "Neutral" },
    { rank: 5, name: "Casper", website: "casper.com", isOwnBrand: false, visibility: 20, shareOfVoice: 10, sentiment: "Neutral" },
  ],
  Claude: [
    { rank: 1, name: "Your Brand", website: "yourbrand.com", isOwnBrand: true, visibility: 55, shareOfVoice: 26, sentiment: "Positive" },
    { rank: 2, name: "Allbirds", website: "allbirds.com", isOwnBrand: false, visibility: 50, shareOfVoice: 22, sentiment: "Positive" },
    { rank: 3, name: "Bombas", website: "bombas.com", isOwnBrand: false, visibility: 45, shareOfVoice: 20, sentiment: "Positive" },
    { rank: 4, name: "Warby Parker", website: "warbyparker.com", isOwnBrand: false, visibility: 30, shareOfVoice: 12, sentiment: "Neutral" },
    { rank: 5, name: "Casper", website: "casper.com", isOwnBrand: false, visibility: 25, shareOfVoice: 8, sentiment: "Negative" },
  ],
  Gemini: [
    { rank: 1, name: "Allbirds", website: "allbirds.com", isOwnBrand: false, visibility: 52, shareOfVoice: 25, sentiment: "Positive" },
    { rank: 2, name: "Your Brand", website: "yourbrand.com", isOwnBrand: true, visibility: 48, shareOfVoice: 22, sentiment: "Positive" },
    { rank: 3, name: "Warby Parker", website: "warbyparker.com", isOwnBrand: false, visibility: 42, shareOfVoice: 18, sentiment: "Neutral" },
    { rank: 4, name: "Bombas", website: "bombas.com", isOwnBrand: false, visibility: 38, shareOfVoice: 15, sentiment: "Neutral" },
    { rank: 5, name: "Casper", website: "casper.com", isOwnBrand: false, visibility: 30, shareOfVoice: 10, sentiment: "Neutral" },
  ],
  Grok: [
    { rank: 1, name: "Allbirds", website: "allbirds.com", isOwnBrand: false, visibility: 40, shareOfVoice: 30, sentiment: "Positive" },
    { rank: 2, name: "Your Brand", website: "yourbrand.com", isOwnBrand: true, visibility: 35, shareOfVoice: 22, sentiment: "Neutral" },
    { rank: 3, name: "Bombas", website: "bombas.com", isOwnBrand: false, visibility: 30, shareOfVoice: 18, sentiment: "Neutral" },
    { rank: 4, name: "Warby Parker", website: "warbyparker.com", isOwnBrand: false, visibility: 25, shareOfVoice: 15, sentiment: "Neutral" },
    { rank: 5, name: "Casper", website: "casper.com", isOwnBrand: false, visibility: 20, shareOfVoice: 10, sentiment: "Negative" },
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
  mentioned: 142,
  recommended: 87,
  topRecommendedQuery: "best sustainable sneakers to buy",
  byProvider: [
    { platform: "ChatGPT", rate: 72 },
    { platform: "Claude", rate: 65 },
    { platform: "Gemini", rate: 54 },
    { platform: "Grok", rate: 38 },
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
    query: "best wool runners for travel",
    competitorsMentioned: ["Allbirds", "Bombas"],
    yourVisibility: 0,
    estimatedVolume: "High",
  },
  {
    query: "sustainable gift ideas under $100",
    competitorsMentioned: ["Allbirds", "Warby Parker", "Casper"],
    yourVisibility: 0,
    estimatedVolume: "High",
  },
  {
    query: "most comfortable work from home shoes",
    competitorsMentioned: ["Allbirds"],
    yourVisibility: 8,
    estimatedVolume: "Medium",
  },
  {
    query: "eco-friendly sneaker brands comparison",
    competitorsMentioned: ["Allbirds", "Bombas"],
    yourVisibility: 12,
    estimatedVolume: "Medium",
  },
  {
    query: "best shoes for standing all day",
    competitorsMentioned: ["Allbirds", "Bombas", "Casper"],
    yourVisibility: 0,
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
  { category: "Sustainable Footwear", rank: 2, totalCompetitors: 12, visibility: 58, trend: 3 },
  { category: "Running Shoes", rank: 4, totalCompetitors: 18, visibility: 34, trend: -1 },
  { category: "Eco-Friendly Fashion", rank: 3, totalCompetitors: 15, visibility: 42, trend: 2 },
  { category: "DTC Brands", rank: 5, totalCompetitors: 22, visibility: 28, trend: 0 },
  { category: "Casual Sneakers", rank: 3, totalCompetitors: 14, visibility: 45, trend: 1 },
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
    title: "Visibility up on Claude",
    description: "Your brand visibility on Claude increased 8% this week, now ranking #1 for sustainable footwear queries.",
  },
  {
    type: "loss",
    title: "Dropped in Running Shoes category",
    description: "Rank fell from #3 to #4 in Running Shoes. Allbirds gained ground with new product mentions.",
  },
  {
    type: "new",
    title: "New competitor detected",
    description: "CARIUMA is now appearing in 3 of your tracked queries across ChatGPT and Gemini.",
  },
  {
    type: "opportunity",
    title: "Content gap opportunity",
    description: "\"best wool runners for travel\" is trending with high volume — competitors rank but you don't.",
  },
]
