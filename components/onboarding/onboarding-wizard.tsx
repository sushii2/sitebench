"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  Edit02Icon,
  RefreshIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import {
  getCompanyNameValidationError,
  getWebsiteValidationError,
  normalizeBrandTopics,
  saveBrandDraftStep,
  type BrandWithCompetitors,
} from "@/lib/brands"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import {
  completeOnboarding,
  fetchOnboardingTopicPrompts,
  pollOnboardingAnalysis,
  startOnboardingAnalysis,
} from "@/lib/onboarding/client"
import type {
  OnboardingAnalysisResult,
  OnboardingCatalog,
  OnboardingPromptDraft,
  OnboardingTopicDraft,
} from "@/lib/onboarding/types"
import { cn } from "@/lib/utils"
import { BrandPreview } from "@/components/brands/brand-preview"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  AnalysisTimeline,
  type AnalysisStatus,
} from "@/components/onboarding/analysis-timeline"
import {
  OnboardingSidebar,
  type SidebarStep,
} from "@/components/onboarding/onboarding-sidebar"
import { PromptEditDialog } from "@/components/onboarding/prompt-edit-dialog"
import {
  TopicsPromptsTable,
  type TopicRowDraft,
} from "@/components/onboarding/topics-prompts-table"
import { UnlockingOverlay } from "@/components/onboarding/unlocking-overlay"

type WizardCompetitor = {
  id: string
  name: string
  website: string
}

type WizardPromptDraft = OnboardingPromptDraft & {
  id: string
}

type WizardTopicDraft = Omit<OnboardingTopicDraft, "prompts"> & {
  id: string
  prompts: WizardPromptDraft[]
}

type OnboardingWizardProps = {
  brand: BrandWithCompetitors | null
  refreshAuthState: () => Promise<unknown>
}

type StepKey = 1 | 2 | 3 | 4

type ValidationState = {
  competitors: Array<{ name?: string; website?: string }>
  description?: string
  step1CompanyName?: string
  step1Website?: string
  topicPromptErrors: Record<string, string | undefined>
}

const ANALYSIS_INITIAL_POLL_INTERVAL_MS = 1600
const ANALYSIS_MAX_POLL_INTERVAL_MS = 5000

const promptVariantOrder: ReadonlyArray<
  NonNullable<OnboardingPromptDraft["variantType"]>
> = [
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
]

const stepMeta = [
  {
    key: 1 as const,
    label: "Brand basics",
    heading: "Let's set up your brand",
    subtitle: "Tell us the site we're going to track.",
  },
  {
    key: 2 as const,
    label: "Description",
    heading: "Describe what you do",
    subtitle: "Help us capture your business in one short paragraph.",
  },
  {
    key: 3 as const,
    label: "Competitors",
    heading: "Add your competitors",
    subtitle: "List the companies you want to benchmark against.",
  },
  {
    key: 4 as const,
    label: "Topics & prompts",
    heading: "Choose topics and prompts",
    subtitle: "Review the suggestions or add the ones you want to track.",
  },
] as const

const sidebarSteps: readonly SidebarStep[] = stepMeta.map((step) => ({
  key: step.key,
  label: step.label,
}))

let competitorSequence = 0
let topicSequence = 0
let promptSequence = 0

function createCompetitorRow(
  competitor?: Partial<WizardCompetitor>
): WizardCompetitor {
  competitorSequence += 1

  return {
    id: competitor?.id ?? `competitor-row-${competitorSequence}`,
    name: competitor?.name ?? "",
    website: competitor?.website ?? "",
  }
}

function getInitialStep(brand: BrandWithCompetitors | null): StepKey {
  if (!brand?.website.trim() || !brand.company_name.trim()) {
    return 1
  }

  if (!brand.description.trim()) {
    return 2
  }

  if (brand.competitors.length < 3) {
    return 3
  }

  if (brand.topics.length < 3) {
    return 4
  }

  return 4
}

function getInitialCompetitors(brand: BrandWithCompetitors | null) {
  const seeded = brand?.competitors.length
    ? brand.competitors.map((competitor) =>
        createCompetitorRow({
          id: competitor.id,
          name: competitor.name,
          website: competitor.website,
        })
      )
    : []

  while (seeded.length < 3) {
    seeded.push(createCompetitorRow())
  }

  return seeded
}

function buildCompetitorRows(
  competitors: Array<{ name: string; website: string }>
) {
  const rows = competitors.map((competitor) =>
    createCompetitorRow({
      name: competitor.name,
      website: competitor.website,
    })
  )

  while (rows.length < 3) {
    rows.push(createCompetitorRow())
  }

  return rows
}

function createPromptDraft(
  prompt?: Partial<WizardPromptDraft>
): WizardPromptDraft {
  promptSequence += 1

  return {
    addedVia: prompt?.addedVia ?? "user_created",
    generationMetadata: prompt?.generationMetadata,
    id: prompt?.id ?? `prompt-row-${promptSequence}`,
    intent: prompt?.intent,
    pqsRank: prompt?.pqsRank,
    pqsScore: prompt?.pqsScore,
    promptText: prompt?.promptText ?? "",
    scoreMetadata: prompt?.scoreMetadata ?? {},
    scoreStatus:
      prompt?.scoreStatus ?? (prompt?.pqsScore ? "scored" : "unscored"),
    sourceAnalysisRunId: prompt?.sourceAnalysisRunId,
    templateText: prompt?.templateText,
    variantType: prompt?.variantType,
  }
}

function createTopicDraft(
  topic?: Partial<Omit<WizardTopicDraft, "prompts">> & {
    prompts?: Array<Partial<WizardPromptDraft>>
  }
): WizardTopicDraft {
  topicSequence += 1

  return {
    clusterId: topic?.clusterId,
    id: topic?.id ?? `topic-row-${topicSequence}`,
    intentSummary: topic?.intentSummary,
    prompts: topic?.prompts?.map((prompt) => createPromptDraft(prompt)) ?? [],
    source: topic?.source ?? "user_added",
    sourceUrls: topic?.sourceUrls ?? [],
    topicDescription: topic?.topicDescription ?? "",
    topicId: topic?.topicId,
    topicName: topic?.topicName ?? "",
  }
}

