"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit02Icon,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  OnboardingSidebar,
  type SidebarStep,
} from "@/components/onboarding/onboarding-sidebar"
import { PromptEditDialog } from "@/components/onboarding/prompt-edit-dialog"
import { ProviderLogos } from "@/components/onboarding/provider-logos"

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
  step3?: string
  step4?: string
  topicPromptErrors: Record<string, string | undefined>
  topicInput?: string
}

type AnalysisUiState = "idle" | "starting" | "polling" | "completed" | "failed"
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

const analysisPhaseLabel: Record<string, string> = {
  classifying: "Classifying the homepage",
  completed: "Analysis complete",
  competitors: "Scoring likely competitors",
  failed: "Analysis failed",
  mapping: "Mapping the website",
  planning: "Planning the critical pages",
  profiling: "Building the brand profile",
  prompting: "Generating topics and prompts",
  scraping: "Scraping selected pages",
}

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
    id: prompt?.id ?? `prompt-row-${promptSequence}`,
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
      topicId: topic.topicId,
      topicName: topic.topicName,
    })
  )
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
  const [topics, setTopics] = React.useState<WizardTopicDraft[]>(() =>
    buildTopicDrafts(brand?.topics ?? [])
  )
  const [topicInput, setTopicInput] = React.useState("")
  const [competitors, setCompetitors] = React.useState<WizardCompetitor[]>(() =>
    getInitialCompetitors(brand)
  )
  const [analysisId, setAnalysisId] = React.useState<string | null>(null)
  const [analysisState, setAnalysisState] = React.useState<AnalysisUiState>("idle")
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
  const [prefillNotice, setPrefillNotice] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
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
        competitorCount: result.competitors.length,
        descriptionLength: result.description.length,
        topics: result.topics.map((topic) => topic.topicName),
        warnings: result.warnings,
      })

      startAnalysisTransition(() => {
        setDescription(result.description)
        setTopics(buildGeneratedTopicDrafts(result.topics).map(sortTopicDraft))
        const nextCompetitors = buildCompetitorRows(result.competitors)
        setCompetitors(nextCompetitors)
        setEditingCompetitorIds(
          new Set(
            nextCompetitors
              .filter((row) => !row.name.trim() && !row.website.trim())
              .map((row) => row.id)
          )
        )
        setPrefillNotice(formatWarnings(nextWarnings))
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
            setPrefillNotice(
              "Analysis completed without usable results. Continue manually."
            )
            return
          }

          if (result.status === "failed") {
            setAnalysisState("failed")
            setAnalysisPhase("failed")
            setPrefillNotice(
              formatWarnings(result.warnings) ??
                "We could not analyze the site. Continue manually."
            )
            return
          }

          setPrefillNotice(formatWarnings(result.warnings))
          shouldScheduleNextPoll = true
        } catch (error) {
          if (isCancelled) {
            return
          }

          setAnalysisState("failed")
          setAnalysisPhase("failed")
          setPrefillNotice(
            error instanceof Error
              ? error.message
              : "We could not analyze the site. Continue manually."
          )
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

  function setTopicMessage(message?: string) {
    setValidation((current) => ({
      ...current,
      topicInput: message,
    }))
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

    if (topics.length >= 10) {
      setTopicMessage("You can add up to 10 topics.")
      return
    }

    if (normalizedTopics.length === topics.length) {
      setTopicMessage("That topic is already added.")
      return
    }

    if (normalizedTopics.length > 10) {
      setTopicMessage("You can add up to 10 topics.")
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
    setTopicInput("")
    setTopicMessage(undefined)
    setValidation((current) => ({
      ...current,
      step3: undefined,
      step4: undefined,
    }))

    if (currentStep === 4) {
      void generateTopicPrompts([nextTopic])
    }
  }

  function removeTopicById(topicId: string) {
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
      setTopicMessage("Topic cannot be empty.")
      return
    }

    const otherTopics = topics
      .filter((item) => item.id !== topicId)
      .map((item) => item.topicName)
    const normalized = normalizeBrandTopics([...otherTopics, candidate])
    const nextName = normalized.at(-1)

    if (!nextName) {
      setTopicMessage("That topic is invalid.")
      return
    }

    if (normalized.length === otherTopics.length) {
      setTopicMessage("That topic is already added.")
      return
    }

    setTopics((current) =>
      current.map((item) =>
        item.id === topicId ? { ...item, topicName: nextName } : item
      )
    )
    setEditingTopicId(null)
    setTopicEditValue("")
    setTopicMessage(undefined)
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
        setValidation((previous) => ({
          ...previous,
          step4: "You can add up to 20 competitors.",
        }))

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
      setValidation({
        competitors: [],
        step3: "Add at least 3 competitors.",
        topicPromptErrors: {},
      })

      return false
    }

    if (populatedCompetitors.length > 20) {
      setValidation({
        competitors: [],
        step3: "You can add up to 20 competitors.",
        topicPromptErrors: {},
      })

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
        step3: "Fix the competitor rows before continuing.",
        topicPromptErrors: {},
      })

      return false
    }

    clearValidation()

    return true
  }

  function validateStepFour() {
    if (topics.length < 3) {
      setValidation((current) => ({
        ...current,
        step4: "Add at least 3 topics.",
      }))

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
        step4: "Fix the topic prompts before continuing.",
        topicPromptErrors: nextTopicPromptErrors,
      }))

      return false
    }

    setValidation((current) => ({
      ...current,
      step4: undefined,
      topicPromptErrors: {},
    }))

    return true
  }

  const generateTopicPrompts = React.useCallback(
    async (topicsToGenerate: WizardTopicDraft[]) => {
      if (topicsToGenerate.length === 0) {
        return
      }

      setIsGeneratingTopicPrompts(true)
      setSubmitError(null)

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
          topics: topicsToGenerate.map((topic) => ({
            source: topic.source,
            topicName: topic.topicName,
          })),
          website,
        })

        setTopics((current) =>
          current.map((topic) => {
            const generatedTopic = result.topics.find(
              (candidate) => candidate.topicName === topic.topicName
            )

            if (!generatedTopic) {
              return topic
            }

            return sortTopicDraft({
              ...topic,
              clusterId: generatedTopic.clusterId,
              intentSummary: generatedTopic.intentSummary,
              prompts: generatedTopic.prompts.map((prompt) =>
                createPromptDraft(prompt)
              ),
              sourceUrls: generatedTopic.sourceUrls ?? topic.sourceUrls,
            })
          })
        )
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Unable to generate topic prompts."
        )
      } finally {
        setIsGeneratingTopicPrompts(false)
      }
    },
    [companyName, competitors, description, ensureAnalysisRunId, website]
  )

  React.useEffect(() => {
    if (currentStep !== 4 || isGeneratingTopicPrompts || isSaving) {
      return
    }

    const missingPrompts = topics.filter(
      (topic) => topic.prompts.length === 0
    )
    const hasEnoughCompetitors =
      competitors.filter(
        (competitor) => competitor.name.trim() || competitor.website.trim()
      ).length >= 3

    if (missingPrompts.length === 0 || !hasEnoughCompetitors) {
      return
    }

    void generateTopicPrompts(missingPrompts)
  }, [
    competitors,
    currentStep,
    generateTopicPrompts,
    isGeneratingTopicPrompts,
    isSaving,
    topics,
  ])

  function savePromptFromDialog(value: string) {
    if (!promptDialog) return
    const { topicId, mode, promptId } = promptDialog

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

    setValidation((current) => ({
      ...current,
      step4: undefined,
      topicPromptErrors: {
        ...current.topicPromptErrors,
        [topicId]: undefined,
      },
    }))
  }

  function removePromptFromTopic(topicId: string, promptId: string) {
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
    setSubmitError(null)

    try {
      if (currentStep === 1) {
        setPrefillNotice(null)
        const nextBrand = await saveBrandDraftStep(client, {
          company_name: companyName,
          website,
        })

        setProjectId(nextBrand.id)
        analysisPollCountRef.current = 0
        analysisPollingStartedAtRef.current = Date.now()
        setAnalysisState("starting")
        setAnalysisPhase("mapping")

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
          setPrefillNotice(formatWarnings(started.warnings))
        } catch (error) {
          setAnalysisState("failed")
          setAnalysisPhase("failed")
          setPrefillNotice(
            error instanceof Error
              ? error.message
              : "We could not analyze the site. Continue manually."
          )
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
        await generateTopicPrompts(
          topics.filter((topic) => topic.prompts.length === 0)
        )
        setCurrentStep(4)
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to save this step."
      )
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
    setSubmitError(null)

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
          topicName: topic.topicName,
        })),
        website,
      })
      await refreshAuthState()
      router.replace("/dashboard")
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to complete setup. Please try again."
      )
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
      : currentStep === 3 && isGeneratingTopicPrompts
        ? "Generating prompts…"
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

          {prefillNotice ? (
            <div
              role="status"
              className="mb-6 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
            >
              {prefillNotice}
            </div>
          ) : null}

          {submitError ? (
            <div
              role="alert"
              className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {submitError}
            </div>
          ) : null}

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
                        setPrefillNotice(null)
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
                        setPrefillNotice(null)
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
                  <div className="rounded-md border border-dashed border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-3">
                      {analysisState === "starting" ||
                      analysisState === "polling" ? (
                        <Spinner className="size-4" />
                      ) : (
                        <div className="size-2 rounded-full bg-amber-500" />
                      )}
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">
                          {analysisState === "failed"
                            ? "Website analysis needs manual review"
                            : analysisState === "completed"
                              ? "Website analysis is ready"
                              : "Analyzing your website context"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {analysisState === "failed"
                            ? "We could not finish the workflow-backed analysis. You can continue manually from the next step."
                            : analysisState === "completed"
                              ? "Your description, competitors, topics, and prompt variants are ready to review."
                              : analysisPhase
                                ? analysisPhaseLabel[analysisPhase] ??
                                  "Preparing suggested description, topics, competitors, and prompts."
                                : "Preparing suggested description, topics, competitors, and prompts."}
                        </div>
                      </div>
                    </div>
                    {analysisState === "starting" || analysisState === "polling" ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-28 w-full md:col-span-2" />
                      </div>
                    ) : null}
                  </div>
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

                {validation.step3 ? (
                  <FieldDescription className="text-destructive">
                    {validation.step3}
                  </FieldDescription>
                ) : null}
              </div>
            ) : null}

            {currentStep === 4 ? (
              <div className="flex flex-col gap-6">
                <Field data-invalid={Boolean(validation.topicInput)}>
                  <FieldLabel htmlFor="topic-input">Add a topic</FieldLabel>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      id="topic-input"
                      value={topicInput}
                      placeholder="AI search"
                      onChange={(event) => {
                        setTopicInput(event.target.value)
                        setTopicMessage(undefined)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          addTopicFromInput()
                        }
                      }}
                      aria-invalid={Boolean(validation.topicInput)}
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
                  {validation.topicInput ? (
                    <FieldDescription className="text-destructive">
                      {validation.topicInput}
                    </FieldDescription>
                  ) : (
                    <FieldDescription>
                      Minimum 3, maximum 10. Each topic needs at least 2
                      prompts.
                    </FieldDescription>
                  )}
                </Field>

                {isGeneratingTopicPrompts ? (
                  <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    Generating prompt suggestions…
                  </div>
                ) : null}

                <div className="flex flex-col gap-4">
                  {topics.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                      No topics yet. Add at least 3 to continue.
                    </div>
                  ) : null}

                  {topics.map((topic, topicIndex) => {
                    const isEditingTopic = editingTopicId === topic.id

                    return (
                      <div
                        key={topic.id}
                        className="rounded-lg border border-border bg-card"
                      >
                        <div className="flex items-center justify-between gap-3 rounded-t-lg border-b bg-muted/30 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                              Topic {topicIndex + 1}
                            </span>
                            {isEditingTopic ? (
                              <Input
                                autoFocus
                                value={topicEditValue}
                                onChange={(event) =>
                                  setTopicEditValue(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault()
                                    commitTopicEdit(topic.id)
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault()
                                    setEditingTopicId(null)
                                    setTopicEditValue("")
                                    setTopicMessage(undefined)
                                  }
                                }}
                                onBlur={() => commitTopicEdit(topic.id)}
                                className="h-8"
                              />
                            ) : (
                              <span className="truncate text-sm font-medium">
                                {topic.topicName}
                              </span>
                            )}
                            <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                              {topic.source === "ai_suggested"
                                ? "AI"
                                : "Custom"}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {isEditingTopic ? (
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Cancel topic edit"
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  setEditingTopicId(null)
                                  setTopicEditValue("")
                                  setTopicMessage(undefined)
                                }}
                              >
                                <HugeiconsIcon
                                  icon={Cancel01Icon}
                                  className="size-4"
                                />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Edit topic ${topic.topicName}`}
                                onClick={() => {
                                  setEditingTopicId(topic.id)
                                  setTopicEditValue(topic.topicName)
                                }}
                              >
                                <HugeiconsIcon
                                  icon={Edit02Icon}
                                  className="size-4"
                                />
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Remove topic ${topic.topicName}`}
                              onClick={() =>
                                setConfirmRemove({
                                  kind: "topic",
                                  label: topic.topicName,
                                  onConfirm: () => removeTopicById(topic.id),
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

                        <div className="flex flex-col gap-2 px-4 py-3">
                          {topic.prompts.length === 0 ? (
                            <div className="text-xs text-muted-foreground">
                              No prompts yet.
                            </div>
                          ) : (
                            topic.prompts.map((prompt, promptIndex) => (
                              <div
                                key={prompt.id}
                                className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background px-4 py-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 text-sm">
                                    <div className="mb-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                                      Prompt {promptIndex + 1}
                                    </div>
                                    <div className="line-clamp-2 text-foreground">
                                      {prompt.promptText || (
                                        <span className="text-muted-foreground italic">
                                          Empty prompt
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label={`Edit prompt ${promptIndex + 1}`}
                                      onClick={() =>
                                        setPromptDialog({
                                          mode: "edit",
                                          topicId: topic.id,
                                          topicName: topic.topicName,
                                          promptId: prompt.id,
                                          initialValue: prompt.promptText,
                                        })
                                      }
                                    >
                                      <HugeiconsIcon
                                        icon={Edit02Icon}
                                        className="size-4"
                                      />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label={`Remove prompt ${promptIndex + 1}`}
                                      onClick={() =>
                                        setConfirmRemove({
                                          kind: "prompt",
                                          label: `prompt ${promptIndex + 1}`,
                                          onConfirm: () =>
                                            removePromptFromTopic(
                                              topic.id,
                                              prompt.id
                                            ),
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
                                <ProviderLogos
                                  variant="compact"
                                  label="Evaluated by"
                                />
                              </div>
                            ))
                          )}

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="self-start"
                            onClick={() =>
                              setPromptDialog({
                                mode: "add",
                                topicId: topic.id,
                                topicName: topic.topicName,
                              })
                            }
                          >
                            <HugeiconsIcon
                              icon={Add01Icon}
                              className="size-4"
                            />
                            Add prompt
                          </Button>

                          {validation.topicPromptErrors[topic.id] ? (
                            <FieldDescription className="text-destructive">
                              {validation.topicPromptErrors[topic.id]}
                            </FieldDescription>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {validation.step4 ? (
                  <FieldDescription className="text-destructive">
                    {validation.step4}
                  </FieldDescription>
                ) : null}
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
    </div>
  )
}
