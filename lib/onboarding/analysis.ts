import type { InsForgeClient } from "@insforge/sdk"
import {
  Output,
  cosineSimilarity,
  embedMany,
  generateText,
  jsonSchema,
  stepCountIs,
} from "ai"

import {
  getEmbeddingModel,
  getGatewayTools,
  getLanguageModel,
} from "@/lib/ai/provider-config"
import { normalizeBrandTopics, normalizeWebsite, parsePublicWebsiteUrl } from "@/lib/brands"
import {
  mergeMappedPages,
  selectPagesForCrawl,
  type ClassifiedMappedPage,
} from "@/lib/onboarding/analysis-selection"
import {
  logOnboardingAnalysisError,
  logOnboardingAnalysisEvent,
} from "@/lib/onboarding/analysis-logging"
import {
  buildFallbackOnboardingSuggestions,
  mergeOnboardingWarnings,
  normalizeBrandOnboarding,
} from "@/lib/onboarding/normalize"
import {
  getOnboardingCrawlStatus,
  mapWebsiteUrls,
  scrapeBrandHomepage,
  startOnboardingCrawl,
  toFirecrawlDocuments,
  type FirecrawlCrawlDocument,
} from "@/lib/onboarding/firecrawl"
import { generateTopicPromptCollection } from "@/lib/onboarding/topic-prompt-generator"
import {
  onboardingAnalysisResultSchema,
  onboardingAnalysisStartResponseSchema,
  onboardingAnalysisStatusResponseSchema,
  onboardingBrandProfileSchema,
  onboardingGatewayPromptScoreSchema,
  onboardingGatewayTopicClusterSchema,
  onboardingTopicClusterSchema,
  type OnboardingAnalysisRequest,
  type OnboardingAnalysisResult,
  type OnboardingBrandProfile,
  type OnboardingCompetitor,
  type OnboardingTopicDraft,
} from "@/lib/onboarding/types"
import {
  replaceSiteCrawlPages,
  listSiteCrawlPagesByRun,
} from "@/lib/site-crawl-pages/repository"
import type { SiteCrawlPageType } from "@/lib/site-crawl-pages/types"
import {
  createSiteCrawlRun,
  loadSiteCrawlRun,
  updateSiteCrawlRun,
} from "@/lib/site-crawl-runs/repository"
import type { SiteCrawlRunStatus } from "@/lib/site-crawl-runs/types"

type OnboardingAnalysisClient = Pick<InsForgeClient, "auth" | "database">
type ExtractedPageSignal = ReturnType<typeof extractPageSignal>
const ANALYSIS_MAP_SEARCH_TERMS = [
  undefined,
  "pricing",
  "compare",
  "alternatives",
  "vs",
  "blog",
  "products",
  "shop",
  "collections",
] as const