function buildTopicDrafts(
  topics: string[],
  source: WizardTopicDraft["source"] = "user_added"
) {
  return normalizeBrandTopics(topics).map((topicName) =>
    createTopicDraft({
      source,
      topicName,
    })
  )
}

function buildGeneratedTopicDrafts(topics: OnboardingTopicDraft[]) {
  return topics.map((topic) =>
    createTopicDraft({
      clusterId: topic.clusterId,
      intentSummary: topic.intentSummary,
      prompts: topic.prompts,
      source: topic.source,
      sourceUrls: topic.sourceUrls,
      topicDescription: topic.topicDescription,
      topicId: topic.topicId,
      topicName: topic.topicName,
    })
  )
}

function normalizeTopicKey(value: string) {
  return normalizeBrandTopics([value])[0] ?? value.trim().toLowerCase()
}

function normalizePromptKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

function dedupePromptDrafts(prompts: WizardPromptDraft[]) {
  const seen = new Set<string>()

  return prompts.filter((prompt) => {
    const key = normalizePromptKey(prompt.promptText)

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function mergeTopicPrompts(
  currentTopic: WizardTopicDraft,
  refreshedTopic?: WizardTopicDraft
) {
  if (!refreshedTopic) {
    return sortPromptDrafts(currentTopic.prompts)
  }

  return sortPromptDrafts(
    dedupePromptDrafts([
      ...refreshedTopic.prompts.map((prompt) =>
        createPromptDraft({
          ...prompt,
        })
      ),
      ...currentTopic.prompts.filter((prompt) => prompt.addedVia === "user_created"),
    ])
  )
}

function mergeTopicDraftCollections(
  currentTopics: WizardTopicDraft[],
  refreshedTopics: WizardTopicDraft[]
) {
  const refreshedByKey = new Map(
    refreshedTopics.map((topic) => [normalizeTopicKey(topic.topicName), topic])
  )
  const merged = currentTopics.flatMap((currentTopic) => {
    const key = normalizeTopicKey(currentTopic.topicName)
    const refreshedTopic = refreshedByKey.get(key)

    if (currentTopic.source === "user_added") {
      refreshedByKey.delete(key)

      return [
        sortTopicDraft({
          ...(refreshedTopic ?? currentTopic),
          id: currentTopic.id,
          prompts: mergeTopicPrompts(currentTopic, refreshedTopic),
          source: "user_added",
          topicName: currentTopic.topicName,
        }),
      ]
    }

    if (refreshedTopic) {
      refreshedByKey.delete(key)

      return [
        sortTopicDraft({
          ...refreshedTopic,
          id: currentTopic.id,
          prompts: mergeTopicPrompts(currentTopic, refreshedTopic),
        }),
      ]
    }

    const customPrompts = currentTopic.prompts.filter(
      (prompt) => prompt.addedVia === "user_created"
    )

    if (customPrompts.length === 0) {
      return []
    }

    return [
      sortTopicDraft({
        ...currentTopic,
        prompts: sortPromptDrafts(customPrompts),
      }),
    ]
  })

  return [
    ...merged,
    ...Array.from(refreshedByKey.values()).map((topic) =>
      sortTopicDraft(topic)
    ),
  ]
}

function getPromptStatusRank(prompt: WizardPromptDraft) {
  switch (prompt.scoreStatus) {
    case "scored":
      return 0
    case "stale":
      return 1
    case "unscored":
    default:
      return 2
  }
}

function getPromptVariantRank(prompt: WizardPromptDraft) {
  if (!prompt.variantType) {
    return promptVariantOrder.length
  }

  const index = promptVariantOrder.indexOf(prompt.variantType)

  return index >= 0 ? index : promptVariantOrder.length
}

function sortPromptDrafts(prompts: WizardPromptDraft[]) {
  return [...prompts].sort((left, right) => {
    const statusDifference =
      getPromptStatusRank(left) - getPromptStatusRank(right)

    if (statusDifference !== 0) {
      return statusDifference
    }

    const scoreDifference = (right.pqsScore ?? -1) - (left.pqsScore ?? -1)

    if (scoreDifference !== 0) {
      return scoreDifference
    }

    const variantDifference = getPromptVariantRank(left) - getPromptVariantRank(right)

    if (variantDifference !== 0) {
      return variantDifference
    }

    const lengthDifference = left.promptText.length - right.promptText.length

    if (lengthDifference !== 0) {
      return lengthDifference
    }

    return left.promptText.localeCompare(right.promptText)
  })
}

function sortTopicDraft(topic: WizardTopicDraft): WizardTopicDraft {
  return {
    ...topic,
    prompts: sortPromptDrafts(topic.prompts),
  }
}

function formatWarnings(warnings: string[]) {
  const deduped = [...new Set(warnings.map((warning) => warning.trim()).filter(Boolean))]

  return deduped.length > 0 ? deduped.join(" ") : null
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function hasPopulatedCompetitorRows(rows: WizardCompetitor[]) {
  return rows.some(
    (competitor) => competitor.name.trim() || competitor.website.trim()
  )
}

function getInitialState(brand: BrandWithCompetitors | null) {
  return {
    projectId: brand?.id ?? null,
    companyName: brand?.company_name ?? "",
    competitors: getInitialCompetitors(brand),
    currentStep: getInitialStep(brand),
    description: brand?.description ?? "",
    topicInput: "",
    topics: buildTopicDrafts(brand?.topics ?? []),
    website: brand?.website ?? "",
  }
}

function isValidWebsite(value: string) {
  return !getWebsiteValidationError(value)
}

export function OnboardingWizard({
  brand,
  refreshAuthState,
}: OnboardingWizardProps) {
  const router = useRouter()
  const client = React.useMemo(() => getInsforgeBrowserClient(), [])
  const [projectId, setProjectId] = React.useState<string | null>(
    () => brand?.id ?? null
  )
  const [companyName, setCompanyName] = React.useState(
    () => brand?.company_name ?? ""
  )
  const [website, setWebsite] = React.useState(() => brand?.website ?? "")
  const [description, setDescription] = React.useState(
    () => brand?.description ?? ""
  )
  const [catalog, setCatalog] = React.useState<OnboardingCatalog | null>(null)
  const [topics, setTopics] = React.useState<WizardTopicDraft[]>(() =>
    buildTopicDrafts(brand?.topics ?? [])
  )
  const [topicInput, setTopicInput] = React.useState("")
  const [competitors, setCompetitors] = React.useState<WizardCompetitor[]>(() =>
    getInitialCompetitors(brand)
  )
  const [analysisId, setAnalysisId] = React.useState<string | null>(null)
  const [analysisState, setAnalysisState] = React.useState<AnalysisStatus>("idle")
  const [analysisPhase, setAnalysisPhase] = React.useState<string | null>(null)
  const [, startAnalysisTransition] = React.useTransition()
  const [currentStep, setCurrentStep] = React.useState<StepKey>(() =>
    getInitialStep(brand)
  )
  const [validation, setValidation] = React.useState<ValidationState>({
    competitors: [],
    topicPromptErrors: {},
  })
  const [isSaving, setIsSaving] = React.useState(false)
  const [isGeneratingTopicPrompts, setIsGeneratingTopicPrompts] =
    React.useState(false)
  const [, startCatalogRefreshTransition] = React.useTransition()
  const [isCompletingSetup, setIsCompletingSetup] = React.useState(false)
  const [excludedTopicNames, setExcludedTopicNames] = React.useState<string[]>([])
  const [excludedPromptTexts, setExcludedPromptTexts] = React.useState<string[]>([])
  const [topicSearch, setTopicSearch] = React.useState("")
  const deferredTopicSearch = React.useDeferredValue(topicSearch)
  const [intentFilter, setIntentFilter] = React.useState<
    NonNullable<WizardPromptDraft["intent"]> | "all"
  >("all")
  const deferredIntentFilter = React.useDeferredValue(intentFilter)
  const [sourceFilter, setSourceFilter] = React.useState<
    WizardTopicDraft["source"] | "all"
  >("all")
  const deferredSourceFilter = React.useDeferredValue(sourceFilter)
  const [openTopicIds, setOpenTopicIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>()
  )
  const [editingTopicId, setEditingTopicId] = React.useState<string | null>(null)
  const [topicEditValue, setTopicEditValue] = React.useState("")
  const [editingCompetitorIds, setEditingCompetitorIds] = React.useState<
    ReadonlySet<string>
  >(() => new Set<string>())
  const didSeedEditingRef = React.useRef(false)
  const analysisPollCountRef = React.useRef(0)
  const analysisPollingStartedAtRef = React.useRef<number | null>(null)

  if (!didSeedEditingRef.current) {
    didSeedEditingRef.current = true
    const initial = new Set<string>()
    for (const row of competitors) {
      if (!row.name.trim() && !row.website.trim()) {
        initial.add(row.id)
      }
    }
    if (initial.size > 0) {
      setEditingCompetitorIds(initial)
    }
  }
  const [promptDialog, setPromptDialog] = React.useState<
    | {
        topicId: string
        topicName: string
        mode: "add" | "edit"
        promptId?: string
        initialValue?: string
      }
    | null
  >(null)
  const [confirmRemove, setConfirmRemove] = React.useState<
    | {
        kind: "topic" | "competitor" | "prompt"
        label: string
        onConfirm: () => void
      }
    | null
  >(null)

  React.useEffect(() => {
    if (!brand) {
      return
    }

    const initialState = getInitialState(brand)

    setProjectId(initialState.projectId)
    setCompanyName((current) => current || initialState.companyName)
    setWebsite((current) => current || initialState.website)
    setDescription((current) =>
      current.trim() || !initialState.description.trim()
        ? current
        : initialState.description
    )
    setTopics((current) =>
      current.length > 0 || initialState.topics.length === 0
        ? current
        : initialState.topics
    )
    setCompetitors((current) =>
      hasPopulatedCompetitorRows(current) ||
      !hasPopulatedCompetitorRows(initialState.competitors)
        ? current
        : initialState.competitors
    )
    setCurrentStep((current) =>
      current > initialState.currentStep ? current : initialState.currentStep
    )
  }, [brand])

  function resetAnalysisProgress() {
    analysisPollCountRef.current = 0
    analysisPollingStartedAtRef.current = null
    setAnalysisId(null)
    setAnalysisPhase(null)
    setAnalysisState("idle")
  }

  const applyAnalysisResult = React.useCallback(
    (result: OnboardingAnalysisResult) => {
      const nextWarnings = [...result.warnings]

      if (result.topics.length === 0) {
        nextWarnings.push(
          "The analysis could not load any topics. Review this step manually."
        )
      }

      if (result.competitors.length === 0) {
        nextWarnings.push(
          "The analysis could not load any competitors. Review this step manually."
        )
      }

      console.log("[onboarding] Applying generated suggestions to wizard", {
        catalogTopicCount: result.catalog.topics.length,
        competitorCount: result.competitors.length,
        descriptionLength: result.description.length,
        topics: result.topics.map((topic) => topic.topicName),
        warnings: result.warnings,
      })

      startAnalysisTransition(() => {
        setCatalog(result.catalog)
        setDescription(result.description)
        setTopics(buildGeneratedTopicDrafts(result.topics).map(sortTopicDraft))
        setExcludedPromptTexts([])
        setExcludedTopicNames([])
        const nextCompetitors = buildCompetitorRows(result.competitors)
        setCompetitors(nextCompetitors)
        setEditingCompetitorIds(
          new Set(
            nextCompetitors
              .filter((row) => !row.name.trim() && !row.website.trim())
              .map((row) => row.id)
          )
        )
        setOpenTopicIds(new Set<string>())
        const warningMessage = formatWarnings(nextWarnings)
        if (warningMessage) {
          toast.warning("Analysis finished with warnings", {
            description: warningMessage,
          })
        }
        setAnalysisState("completed")
        setAnalysisPhase("completed")
        setCurrentStep(2)
      })
    },
    [startAnalysisTransition]
  )

  const ensureAnalysisRunId = React.useCallback(async () => {
    if (analysisId) {
      return analysisId
    }

    if (!projectId) {
      throw new Error("Project ID is required before generating prompts.")
    }

    const started = await startOnboardingAnalysis({
      companyName,
      projectId,
      website,
    })

    setAnalysisId(started.analysisId)
    setAnalysisPhase(started.status)

    return started.analysisId
  }, [analysisId, companyName, projectId, website])

  React.useEffect(() => {
    if (analysisState !== "polling" || !analysisId) {
      return
    }

    if (analysisPollingStartedAtRef.current === null) {
      analysisPollingStartedAtRef.current = Date.now()
    }

    let isCancelled = false
    let timeoutId: number | null = null

    const schedulePoll = (delayMs: number) => {
      timeoutId = window.setTimeout(async () => {
        if (isCancelled) {
          return
        }

        let shouldScheduleNextPoll = false

        try {
          analysisPollCountRef.current += 1

          const result = await pollOnboardingAnalysis(analysisId)

          if (isCancelled) {
            return
          }

          setAnalysisPhase(result.status)

          if (result.status === "completed" && result.result) {
            applyAnalysisResult(result.result)
            return
          }

          if (result.status === "completed" && !result.result) {
            setAnalysisState("failed")
            setAnalysisPhase("failed")
            toast.error("Analysis completed without usable results", {
              description: "Continue manually from the next step.",
            })
            return
          }

          if (result.status === "failed") {
            setAnalysisState("failed")
            setAnalysisPhase("failed")
            toast.error("We could not analyze the site", {
              description:
                formatWarnings(result.warnings) ??
                "Continue manually from the next step.",
            })
            return
          }

          shouldScheduleNextPoll = true
        } catch (error) {
          if (isCancelled) {
            return
          }

          setAnalysisState("failed")
          setAnalysisPhase("failed")
          toast.error("We could not analyze the site", {
            description:
              error instanceof Error
                ? error.message
                : "Continue manually from the next step.",
          })
        }

        if (!isCancelled && shouldScheduleNextPoll) {
          schedulePoll(
            delayMs <= 0
              ? ANALYSIS_INITIAL_POLL_INTERVAL_MS
              : Math.min(
                  Math.round(delayMs * 1.25),
                  ANALYSIS_MAX_POLL_INTERVAL_MS
                )
          )
        }
      }, delayMs)
    }

    schedulePoll(0)

    return () => {
      isCancelled = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [analysisId, analysisState, applyAnalysisResult])

  function clearValidation() {
    setValidation({
      competitors: [],
      topicPromptErrors: {},
    })
  }

  function addTopicFromInput() {
    const candidate = topicInput.trim()

    if (!candidate) {
      return
    }

    const normalizedTopics = normalizeBrandTopics([
      ...topics.map((topic) => topic.topicName),
      candidate,
    ])

    if (topics.length >= 12) {
      toast.error("Topic limit reached", {
        description: "You can add up to 12 topics.",
      })
      return
    }

    if (normalizedTopics.length === topics.length) {
      toast.error("That topic is already added.")
      return
    }

    if (normalizedTopics.length > 12) {
      toast.error("Topic limit reached", {
        description: "You can add up to 12 topics.",
      })
      return
    }

    const topicName = normalizedTopics.at(-1)

    if (!topicName) {
      return
    }

    const nextTopic = createTopicDraft({
      source: "user_added",
      topicName,
    })

    setTopics((current) => [...current, nextTopic])
    setExcludedTopicNames((current) =>
      current.filter((value) => normalizeTopicKey(value) !== topicName)
    )
    setTopicInput("")
  }

  function removeTopicById(topicId: string) {
    const topic = topics.find((value) => value.id === topicId)

    if (topic) {
      setExcludedTopicNames((current) =>
        uniqueStrings([...current, topic.topicName])
      )
    }

    setTopics((current) => current.filter((value) => value.id !== topicId))
    setValidation((current) => {
      const nextErrors = { ...current.topicPromptErrors }
      delete nextErrors[topicId]
      return { ...current, topicPromptErrors: nextErrors }
    })
  }

  function commitTopicEdit(topicId: string) {
    const candidate = topicEditValue.trim()
    const topic = topics.find((item) => item.id === topicId)
    if (!topic) return

    if (!candidate) {
      toast.error("Topic cannot be empty.")
      return
    }

    const otherTopics = topics
      .filter((item) => item.id !== topicId)
      .map((item) => item.topicName)
    const normalized = normalizeBrandTopics([...otherTopics, candidate])
    const nextName = normalized.at(-1)

    if (!nextName) {
      toast.error("That topic is invalid.")
      return
    }

    if (normalized.length === otherTopics.length) {
      toast.error("That topic is already added.")
      return
    }

    if (topic.source === "ai_suggested" && normalizeTopicKey(topic.topicName) !== nextName) {
      setExcludedTopicNames((current) =>
        uniqueStrings([...current, topic.topicName])
      )
    }

    setTopics((current) =>
      current.map((item) =>
        item.id === topicId
          ? {
              ...item,
              source: "user_added",
              topicName: nextName,
            }
          : item
      )
    )
    setEditingTopicId(null)
    setTopicEditValue("")
  }

  function updateCompetitor(
    id: string,
    key: "name" | "website",
    value: string
  ) {
    setCompetitors((current) =>
      current.map((competitor) =>
        competitor.id === id
          ? {
              ...competitor,
              [key]: value,
            }
          : competitor
      )
    )
  }

  function setCompetitorEditing(id: string, editing: boolean) {
    setEditingCompetitorIds((current) => {
      const next = new Set(current)
      if (editing) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  function addCompetitorRow() {
    setCompetitors((current) => {
      if (current.length >= 20) {
        toast.error("Competitor limit reached", {
          description: "You can add up to 20 competitors.",
        })

        return current
      }

      const next = createCompetitorRow()
      setCompetitorEditing(next.id, true)
      return [...current, next]
    })
  }

  function removeCompetitorRow(id: string) {
    setCompetitors((current) =>
      current.length === 1
        ? current
        : current.filter((competitor) => competitor.id !== id)
    )
    setCompetitorEditing(id, false)
  }

  function validateStepOne() {
    const nextValidation: ValidationState = {
      competitors: [],
      topicPromptErrors: {},
    }

    if (!website.trim()) {
      nextValidation.step1Website = "Enter your company website"
    } else if (!isValidWebsite(website)) {
      nextValidation.step1Website = "Enter a valid website"
    }

    if (!companyName.trim()) {
      nextValidation.step1CompanyName = "Enter your company name"
    } else {
      const companyNameError = getCompanyNameValidationError(companyName)

      if (companyNameError) {
        nextValidation.step1CompanyName = companyNameError
      }
    }

    setValidation(nextValidation)

    return !nextValidation.step1CompanyName && !nextValidation.step1Website
  }

  function validateStepTwo() {
    const trimmed = description.trim()

    if (!trimmed) {
      setValidation({
        competitors: [],
        description: "Tell us about your business",
        topicPromptErrors: {},
      })

      return false
    }

    if (trimmed.length > 500) {
      setValidation({
        competitors: [],
        description: "Keep the description under 500 characters",
        topicPromptErrors: {},
      })

      return false
    }

    clearValidation()

    return true
  }

  function validateStepThree() {
    return validateCompetitorStep()
  }

  function validateCompetitorStep() {
    const populatedCompetitors = competitors.filter(
      (competitor) => competitor.name.trim() || competitor.website.trim()
    )

    if (populatedCompetitors.length < 3) {
      toast.error("Add at least 3 competitors.")
      return false
    }

    if (populatedCompetitors.length > 20) {
      toast.error("You can add up to 20 competitors.")
      return false
    }

    const competitorErrors = competitors.map((competitor) => {
      if (!competitor.name.trim() && !competitor.website.trim()) {
        return {}
      }

      const nextError: { name?: string; website?: string } = {}

      if (!competitor.name.trim()) {
        nextError.name = "Enter a competitor name"
      }

      if (!competitor.website.trim()) {
        nextError.website = "Enter a competitor website"
      } else {
        const websiteError = getWebsiteValidationError(competitor.website)

        if (websiteError) {
          nextError.website = websiteError
        }
      }

      return nextError
    })

    const hasErrors = competitorErrors.some((error) =>
      Boolean(error.name || error.website)
    )

    if (hasErrors) {
      setValidation({
        competitors: competitorErrors,
        topicPromptErrors: {},
      })
      toast.error("Fix the competitor rows before continuing.")

      return false
    }

    clearValidation()

    return true
  }

  function validateStepFour() {
    if (topics.length < 3) {
      toast.error("Add at least 3 topics.")
      return false
    }

    const nextTopicPromptErrors: Record<string, string | undefined> = {}

    for (const topic of topics) {
      const activePrompts = topic.prompts
        .map((prompt) => ({
          ...prompt,
          promptText: prompt.promptText.trim(),
        }))
        .filter((prompt) => prompt.promptText.length > 0)

      const uniquePromptCount = new Set(
        activePrompts.map((prompt) => prompt.promptText.toLowerCase())
      ).size

      if (activePrompts.length < 2) {
        nextTopicPromptErrors[topic.id] =
          "Add at least 2 prompts for this topic."
        continue
      }

      if (uniquePromptCount !== activePrompts.length) {
        nextTopicPromptErrors[topic.id] =
          "Remove duplicate prompts for this topic."
      }
    }

    if (Object.keys(nextTopicPromptErrors).length > 0) {
      setValidation((current) => ({
        ...current,
        topicPromptErrors: nextTopicPromptErrors,
      }))
      toast.error("Fix the topic prompts before continuing.")

      return false
    }

    setValidation((current) => ({
      ...current,
      topicPromptErrors: {},
    }))

    return true
  }

  const refreshCatalog = React.useCallback(async () => {
    setIsGeneratingTopicPrompts(true)

    try {
      const populatedCompetitors = competitors
        .filter(
          (competitor) =>
            competitor.name.trim() || competitor.website.trim()
        )
        .map((competitor) => ({
          name: competitor.name.trim(),
          website: competitor.website.trim(),
        }))
      const activeAnalysisId = await ensureAnalysisRunId()

      const result = await fetchOnboardingTopicPrompts({
        analysisRunId: activeAnalysisId,
        companyName,
        competitors: populatedCompetitors,
        description,
        excludedPromptTexts,
        excludedTopicNames,
        mode: "full_refresh",
        topics: topics.map((topic) => ({
          clusterId: topic.clusterId,
          intentSummary: topic.intentSummary,
          source: topic.source,
          sourceUrls: topic.sourceUrls,
          topicDescription: topic.topicDescription,
          topicName: topic.topicName,
        })),
        website,
      })

      startCatalogRefreshTransition(() => {
        setCatalog(result.catalog)
        setTopics((current) =>
          mergeTopicDraftCollections(current, buildGeneratedTopicDrafts(result.topics))
        )
        setOpenTopicIds(new Set<string>())
        const warningMessage = formatWarnings(result.warnings)
        if (warningMessage) {
          toast.warning("Catalog refresh warning", {
            description: warningMessage,
          })
        }
      })
    } catch (error) {
      toast.error("Unable to refresh the GEO catalog", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsGeneratingTopicPrompts(false)
    }
  }, [
    companyName,
    competitors,
    description,
    ensureAnalysisRunId,
    excludedPromptTexts,
    excludedTopicNames,
    startCatalogRefreshTransition,
    topics,
    website,
  ])

  function savePromptFromDialog(value: string) {
    if (!promptDialog) return
    const { topicId, mode, promptId } = promptDialog
    const normalizedValue = normalizePromptKey(value)

    if (mode === "add") {
      setTopics((current) =>
        current.map((topic) =>
          topic.id === topicId
            ? sortTopicDraft({
                ...topic,
                prompts: [
                  ...topic.prompts,
                  createPromptDraft({
                    addedVia: "user_created",
                    promptText: value,
                    scoreStatus: "unscored",
                  }),
                ],
              })
            : topic
        )
      )
    } else if (promptId) {
      setTopics((current) =>
        current.map((topic) =>
          topic.id === topicId
            ? sortTopicDraft({
                ...topic,
                prompts: topic.prompts.map((prompt) =>
                  prompt.id === promptId
                    ? {
                        ...prompt,
                        addedVia: "user_created",
                        pqsRank: undefined,
                        pqsScore: undefined,
                        promptText: value,
                        scoreStatus: "stale",
                        templateText: undefined,
                      }
                    : prompt
                ),
              })
            : topic
        )
      )
    }

    setExcludedPromptTexts((current) =>
      current.filter((promptText) => normalizePromptKey(promptText) !== normalizedValue)
    )
    setValidation((current) => ({
      ...current,
      topicPromptErrors: {
        ...current.topicPromptErrors,
        [topicId]: undefined,
      },
    }))
  }

  function removePromptFromTopic(topicId: string, promptId: string) {
    const topic = topics.find((item) => item.id === topicId)
    const prompt = topic?.prompts.find((item) => item.id === promptId)

    if (prompt?.promptText.trim()) {
      setExcludedPromptTexts((current) =>
        uniqueStrings([...current, prompt.promptText])
      )
    }

    setTopics((current) =>
      current.map((topic) =>
        topic.id === topicId
          ? sortTopicDraft({
              ...topic,
              prompts: topic.prompts.filter(
                (prompt) => prompt.id !== promptId
              ),
            })
          : topic
      )
    )
  }

  async function handleNext() {
    if (isSaving || analysisState === "starting" || analysisState === "polling") {
      return
    }

    if (currentStep === 1 && analysisState === "completed") {
      clearValidation()
      setCurrentStep(2)
      return
    }

    if (currentStep === 1 && analysisState === "failed") {
      clearValidation()
      setCurrentStep(2)
      return
    }

    if (currentStep === 1 && !validateStepOne()) {
      return
    }

    if (currentStep === 2 && !validateStepTwo()) {
      return
    }

    if (currentStep === 3 && !validateStepThree()) {
      return
    }

    setIsSaving(true)

    try {
      if (currentStep === 1) {
        const nextBrand = await saveBrandDraftStep(client, {
          company_name: companyName,
          website,
        })

        setProjectId(nextBrand.id)
        analysisPollCountRef.current = 0
        analysisPollingStartedAtRef.current = Date.now()
        setAnalysisState("starting")
        setAnalysisPhase("scraping")

        try {
          const started = await startOnboardingAnalysis({
            companyName,
            projectId: nextBrand.id,
            website,
          })

          setAnalysisId(started.analysisId)
          setAnalysisPhase(started.status)
          setAnalysisState(
            started.status === "completed" ? "completed" : "polling"
          )
          const warningMessage = formatWarnings(started.warnings)
          if (warningMessage) {
            toast.warning("Analysis warning", {
              description: warningMessage,
            })
          }
        } catch (error) {
          setAnalysisState("failed")
          setAnalysisPhase("failed")
          toast.error("We could not analyze the site", {
            description:
              error instanceof Error
                ? error.message
                : "Continue manually from the next step.",
          })
        }

        return
      }

      if (currentStep === 2) {
        await saveBrandDraftStep(client, {
          description,
        })

        setCurrentStep(3)
      }

      if (currentStep === 3) {
        setCurrentStep(4)
      }
    } catch (error) {
      toast.error("Unable to save this step", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleComplete() {
    if (isSaving || !projectId) {
      return
    }

    if (!validateStepOne()) {
      setCurrentStep(1)
      return
    }

    if (!validateStepTwo()) {
      setCurrentStep(2)
      return
    }

    if (!validateStepThree()) {
      setCurrentStep(3)
      return
    }

    if (!validateStepFour()) {
      setCurrentStep(4)
      return
    }

    setIsSaving(true)
    setIsCompletingSetup(true)

    try {
      const populatedCompetitors = competitors
        .filter(
          (competitor) => competitor.name.trim() || competitor.website.trim()
        )
        .map((competitor) => ({
          name: competitor.name.trim(),
          website: competitor.website.trim(),
        }))

      await completeOnboarding({
        companyName,
        competitors: populatedCompetitors,
        description,
        projectId,
        topics: topics.map((topic) => ({
          clusterId: topic.clusterId,
          intentSummary: topic.intentSummary,
          prompts: topic.prompts.map((prompt) => ({
            addedVia: prompt.addedVia,
            generationMetadata: prompt.generationMetadata,
            intent: prompt.intent,
            pqsRank: prompt.pqsRank,
            pqsScore: prompt.pqsScore,
            promptText: prompt.promptText,
            scoreMetadata: prompt.scoreMetadata,
            scoreStatus: prompt.scoreStatus,
            sourceAnalysisRunId: prompt.sourceAnalysisRunId,
            templateText: prompt.templateText,
            variantType: prompt.variantType,
          })),
          source: topic.source,
          sourceUrls: topic.sourceUrls,
          topicDescription: topic.topicDescription,
          topicName: topic.topicName,
        })),
        website,
      })
      await refreshAuthState()
      router.replace("/dashboard")
    } catch (error) {
      toast.error("Unable to complete setup", {
        description:
          error instanceof Error
            ? error.message
            : "Please try again in a moment.",
      })
      setIsCompletingSetup(false)
    } finally {
      setIsSaving(false)
    }
  }

  const currentMeta = stepMeta[currentStep - 1]
  const descriptionLength = description.length
  const completedSteps = React.useMemo(() => {
    const set = new Set<number>()
    for (let i = 1; i < currentStep; i += 1) {
      set.add(i)
    }
    return set
  }, [currentStep])
  const visibleTopics = React.useMemo(() => {
    const normalizedSearch = deferredTopicSearch.trim().toLowerCase()

    return topics.flatMap((topic) => {
      if (
        deferredSourceFilter !== "all" &&
        topic.source !== deferredSourceFilter
      ) {
        return []
      }

      const topicMatchesSearch =
        !normalizedSearch ||
        [topic.topicName, topic.topicDescription, topic.intentSummary ?? ""].some(
          (value) => value?.toLowerCase().includes(normalizedSearch)
        )

      const prompts = topic.prompts.filter((prompt) => {
        if (deferredIntentFilter !== "all" && prompt.intent !== deferredIntentFilter) {
          return false
        }

        if (!normalizedSearch) {
          return true
        }

        return (
          topicMatchesSearch ||
          prompt.promptText.toLowerCase().includes(normalizedSearch)
        )
      })

      if (!topicMatchesSearch && prompts.length === 0) {
        return []
      }

      return [
        {
          ...topic,
          prompts:
            normalizedSearch && topicMatchesSearch && deferredIntentFilter === "all"
              ? topic.prompts
              : prompts,
        },
      ]
    })
  }, [deferredIntentFilter, deferredSourceFilter, deferredTopicSearch, topics])

  const primaryLabel =
    currentStep === 1 && analysisState === "failed"
      ? "Continue manually"
      : currentStep === 4
        ? "Complete setup"
        : "Continue"
  const primaryLoadingLabel =
    currentStep === 1 &&
    (analysisState === "starting" || analysisState === "polling")
      ? "Analyzing your site…"
      : currentStep === 4 && isGeneratingTopicPrompts
        ? "Refreshing catalog…"
        : currentStep === 4
          ? "Completing setup…"
          : "Saving…"

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <OnboardingSidebar
        steps={sidebarSteps}
        currentStep={currentStep}
        completedSteps={completedSteps}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10 md:px-10 md:py-14">
          <header className="mb-8 space-y-2">
            <h1 className="font-serif text-3xl leading-tight md:text-4xl">
              {currentMeta.heading}
            </h1>
            <p className="text-base text-muted-foreground">
              {currentMeta.subtitle}
            </p>
          </header>

          <div
            key={currentStep}
            className="flex-1 duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
          >
            {currentStep === 1 ? (
              <FieldGroup>
                <Field data-invalid={Boolean(validation.step1Website)}>
                  <FieldLabel htmlFor="company-website">
                    Company website
                  </FieldLabel>
                  <Input
                    id="company-website"
                    placeholder="example.com"
                    value={website}
                    onChange={(event) => {
                      if (currentStep === 1) {
                        resetAnalysisProgress()
                      }
                      setWebsite(event.target.value)
                      setValidation((current) => ({
                        ...current,
                        step1Website: undefined,
                      }))
                    }}
                    aria-invalid={Boolean(validation.step1Website)}
                  />
                  <BrandPreview website={website} name={companyName} />
                  {validation.step1Website ? (
                    <FieldDescription className="text-destructive">
                      {validation.step1Website}
                    </FieldDescription>
                  ) : (
                    <FieldDescription>
                      We will use this as the source of truth for the brand
                      profile.
                    </FieldDescription>
                  )}
                </Field>
                <Field data-invalid={Boolean(validation.step1CompanyName)}>
                  <FieldLabel htmlFor="company-name">Company name</FieldLabel>
                  <Input
                    id="company-name"
                    placeholder="Acme"
                    value={companyName}
                    onChange={(event) => {
                      if (currentStep === 1) {
                        resetAnalysisProgress()
                      }
                      setCompanyName(event.target.value)
                      setValidation((current) => ({
                        ...current,
                        step1CompanyName: undefined,
                      }))
                    }}
                    aria-invalid={Boolean(validation.step1CompanyName)}
                  />
                  {validation.step1CompanyName ? (
                    <FieldDescription className="text-destructive">
                      {validation.step1CompanyName}
                    </FieldDescription>
                  ) : null}
                </Field>

                {analysisState !== "idle" ? (
                  <AnalysisTimeline
                    status={analysisState}
                    phase={analysisPhase}
                  />
                ) : null}
              </FieldGroup>
            ) : null}

            {currentStep === 2 ? (
              <FieldGroup>
                <Field data-invalid={Boolean(validation.description)}>
                  <div className="flex items-center justify-between gap-4">
                    <FieldLabel htmlFor="business-description">
                      Business description
                    </FieldLabel>
                    <span className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                      {descriptionLength}/500
                    </span>
                  </div>
                  <Textarea
                    id="business-description"
                    value={description}
                    maxLength={500}
                    rows={6}
                    onChange={(event) => {
                      setDescription(event.target.value)
                      setValidation((current) => ({
                        ...current,
                        description: undefined,
                      }))
                    }}
                    aria-invalid={Boolean(validation.description)}
                  />
                  {validation.description ? (
                    <FieldDescription className="text-destructive">
                      {validation.description}
                    </FieldDescription>
                  ) : (
                    <FieldDescription>
                      500 characters max. Keep it specific and customer-facing.
                    </FieldDescription>
                  )}
                </Field>
              </FieldGroup>
            ) : null}

            {currentStep === 3 ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Add at least 3 competitors. You can track up to 20.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCompetitorRow}
                    disabled={isSaving || competitors.length >= 20}
                  >
                    <HugeiconsIcon icon={Add01Icon} className="size-4" />
                    Add competitor
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  {competitors.map((competitor, index) => {
                    const rowErrors = validation.competitors[index] ?? {}
                    const isEditing = editingCompetitorIds.has(competitor.id)
                    const hasContent =
                      competitor.name.trim() || competitor.website.trim()

                    return (
                      <div
                        key={competitor.id}
                        className="rounded-lg border border-border bg-card"
                      >
                        {isEditing ? (
                          <div className="space-y-3 p-4">
                            <FieldGroup>
                              <Field data-invalid={Boolean(rowErrors.name)}>
                                <FieldLabel
                                  htmlFor={`competitor-name-${competitor.id}`}
                                >
                                  Competitor name
                                </FieldLabel>
                                <Input
                                  id={`competitor-name-${competitor.id}`}
                                  value={competitor.name}
                                  onChange={(event) =>
                                    updateCompetitor(
                                      competitor.id,
                                      "name",
                                      event.target.value
                                    )
                                  }
                                  aria-invalid={Boolean(rowErrors.name)}
                                />
                                {rowErrors.name ? (
                                  <FieldDescription className="text-destructive">
                                    {rowErrors.name}
                                  </FieldDescription>
                                ) : null}
                              </Field>
                              <Field data-invalid={Boolean(rowErrors.website)}>
                                <FieldLabel
                                  htmlFor={`competitor-website-${competitor.id}`}
                                >
                                  Competitor website
                                </FieldLabel>
                                <Input
                                  id={`competitor-website-${competitor.id}`}
                                  value={competitor.website}
                                  onChange={(event) =>
                                    updateCompetitor(
                                      competitor.id,
                                      "website",
                                      event.target.value
                                    )
                                  }
                                  aria-invalid={Boolean(rowErrors.website)}
                                />
                                <BrandPreview
                                  website={competitor.website}
                                  name={competitor.name}
                                />
                                {rowErrors.website ? (
                                  <FieldDescription className="text-destructive">
                                    {rowErrors.website}
                                  </FieldDescription>
                                ) : null}
                              </Field>
                            </FieldGroup>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    competitors.length > 1 &&
                                    !hasContent
                                  ) {
                                    removeCompetitorRow(competitor.id)
                                  } else {
                                    setCompetitorEditing(competitor.id, false)
                                  }
                                }}
                              >
                                {hasContent ? "Done" : "Cancel"}
                              </Button>
                              {hasContent ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() =>
                                    setCompetitorEditing(competitor.id, false)
                                  }
                                >
                                  <HugeiconsIcon
                                    icon={Tick02Icon}
                                    className="size-4"
                                  />
                                  Save
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="flex min-w-0 flex-1 items-center">
                              <BrandPreview
                                className="flex-1 border-0 bg-transparent px-0 py-0"
                                website={competitor.website}
                                name={competitor.name}
                              />
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit competitor ${index + 1}`}
                                onClick={() =>
                                  setCompetitorEditing(competitor.id, true)
                                }
                              >
                                <HugeiconsIcon
                                  icon={Edit02Icon}
                                  className="size-4"
                                />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove competitor ${index + 1}`}
                                disabled={
                                  isSaving || competitors.length === 1
                                }
                                onClick={() =>
                                  setConfirmRemove({
                                    kind: "competitor",
                                    label:
                                      competitor.name || "this competitor",
                                    onConfirm: () =>
                                      removeCompetitorRow(competitor.id),
                                  })
                                }
                              >
                                <HugeiconsIcon
                                  icon={Delete02Icon}
                                  className="size-4"
                                />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

              </div>
            ) : null}

            {currentStep === 4 ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">
                        Add a topic
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Minimum 3, maximum 12. Each topic needs at least 2
                        prompts.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void refreshCatalog()}
                      disabled={isSaving || isGeneratingTopicPrompts}
                    >
                      <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                      Refresh catalog
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="topic-input"
                      value={topicInput}
                      placeholder="AI search"
                      onChange={(event) => setTopicInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          addTopicFromInput()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addTopicFromInput}
                      disabled={isSaving || isGeneratingTopicPrompts}
                    >
                      <HugeiconsIcon icon={Add01Icon} className="size-4" />
                      Add topic
                    </Button>
                  </div>
                </div>

                <TopicsPromptsTable
                  topics={visibleTopics as TopicRowDraft[]}
                  search={topicSearch}
                  onSearchChange={setTopicSearch}
                  intentFilter={intentFilter}
                  onIntentFilterChange={(value) => setIntentFilter(value)}
                  sourceFilter={sourceFilter}
                  onSourceFilterChange={(value) => setSourceFilter(value)}
                  openTopicIds={openTopicIds}
                  onToggleTopic={(topicId, open) =>
                    setOpenTopicIds((current) => {
                      const next = new Set(current)
                      if (open) {
                        next.add(topicId)
                      } else {
                        next.delete(topicId)
                      }
                      return next
                    })
                  }
                  editingTopicId={editingTopicId}
                  topicEditValue={topicEditValue}
                  onTopicEditChange={setTopicEditValue}
                  onStartEditTopic={(topic) => {
                    setEditingTopicId(topic.id)
                    setTopicEditValue(topic.topicName)
                  }}
                  onCommitEditTopic={(topicId) => commitTopicEdit(topicId)}
                  onCancelEditTopic={() => {
                    setEditingTopicId(null)
                    setTopicEditValue("")
                  }}
                  onRemoveTopic={(topic) =>
                    setConfirmRemove({
                      kind: "topic",
                      label: topic.topicName,
                      onConfirm: () => removeTopicById(topic.id),
                    })
                  }
                  onAddPrompt={(topic) =>
                    setPromptDialog({
                      mode: "add",
                      topicId: topic.id,
                      topicName: topic.topicName,
                    })
                  }
                  onEditPrompt={(topic, prompt) =>
                    setPromptDialog({
                      mode: "edit",
                      topicId: topic.id,
                      topicName: topic.topicName,
                      promptId: prompt.id,
                      initialValue: prompt.promptText,
                    })
                  }
                  onRemovePrompt={(topic, prompt, index) =>
                    setConfirmRemove({
                      kind: "prompt",
                      label: `prompt ${index + 1}`,
                      onConfirm: () =>
                        removePromptFromTopic(topic.id, prompt.id),
                    })
                  }
                  topicPromptErrors={validation.topicPromptErrors}
                  totalTopicCount={topics.length}
                  catalogTopicCount={catalog?.topics.length}
                  isRefreshing={isGeneratingTopicPrompts}
                />
              </div>
            ) : null}
          </div>
        </div>

        <footer className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/70">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-6 py-4 md:px-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (currentStep > 1) {
                  clearValidation()
                  setCurrentStep((current) => (current - 1) as StepKey)
                }
              }}
              disabled={isSaving || currentStep === 1}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                void (currentStep === 4 ? handleComplete() : handleNext())
              }}
              disabled={
                isSaving ||
                isGeneratingTopicPrompts ||
                analysisState === "starting" ||
                analysisState === "polling"
              }
              className={cn("min-w-44", "justify-center")}
            >
              {isSaving ||
              isGeneratingTopicPrompts ||
              analysisState === "starting" ||
              analysisState === "polling" ? (
                <>
                  <Spinner className={cn("size-4", "text-primary-foreground")} />
                  {primaryLoadingLabel}
                </>
              ) : (
                <>
                  {primaryLabel}
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4"
                  />
                </>
              )}
            </Button>
          </div>
        </footer>
      </main>

      <PromptEditDialog
        open={Boolean(promptDialog)}
        onOpenChange={(open) => {
          if (!open) setPromptDialog(null)
        }}
        mode={promptDialog?.mode ?? "add"}
        topicName={promptDialog?.topicName ?? ""}
        initialValue={promptDialog?.initialValue}
        onSubmit={savePromptFromDialog}
      />

      <AlertDialog
        open={Boolean(confirmRemove)}
        onOpenChange={(open) => {
          if (!open) setConfirmRemove(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmRemove?.kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{confirmRemove?.label}&quot; will be removed. You can add it
              back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                confirmRemove?.onConfirm()
                setConfirmRemove(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnlockingOverlay open={isCompletingSetup} />
    </div>
  )
}