type StoredAnalysisState = {
  companyName: string
  pageSignals?: ExtractedPageSignal[]
  selectedPages?: ClassifiedMappedPage[]
  website: string
}

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function stripMarkdown(value: string) {
  return normalizeWhitespace(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
      .replace(/[#>*_~|-]/g, " ")
  )
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizePageUrl(value: string) {
  const url = parsePublicWebsiteUrl(value)

  if (!url) {
    throw new Error("Enter a valid website")
  }

  url.hash = ""

  return url.toString()
}

function toIncludePath(url: string) {
  const pathname = new URL(normalizePageUrl(url)).pathname

  if (pathname === "/") {
    return "^/$"
  }

  return `^${escapeRegExp(pathname)}$`
}

function uniqueWarnings(warnings: string[]) {
  return [...new Set(warnings.map((warning) => warning.trim()).filter(Boolean))]
}

function toValidationResult<T>(
  schema: {
    safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: Error }
  },
  value: unknown
) {
  const parsed = schema.safeParse(value)

  return parsed.success
    ? { success: true as const, value: parsed.data }
    : { error: parsed.error, success: false as const }
}

function readSourceUrls(
  sources: Array<{ sourceType?: string; url?: string }> | undefined
) {
  return uniqueWarnings(
    (sources ?? []).flatMap((source) =>
      source?.sourceType === "url" && typeof source.url === "string"
        ? [source.url]
        : []
    )
  )
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function readCompetitorCandidates(value: unknown): OnboardingCompetitor[] {
  const competitors = Array.isArray(
    (value as { competitors?: unknown[] } | null | undefined)?.competitors
  )
    ? (value as { competitors: unknown[] }).competitors
    : []

  return competitors.flatMap((competitor) => {
    if (
      competitor &&
      typeof competitor === "object" &&
      typeof (competitor as { name?: unknown }).name === "string" &&
      typeof (competitor as { website?: unknown }).website === "string"
    ) {
      return [
        {
          name: (competitor as { name: string }).name,
          website: (competitor as { website: string }).website,
        },
      ]
    }

    return []
  })
}

function toPersistedPageSignal(
  page: Awaited<ReturnType<typeof listSiteCrawlPagesByRun>>[number]
): ExtractedPageSignal {
  const intents = readStringArray(
    (page.intents_json as { intents?: unknown[] } | null | undefined)?.intents
  )
  const entities = readStringArray(
    (page.entities_json as { entities?: unknown[] } | null | undefined)?.entities
  )

  return {
    canonical_url: page.canonical_url,
    competitor_candidates_json: {
      competitors: readCompetitorCandidates(page.competitor_candidates_json),
    },
    confidence: Math.min(1, page.selection_score / 100),
    content_snapshot: page.content_snapshot,
    entities_json: {
      entities,
    },
    evidenceSnippets: [],
    intents,
    intents_json: {
      intents,
    },
    meta_description: page.meta_description,
    pageType: page.page_type,
    page_metadata_json: page.page_metadata_json,
    selection_reason: page.selection_reason,
    selection_score: page.selection_score,
    summary: page.content_snapshot.slice(0, 280),
    title: page.title,
    url: page.canonical_url,
  }
}

function getPageIntentSeeds(pageType: SiteCrawlPageType, content: string) {
  const seeds = new Set<string>()

  switch (pageType) {
    case "homepage":
      seeds.add("buyer discovery")
      seeds.add("product overview")
      break
    case "product":
      seeds.add("feature evaluation")
      seeds.add("implementation guidance")
      break
    case "pricing":
      seeds.add("pricing evaluation")
      seeds.add("budget planning")
      break
    case "comparison":
      seeds.add("competitor analysis")
      seeds.add("alternatives research")
      break
    case "blog":
      seeds.add("educational research")
      seeds.add("implementation guidance")
      break
    case "excluded":
      break
  }

  if (/\bpricing|cost|plan\b/i.test(content)) {
    seeds.add("pricing evaluation")
  }

  if (/\balternative|compare|versus| vs \b/i.test(content)) {
    seeds.add("alternatives research")
  }

  if (/\bimplementation|setup|workflow|playbook|guide\b/i.test(content)) {
    seeds.add("implementation guidance")
  }

  if (/\bbrand visibility|citations?|mentions?|share of voice\b/i.test(content)) {
    seeds.add("brand visibility")
  }

  return [...seeds]
}

function extractCompetitorCandidates(
  document: FirecrawlCrawlDocument,
  companyName: string
) {
  const content = `${document.url} ${document.metadata.title ?? ""} ${document.markdown}`
  const candidates: OnboardingCompetitor[] = []

  const vsMatches = [...content.matchAll(/\bvs\.?\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/g)]
  const alternativeMatches = [
    ...content.matchAll(/\balternatives?\s+to\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/g),
  ]

  for (const match of [...vsMatches, ...alternativeMatches]) {
    const name = normalizeWhitespace(match[1] ?? "")

    if (!name || name.toLowerCase() === companyName.trim().toLowerCase()) {
      continue
    }

    candidates.push({
      name,
      website: `https://${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.com`,
    })
  }

  return candidates.slice(0, 3)
}

function extractPageSignal(
  document: FirecrawlCrawlDocument,
  selectedPages: ClassifiedMappedPage[],
  companyName: string
) {
  const selected = selectedPages.find((page) => page.url === document.url)
  const pageType = selected?.pageType ?? "product"
  const contentSnapshot = stripMarkdown(document.markdown).slice(0, 1200)
  const entities = uniqueWarnings(
    [
      typeof document.metadata.title === "string" ? document.metadata.title : "",
      ...contentSnapshot
        .split(/[.?!]/)
        .slice(0, 2)
        .map((segment) => segment.slice(0, 90)),
    ].filter(Boolean)
  ).slice(0, 5)

  return {
    canonical_url: document.url,
    competitor_candidates_json: {
      competitors: extractCompetitorCandidates(document, companyName),
    },
    confidence: selected ? Math.min(1, selected.selectionScore / 100) : 0.6,
    content_snapshot: contentSnapshot,
    entities_json: {
      entities,
    },
    evidenceSnippets: contentSnapshot
      .split(/[.?!]/)
      .map((value) => normalizeWhitespace(value))
      .filter((value) => value.length >= 20)
      .slice(0, 3),
    intents: getPageIntentSeeds(pageType, contentSnapshot),
    intents_json: {
      intents: getPageIntentSeeds(pageType, contentSnapshot),
    },
    meta_description:
      typeof document.metadata.description === "string"
        ? document.metadata.description
        : null,
    pageType,
    page_metadata_json: document.metadata,
    selection_reason: selected?.selectionReason ?? "Crawled page",
    selection_score: selected?.selectionScore ?? 70,
    summary: contentSnapshot.slice(0, 280),
    title:
      typeof document.metadata.title === "string" ? document.metadata.title : null,
    url: document.url,
  }
}

function buildBrandProfileOutputSchema() {
  return jsonSchema(
    {
      $schema: "http://json-schema.org/draft-07/schema#",
      additionalProperties: false,
      properties: {
        adjacentCategories: {
          items: { type: "string" },
          type: "array",
        },
        category: { type: "string" },
        competitors: {
          items: {
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              website: { type: "string" },
            },
            required: ["name", "website"],
            type: "object",
          },
          type: "array",
        },
        description: { type: "string" },
        differentiators: {
          items: { type: "string" },
          type: "array",
        },
        evidenceUrls: {
          items: { type: "string" },
          type: "array",
        },
        productCategories: {
          items: { type: "string" },
          type: "array",
        },
        targetAudiences: {
          items: { type: "string" },
          type: "array",
        },
        topUseCases: {
          items: { type: "string" },
          type: "array",
        },
        warnings: {
          items: { type: "string" },
          type: "array",
        },
      },
      required: [
        "adjacentCategories",
        "category",
        "competitors",
        "description",
        "differentiators",
        "evidenceUrls",
        "productCategories",
        "targetAudiences",
        "topUseCases",
        "warnings",
      ],
      type: "object",
    },
    {
      validate: async (value) =>
        toValidationResult(onboardingBrandProfileSchema, value),
    }
  )
}

function buildTopicClusterOutputSchema() {
  return jsonSchema(
    {
      $schema: "http://json-schema.org/draft-07/schema#",
      additionalProperties: false,
      properties: {
        topics: {
          items: {
            additionalProperties: false,
            properties: {
              clusterId: { type: "string" },
              intentSummary: { type: "string" },
              source: {
                enum: ["user_added", "ai_suggested", "system_seeded"],
                type: "string",
              },
              sourceUrls: {
                items: { type: "string" },
                type: "array",
              },
              topicName: { type: "string" },
            },
            required: [
              "clusterId",
              "intentSummary",
              "source",
              "sourceUrls",
              "topicName",
            ],
            type: "object",
          },
          minItems: 1,
          type: "array",
        },
      },
      required: ["topics"],
      type: "object",
    },
    {
      validate: async (value) =>
        toValidationResult(onboardingGatewayTopicClusterSchema, value),
    }
  )
}

function buildPromptScoreOutputSchema() {
  return jsonSchema(
    {
      $schema: "http://json-schema.org/draft-07/schema#",
      additionalProperties: false,
      properties: {
        scoredPrompts: {
          items: {
            additionalProperties: false,
            properties: {
              breakdown: {
                additionalProperties: false,
                properties: {
                  brandCompetitorRelevance: { type: "number" },
                  buyerValue: { type: "number" },
                  evidenceGrounding: { type: "number" },
                  naturalUserPhrasing: { type: "number" },
                  specificity: { type: "number" },
                  topicFit: { type: "number" },
                },
                required: [
                  "brandCompetitorRelevance",
                  "buyerValue",
                  "evidenceGrounding",
                  "naturalUserPhrasing",
                  "specificity",
                  "topicFit",
                ],
                type: "object",
              },
              evidenceUrls: {
                items: { type: "string" },
                type: "array",
              },
              keep: { type: "boolean" },
              pqsScore: { type: "number" },
              reason: { type: "string" },
              renderedPromptText: { type: "string" },
              replacementPromptText: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              variantType: {
                enum: [
                  "discovery",
                  "comparison",
                  "alternatives",
                  "pricing",
                  "implementation",
                  "use_case",
                  "migration",
                  "roi",
                  "integration",
                  "competitor_specific",
                ],
                type: "string",
              },
            },
            required: [
              "breakdown",
              "evidenceUrls",
              "keep",
              "pqsScore",
              "reason",
              "renderedPromptText",
              "replacementPromptText",
              "variantType",
            ],
            type: "object",
          },
          type: "array",
        },
      },
      required: ["scoredPrompts"],
      type: "object",
    },
    {
      validate: async (value) =>
        toValidationResult(onboardingGatewayPromptScoreSchema, value),
    }
  )
}

async function clusterIntentGroups(pageSignals: ReturnType<typeof extractPageSignal>[]) {
  const values = uniqueWarnings(
    pageSignals.flatMap((pageSignal) =>
      pageSignal.intents.map((intent) => `${intent}: ${pageSignal.summary}`)
    )
  )

  if (values.length === 0) {
    return []
  }

  try {
    const { embeddings } = await embedMany({
      model: getEmbeddingModel("openai/text-embedding-3-small"),
      values,
    })
    const clusters: Array<{ members: string[]; centroid: number[] }> = []

    for (const [index, value] of values.entries()) {
      const embedding = embeddings[index]

      if (!embedding) {
        continue
      }

      const cluster = clusters.find(
        (candidate) => cosineSimilarity(candidate.centroid, embedding) >= 0.82
      )

      if (cluster) {
        cluster.members.push(value)
        continue
      }

      clusters.push({
        centroid: embedding,
        members: [value],
      })
    }

    return clusters.map((cluster, index) => ({
      clusterId: `cluster-${index + 1}`,
      signals: cluster.members,
    }))
  } catch (error) {
    console.warn("[onboarding] Embedding cluster fallback", error)

    return values.map((value, index) => ({
      clusterId: `cluster-${index + 1}`,
      signals: [value],
    }))
  }
}

async function buildBrandProfile(input: {
  companyName: string
  pageSignals: ReturnType<typeof extractPageSignal>[]
  website: string
}) {
  const prompt = [
    `Company: ${input.companyName}`,
    `Website: ${normalizeWebsite(input.website)}`,
    "Page signals:",
    ...input.pageSignals.map(
      (pageSignal) =>
        `- URL: ${pageSignal.url}\n  Type: ${pageSignal.pageType}\n  Summary: ${pageSignal.summary}\n  Intents: ${pageSignal.intents.join(", ")}\n  Evidence snippets: ${pageSignal.evidenceSnippets.join(" | ") || "(none)"}\n  Competitors: ${
            (pageSignal.competitor_candidates_json.competitors as OnboardingCompetitor[])
              .map((competitor) => competitor.name)
              .join(", ") || "(none)"
          }`
    ),
  ].join("\n")

  const { output } = await generateText({
    model: getLanguageModel("openai", {
      capability: "structuredOutput",
    }),
    output: Output.object({
      schema: buildBrandProfileOutputSchema(),
    }),
    prompt,
    system: [
      "You are an onboarding analysis assistant.",
      "Return a structured brand profile grounded in the supplied crawl evidence.",
      "Infer the company's product category, target audiences, top use cases, differentiators, adjacent categories, concise description, conservative competitor list, and evidence URLs.",
      "Prefer evidence from product, pricing, and comparison pages over generic marketing copy.",
      "If a field is weakly supported, return an empty array instead of guessing.",
      "Return only the fields in the schema.",
    ].join(" "),
  })

  return onboardingBrandProfileSchema.parse(output)
}

async function buildClusteredTopics(input: {
  brandProfile: OnboardingBrandProfile
  clusters: Awaited<ReturnType<typeof clusterIntentGroups>>
  pageSignals: ReturnType<typeof extractPageSignal>[]
}) {
  const prompt = [
    `Brand category: ${input.brandProfile.category}`,
    `Target audiences: ${input.brandProfile.targetAudiences.join(", ") || "(none)"}`,
    `Top use cases: ${input.brandProfile.topUseCases.join(", ") || "(none)"}`,
    `Differentiators: ${input.brandProfile.differentiators.join(", ") || "(none)"}`,
    `Adjacent categories: ${input.brandProfile.adjacentCategories.join(", ") || "(none)"}`,
    `Competitors: ${input.brandProfile.competitors.map((competitor) => competitor.name).join(", ") || "(none)"}`,
    "",
    "Intent clusters:",
    ...input.clusters.map(
      (cluster) => `- ${cluster.clusterId}: ${cluster.signals.join(" | ")}`
    ),
    "",
    "Source pages:",
    ...input.pageSignals.map(
      (pageSignal) =>
        `- ${pageSignal.url} (${pageSignal.pageType}): ${pageSignal.summary}`
    ),
  ].join("\n")

  const { output } = await generateText({
    model: getLanguageModel("openai", {
      capability: "structuredOutput",
    }),
    output: Output.object({
      schema: buildTopicClusterOutputSchema(),
    }),
    prompt,
    system: [
      "You are an onboarding topic clustering assistant.",
      "Use the brand profile plus the crawl evidence to generate buyer-facing topic clusters.",
      "Create 4 to 8 high-signal topics that reflect realistic demand scenarios, vendor discovery paths, problem-solving moments, and comparison intents.",
      "Avoid meta labels like feature evaluation, competitor analysis, prompt monitoring, reporting, generic, or workflow depth.",
      "Prefer concrete themes tied to category, persona, use case, industry, or decision criteria.",
      "Each topic must include clusterId, topicName, intentSummary, sourceUrls, and source.",
      "Return only the fields defined in the schema.",
    ].join(" "),
  })

  return onboardingTopicClusterSchema.parse(output).topics.map((topic, index) => ({
    ...topic,
    clusterId: topic.clusterId ?? `cluster-${index + 1}`,
    source: topic.source ?? "ai_suggested",
    sourceUrls: topic.sourceUrls ?? [],
    topicName: normalizeBrandTopics([topic.topicName])[0] ?? topic.topicName,
  }))
}

async function scoreTopicsWithWebSearch(input: {
  companyName: string
  competitors: OnboardingCompetitor[]
  topics: OnboardingTopicDraft[]
}) {
  const scoredTopics: OnboardingTopicDraft[] = []

  for (const topic of input.topics) {
    try {
      const searchResult = await generateText({
        model: getLanguageModel("openai", {
          capability: "webSearch",
        }),
        prompt: [
          `Company: ${input.companyName}`,
          `Competitors: ${input.competitors.map((competitor) => competitor.name).join(", ") || "(none)"}`,
          `Topic: ${topic.topicName}`,
          `Intent summary: ${topic.intentSummary ?? ""}`,
          `Source URLs: ${topic.sourceUrls?.join(", ") || "(none)"}`,
          "Candidate prompts:",
          ...topic.prompts.map(
            (prompt) => `- [${prompt.variantType ?? "unknown"}] ${prompt.promptText}`
          ),
        ].join("\n"),
        system: [
          "You are a prompt research assistant.",
          "Use web search when needed to evaluate each candidate prompt against public evidence about the company, category, and competitors.",
          "Return concise plain-text notes for every candidate prompt.",
          "For each prompt include: Prompt, Keep (yes or no), Replacement (only if needed), Reason, and Evidence URL.",
          "Do not return JSON.",
        ].join(" "),
        tools: {
          perplexity_search: getGatewayTools().perplexitySearch({
            country: "US",
            maxResults: 5,
            searchLanguageFilter: ["en"],
          }),
        },
        stopWhen: stepCountIs(3),
        temperature: 0,
      })
      const groundingUrls = readSourceUrls(searchResult.sources)
      const { output } = await generateText({
        model: getLanguageModel("openai", {
          capability: "structuredOutput",
        }),
        output: Output.object({
          schema: buildPromptScoreOutputSchema(),
        }),
        prompt: [
          `Company: ${input.companyName}`,
          `Competitors: ${input.competitors.map((competitor) => competitor.name).join(", ") || "(none)"}`,
          `Topic: ${topic.topicName}`,
          `Intent summary: ${topic.intentSummary ?? ""}`,
          `Source URLs: ${topic.sourceUrls?.join(", ") || "(none)"}`,
          "Candidate prompts:",
          ...topic.prompts.map(
            (prompt) => `- [${prompt.variantType ?? "unknown"}] ${prompt.promptText}`
          ),
          "",
          "Web research notes:",
          searchResult.text || "(none)",
          "",
          "Grounding URLs:",
          groundingUrls.length > 0 ? groundingUrls.join("\n") : "(none)",
        ].join("\n"),
        system: [
          "You are a prompt quality scoring normalizer.",
          "Convert the web research notes into the exact schema.",
          "Return one scoredPrompts item for every candidate prompt in the same order.",
          "Set renderedPromptText to the original candidate prompt text exactly.",
          "If a prompt should be kept, set replacementPromptText to null.",
          "If a prompt should be replaced, provide concise replacementPromptText.",
          "Use only URLs listed under Grounding URLs in evidenceUrls.",
          "Score prompts using this fixed 100-point rubric: topicFit 30, naturalUserPhrasing 20, specificity 15, buyerValue 15, brandCompetitorRelevance 10, evidenceGrounding 10.",
          "Return only the schema fields.",
        ].join(" "),
        temperature: 0,
      })

      const parsedOutput = onboardingGatewayPromptScoreSchema.parse(output)
      const promptByKey = new Map(
        topic.prompts.map((prompt) => [prompt.promptText, prompt])
      )
      const rescored = parsedOutput.scoredPrompts.map((scoredPrompt, index) => {
        const basePrompt = promptByKey.get(scoredPrompt.renderedPromptText)
        const promptText =
          scoredPrompt.keep || !scoredPrompt.replacementPromptText
            ? scoredPrompt.renderedPromptText
            : scoredPrompt.replacementPromptText

        return {
          addedVia: basePrompt?.addedVia ?? "ai_suggested",
          pqsRank: index + 1,
          pqsScore: scoredPrompt.pqsScore,
          promptText,
          scoreMetadata: {
            ...(basePrompt?.scoreMetadata ?? {}),
            ...scoredPrompt.breakdown,
            evidenceUrls: scoredPrompt.evidenceUrls,
            reason: scoredPrompt.reason,
          },
          scoreStatus: "scored" as const,
          sourceAnalysisRunId: basePrompt?.sourceAnalysisRunId,
          templateText: basePrompt?.templateText,
          variantType: scoredPrompt.variantType,
        }
      })

      scoredTopics.push({
        ...topic,
        prompts: rescored.sort(
          (left, right) => (right.pqsScore ?? 0) - (left.pqsScore ?? 0)
        ),
      })
    } catch (error) {
      console.warn("[onboarding] Prompt web score fallback", error)
      scoredTopics.push(topic)
    }
  }

  return scoredTopics
}

async function buildFallbackAnalysis(input: {
  analysisId: string
  companyName: string
  warnings: string[]
  website: string
}): Promise<OnboardingAnalysisResult> {
  const scrapeContext = await scrapeBrandHomepage(input.website)
  const fallback = await normalizeBrandOnboarding({
    companyName: input.companyName,
    context: scrapeContext,
    website: input.website,
  }).catch(() =>
    mergeOnboardingWarnings(
      input.warnings,
      buildFallbackOnboardingSuggestions(scrapeContext, input.website)
    )
  )
  const promptCollection = await generateTopicPromptCollection({
    analysisRunId: input.analysisId,
    companyName: input.companyName,
    competitors: fallback.competitors,
    description: fallback.description,
    topics: fallback.topics.map((topicName) => ({
      source: "ai_suggested",
      topicName,
    })),
    website: input.website,
  })

  return onboardingAnalysisResultSchema.parse({
    competitors: fallback.competitors,
    description: fallback.description,
    topics: promptCollection.topics.map((topic, index) => ({
      ...topic,
      clusterId: `cluster-${index + 1}`,
      intentSummary: `Fallback topic generated from homepage context for ${topic.topicName}`,
      sourceUrls: [normalizeWebsite(input.website)],
    })),
    warnings: uniqueWarnings([...fallback.warnings, ...input.warnings]),
  })
}

export async function startOnboardingAnalysisRun(
  client: OnboardingAnalysisClient,
  input: OnboardingAnalysisRequest
) {
  logOnboardingAnalysisEvent("Analysis start requested", {
    companyName: input.companyName,
    projectId: input.projectId,
    website: input.website,
  })

  const run = await createSiteCrawlRun(client, {
    projectId: input.projectId,
  })
  const warnings: string[] = []

  logOnboardingAnalysisEvent("Analysis run created", {
    analysisId: run.id,
    projectId: run.project_id,
    status: run.status,
  })

  const mapGroups = await Promise.all(
    ANALYSIS_MAP_SEARCH_TERMS.map(
      async (search) => {
        try {
          logOnboardingAnalysisEvent("Starting Firecrawl map", {
            analysisId: run.id,
            search: search ?? "(base)",
            website: input.website,
          })

          const mappedPages = await mapWebsiteUrls(input.website, {
            search,
          })

          logOnboardingAnalysisEvent("Firecrawl map completed", {
            analysisId: run.id,
            pageCount: mappedPages.length,
            search: search ?? "(base)",
          })

          return mappedPages
        } catch (error) {
          logOnboardingAnalysisError("Firecrawl map failed", error, {
            analysisId: run.id,
            search: search ?? "(base)",
            website: input.website,
          })
          warnings.push(
            toMessage(error, `Unable to map website${search ? ` for ${search}` : ""}.`)
          )
          return []
        }
      }
    )
  )

  const mergedPages = mergeMappedPages(mapGroups)
  const selectedPages = selectPagesForCrawl(mergedPages, {
    maxPages: 10,
    minPages: 6,
    rootUrl: input.website,
  })
  const selectedWithFallback =
    selectedPages.length > 0
      ? selectedPages
      : selectPagesForCrawl(
          [
            {
              description: null,
              title: input.companyName,
              url: normalizeWebsite(input.website),
            },
          ],
          {
            maxPages: 1,
            minPages: 1,
            rootUrl: input.website,
          }
        )

  let firecrawlJobIds: string[] = []
  let status: SiteCrawlRunStatus = "extracting"

  logOnboardingAnalysisEvent("Selected crawl pages", {
    analysisId: run.id,
    mergedPageCount: mergedPages.length,
    selectedPageTypes: selectedWithFallback.map((page) => ({
      pageType: page.pageType,
      score: page.selectionScore,
      url: page.url,
    })),
  })

  try {
    logOnboardingAnalysisEvent("Starting Firecrawl crawl", {
      analysisId: run.id,
      includePaths: selectedWithFallback.map((page) => toIncludePath(page.url)),
      selectedUrlCount: selectedWithFallback.length,
      website: input.website,
    })

    const crawl = await startOnboardingCrawl({
      includePaths: selectedWithFallback.map((page) => toIncludePath(page.url)),
      website: input.website,
    })
    firecrawlJobIds = [crawl.id]
    status = "crawling"

    logOnboardingAnalysisEvent("Firecrawl crawl started", {
      analysisId: run.id,
      crawlJobId: crawl.id,
      status,
    })
  } catch (error) {
    logOnboardingAnalysisError("Firecrawl crawl start failed", error, {
      analysisId: run.id,
      selectedUrlCount: selectedWithFallback.length,
      website: input.website,
    })
    warnings.push(
      toMessage(
        error,
        "We could not start the site crawl. We will fall back to homepage analysis."
      )
    )
  }

  await updateSiteCrawlRun(client, run.id, {
    firecrawl_job_ids: firecrawlJobIds,
    result_json: {
      companyName: input.companyName,
      selectedPages: selectedWithFallback,
      website: normalizeWebsite(input.website),
    },
    selected_url_count: selectedWithFallback.length,
    status,
    warnings: uniqueWarnings(warnings),
  })

  logOnboardingAnalysisEvent("Analysis run persisted after start", {
    analysisId: run.id,
    crawlJobIds: firecrawlJobIds,
    status,
    warningCount: warnings.length,
  })

  return onboardingAnalysisStartResponseSchema.parse({
    analysisId: run.id,
    status,
    warnings: uniqueWarnings(warnings),
  })
}

export async function advanceOnboardingAnalysisRun(
  client: OnboardingAnalysisClient,
  analysisId: string
) {
  logOnboardingAnalysisEvent("Analysis poll requested", {
    analysisId,
  })

  const run = await loadSiteCrawlRun(client, analysisId)

  if (!run) {
    throw new Error("Unable to find the requested analysis run.")
  }

  if (run.status === "completed" || run.status === "failed") {
    logOnboardingAnalysisEvent("Analysis poll returned terminal run", {
      analysisId: run.id,
      status: run.status,
      warningCount: run.warnings.length,
    })

    return onboardingAnalysisStatusResponseSchema.parse({
      analysisId: run.id,
      result: run.result_json
        ? onboardingAnalysisResultSchema.parse(run.result_json)
        : undefined,
      status: run.status,
      warnings: run.warnings,
    })
  }

  const stored = (run.result_json ?? {}) as StoredAnalysisState
  const warnings = [...run.warnings]

  if (run.status === "crawling" && run.firecrawl_job_ids.length > 0) {
    logOnboardingAnalysisEvent("Polling Firecrawl crawl status", {
      analysisId: run.id,
      crawlJobIds: run.firecrawl_job_ids,
    })

    const statuses = await Promise.all(
      run.firecrawl_job_ids.map((jobId) =>
        getOnboardingCrawlStatus(jobId).catch((error) => {
          warnings.push(
            toMessage(error, `Unable to load crawl status for job ${jobId}.`)
          )

          return {
            data: [],
            id: jobId,
            status: "failed" as const,
          }
        })
      )
    )

    if (statuses.some((status) => status.status === "scraping")) {
      logOnboardingAnalysisEvent("Firecrawl crawl still scraping", {
        analysisId: run.id,
        crawlStatuses: statuses.map((status) => ({
          jobId: status.id,
          status: status.status,
        })),
      })

      return onboardingAnalysisStatusResponseSchema.parse({
        analysisId: run.id,
        status: "crawling",
        warnings: uniqueWarnings(warnings),
      })
    }

    const documents = statuses.flatMap((status) =>
      toFirecrawlDocuments(
        Array.isArray(status.data)
          ? (status.data as Array<{
              html?: string | null
              markdown?: string | null
              metadata?: Record<string, unknown> | null
            }>)
          : []
      )
    )

    logOnboardingAnalysisEvent("Firecrawl crawl completed", {
      analysisId: run.id,
      documentCount: documents.length,
      crawlStatuses: statuses.map((status) => ({
        jobId: status.id,
        status: status.status,
      })),
    })

    if (documents.length === 0) {
      logOnboardingAnalysisEvent("No crawl documents available, using fallback", {
        analysisId: run.id,
      })

      const fallback = await buildFallbackAnalysis({
        analysisId: run.id,
        companyName: stored.companyName,
        warnings: uniqueWarnings(warnings),
        website: stored.website,
      })
      const completed = await updateSiteCrawlRun(client, run.id, {
        completed_at: new Date().toISOString(),
        result_json: fallback,
        status: "completed",
        warnings: fallback.warnings,
      })

      return onboardingAnalysisStatusResponseSchema.parse({
        analysisId: completed.id,
        result: fallback,
        status: completed.status,
        warnings: completed.warnings,
      })
    }

    const pageSignals = documents.map((document) =>
      extractPageSignal(document, stored.selectedPages ?? [], stored.companyName)
    )

    logOnboardingAnalysisEvent("Extracted page signals", {
      analysisId: run.id,
      pageSignalCount: pageSignals.length,
    })

    await replaceSiteCrawlPages(client, run.id, run.project_id, pageSignals.map((pageSignal) => ({
      canonical_url: pageSignal.canonical_url,
      competitor_candidates_json: pageSignal.competitor_candidates_json,
      content_snapshot: pageSignal.content_snapshot,
      entities_json: pageSignal.entities_json,
      intents_json: pageSignal.intents_json,
      meta_description: pageSignal.meta_description,
      page_metadata_json: pageSignal.page_metadata_json,
      page_type: pageSignal.pageType,
      selection_reason: pageSignal.selection_reason,
      selection_score: pageSignal.selection_score,
      title: pageSignal.title,
    })))

    await updateSiteCrawlRun(client, run.id, {
      result_json: {
        ...stored,
        pageSignals,
      },
      status: "extracting",
      warnings: uniqueWarnings(warnings),
    })

    logOnboardingAnalysisEvent("Persisted extracted crawl pages", {
      analysisId: run.id,
      pageCount: pageSignals.length,
      status: "extracting",
    })
  }

  const refreshedRun = await loadSiteCrawlRun(client, run.id)

  if (!refreshedRun) {
    throw new Error("Unable to reload analysis run.")
  }

  const refreshedStored = (refreshedRun.result_json ?? {}) as StoredAnalysisState
  const persistedPages = await listSiteCrawlPagesByRun(client, refreshedRun.id)
  const pageSignals =
    refreshedStored.pageSignals ?? persistedPages.map(toPersistedPageSignal)

  logOnboardingAnalysisEvent("Loaded page signals for analysis", {
    analysisId: refreshedRun.id,
    pageSignalCount: pageSignals.length,
    persistedPageCount: persistedPages.length,
    status: refreshedRun.status,
  })

  if (pageSignals.length === 0) {
    logOnboardingAnalysisEvent("No page signals available, using fallback", {
      analysisId: refreshedRun.id,
    })

    const fallback = await buildFallbackAnalysis({
      analysisId: refreshedRun.id,
      companyName: refreshedStored.companyName,
      warnings: uniqueWarnings(refreshedRun.warnings),
      website: refreshedStored.website,
    })
    const completed = await updateSiteCrawlRun(client, refreshedRun.id, {
      completed_at: new Date().toISOString(),
      result_json: fallback,
      status: "completed",
      warnings: fallback.warnings,
    })

    return onboardingAnalysisStatusResponseSchema.parse({
      analysisId: completed.id,
      result: fallback,
      status: completed.status,
      warnings: completed.warnings,
    })
  }

  await updateSiteCrawlRun(client, refreshedRun.id, {
    status: "clustering",
  })

  let brandProfile: OnboardingBrandProfile

  try {
    logOnboardingAnalysisEvent("Building brand profile", {
      analysisId: refreshedRun.id,
      pageSignalCount: pageSignals.length,
    })

    brandProfile = await buildBrandProfile({
      companyName: refreshedStored.companyName,
      pageSignals,
      website: refreshedStored.website,
    })

    logOnboardingAnalysisEvent("Brand profile built", {
      analysisId: refreshedRun.id,
      competitorCount: brandProfile.competitors.length,
      descriptionLength: brandProfile.description.length,
      warningCount: brandProfile.warnings.length,
    })
  } catch (error) {
    logOnboardingAnalysisError("Brand profile build failed, using fallback", error, {
      analysisId: refreshedRun.id,
      pageSignalCount: pageSignals.length,
    })
    const fallback = await buildFallbackAnalysis({
      analysisId: refreshedRun.id,
      companyName: refreshedStored.companyName,
      warnings: uniqueWarnings([
        ...refreshedRun.warnings,
        toMessage(error, "Unable to build brand profile from crawl context."),
      ]),
      website: refreshedStored.website,
    })

    const completed = await updateSiteCrawlRun(client, refreshedRun.id, {
      completed_at: new Date().toISOString(),
      result_json: fallback,
      status: "completed",
      warnings: fallback.warnings,
    })

    return onboardingAnalysisStatusResponseSchema.parse({
      analysisId: completed.id,
      result: fallback,
      status: completed.status,
      warnings: completed.warnings,
    })
  }

  const clusters = await clusterIntentGroups(pageSignals)

  logOnboardingAnalysisEvent("Intent clusters built", {
    analysisId: refreshedRun.id,
    clusterCount: clusters.length,
  })

  let topics: OnboardingTopicDraft[]

  try {
    await updateSiteCrawlRun(client, refreshedRun.id, {
      status: "prompting",
    })

    logOnboardingAnalysisEvent("Generating clustered topics and prompts", {
      analysisId: refreshedRun.id,
      clusterCount: clusters.length,
    })

    const clusteredTopics = await buildClusteredTopics({
      brandProfile,
      clusters,
      pageSignals,
    })
    const promptCollection = await generateTopicPromptCollection({
      analysisRunId: refreshedRun.id,
      brandProfile,
      companyName: refreshedStored.companyName,
      competitors: brandProfile.competitors,
      description: brandProfile.description,
      topics: clusteredTopics.map((topic) => ({
        intentSummary: topic.intentSummary,
        source: topic.source,
        sourceUrls: topic.sourceUrls,
        topicName: topic.topicName,
      })),
      website: refreshedStored.website,
    })

    topics = promptCollection.topics.map((topic, index) => {
      const cluster = clusteredTopics[index]

      return {
        ...topic,
        clusterId: cluster?.clusterId ?? `cluster-${index + 1}`,
        intentSummary:
          cluster?.intentSummary ??
          `Topic generated from crawl context for ${topic.topicName}`,
        sourceUrls:
          cluster?.sourceUrls?.length > 0
            ? cluster.sourceUrls
            : pageSignals
                .filter((pageSignal) => pageSignal.pageType !== "excluded")
                .slice(0, 3)
                .map((pageSignal) => pageSignal.url),
      }
    })

    logOnboardingAnalysisEvent("Generated topic and prompt drafts", {
      analysisId: refreshedRun.id,
      promptCount: topics.reduce(
        (total, topic) => total + topic.prompts.length,
        0
      ),
      topicCount: topics.length,
    })
    warnings.push(...promptCollection.warnings)
  } catch (error) {
    logOnboardingAnalysisError("Topic generation failed, using fallback", error, {
      analysisId: refreshedRun.id,
      clusterCount: clusters.length,
    })
    const normalizedTopics = normalizeBrandTopics(
      clusters.flatMap((cluster) =>
        cluster.signals.map((signal) => signal.split(":")[0] ?? signal)
      )
    ).slice(0, 8)

    await updateSiteCrawlRun(client, refreshedRun.id, {
      status: "prompting",
    })

    const promptCollection = await generateTopicPromptCollection({
      analysisRunId: refreshedRun.id,
      brandProfile,
      companyName: refreshedStored.companyName,
      competitors: brandProfile.competitors,
      description: brandProfile.description,
      topics: normalizedTopics.map((topicName) => ({
        intentSummary: `Fallback clustered topic for ${topicName}`,
        source: "ai_suggested",
        sourceUrls: pageSignals.slice(0, 3).map((pageSignal) => pageSignal.url),
        topicName,
      })),
      website: refreshedStored.website,
    })

    topics = promptCollection.topics.map((topic, index) => ({
      ...topic,
      clusterId: `cluster-${index + 1}`,
      intentSummary: `Fallback clustered topic for ${topic.topicName}`,
      sourceUrls: pageSignals.slice(0, 3).map((pageSignal) => pageSignal.url),
    }))

    logOnboardingAnalysisEvent("Generated fallback topics and prompts", {
      analysisId: refreshedRun.id,
      promptCount: topics.reduce(
        (total, topic) => total + topic.prompts.length,
        0
      ),
      topicCount: topics.length,
    })
    warnings.push(...promptCollection.warnings)
  }

  await updateSiteCrawlRun(client, refreshedRun.id, {
    status: "scoring",
  })

  logOnboardingAnalysisEvent("Scoring prompt drafts", {
    analysisId: refreshedRun.id,
    promptCount: topics.reduce((total, topic) => total + topic.prompts.length, 0),
    topicCount: topics.length,
  })

  const scoredTopics = await scoreTopicsWithWebSearch({
    companyName: refreshedStored.companyName,
    competitors: brandProfile.competitors,
    topics,
  })

  logOnboardingAnalysisEvent("Scored prompt drafts", {
    analysisId: refreshedRun.id,
    promptCount: scoredTopics.reduce(
      (total, topic) => total + topic.prompts.length,
      0
    ),
    topicCount: scoredTopics.length,
  })

  const result = onboardingAnalysisResultSchema.parse({
    competitors: brandProfile.competitors.slice(0, 5),
    description: brandProfile.description,
    topics: scoredTopics.slice(0, 10),
    warnings: uniqueWarnings([
      ...refreshedRun.warnings,
      ...warnings,
      ...brandProfile.warnings,
    ]),
  })

  const completed = await updateSiteCrawlRun(client, refreshedRun.id, {
    completed_at: new Date().toISOString(),
    result_json: result,
    status: "completed",
    warnings: result.warnings,
  })

  logOnboardingAnalysisEvent("Analysis run completed", {
    analysisId: completed.id,
    competitorCount: result.competitors.length,
    status: completed.status,
    topicCount: result.topics.length,
    warningCount: result.warnings.length,
  })

  return onboardingAnalysisStatusResponseSchema.parse({
    analysisId: completed.id,
    result,
    status: completed.status,
    warnings: completed.warnings,
  })
}
