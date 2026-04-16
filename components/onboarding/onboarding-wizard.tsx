"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

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
  fetchOnboardingBrandSuggestions,
  fetchOnboardingTopicPrompts,
} from "@/lib/onboarding/client"
import type {
  OnboardingPromptDraft,
  OnboardingTopicDraft,
} from "@/lib/onboarding/types"
import { cn } from "@/lib/utils"
import { BrandPreview } from "@/components/brands/brand-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

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

const stepMeta = [
  {
    description: "Company name and website",
    key: 1 as const,
    label: "Brand basics",
  },
  {
    description: "What your business does",
    key: 2 as const,
    label: "Description",
  },
  {
    description: "Where you want to show up",
    key: 3 as const,
    label: "Competitors",
  },
  {
    description: "Topics and prompts to track",
    key: 4 as const,
    label: "Topics & prompts",
  },
] as const

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
    promptText: prompt?.promptText ?? "",
  }
}

function createTopicDraft(topic?: Partial<WizardTopicDraft>): WizardTopicDraft {
  topicSequence += 1

  return {
    id: topic?.id ?? `topic-row-${topicSequence}`,
    prompts: topic?.prompts?.map((prompt) => createPromptDraft(prompt)) ?? [],
    source: topic?.source ?? "user_added",
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
  const [isPrefillingStepOne, setIsPrefillingStepOne] = React.useState(false)
  const [prefillNotice, setPrefillNotice] = React.useState<string | null>(null)
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

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

  function removeTopic(topic: string) {
    setTopics((current) => current.filter((value) => value.topicName !== topic))
    setValidation((current) => {
      const nextErrors = { ...current.topicPromptErrors }
      const removedTopic = topics.find((value) => value.topicName === topic)

      if (removedTopic) {
        delete nextErrors[removedTopic.id]
      }

      return {
        ...current,
        topicPromptErrors: nextErrors,
      }
    })
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

  function addCompetitorRow() {
    setCompetitors((current) => {
      if (current.length >= 20) {
        setValidation((previous) => ({
          ...previous,
          step4: "You can add up to 20 competitors.",
        }))

        return current
      }

      return [...current, createCompetitorRow()]
    })
  }

  function removeCompetitorRow(id: string) {
    setCompetitors((current) =>
      current.length === 1
        ? current
        : current.filter((competitor) => competitor.id !== id)
    )
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
        nextTopicPromptErrors[topic.id] = "Add at least 2 prompts for this topic."
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
      setSaveMessage("Generating topic prompts...")

      try {
        const populatedCompetitors = competitors
          .filter(
            (competitor) => competitor.name.trim() || competitor.website.trim()
          )
          .map((competitor) => ({
            name: competitor.name.trim(),
            website: competitor.website.trim(),
          }))

        const result = await fetchOnboardingTopicPrompts({
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

            return {
              ...topic,
              prompts: generatedTopic.prompts.map((prompt) =>
                createPromptDraft({
                  addedVia: prompt.addedVia,
                  promptText: prompt.promptText,
                })
              ),
            }
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
        setSaveMessage(null)
      }
    },
    [companyName, competitors, description, website]
  )

  React.useEffect(() => {
    if (currentStep !== 4 || isGeneratingTopicPrompts || isSaving) {
      return
    }

    const missingPrompts = topics.filter((topic) => topic.prompts.length === 0)
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

  function updateTopicPrompt(topicId: string, promptId: string, value: string) {
    setTopics((current) =>
      current.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              prompts: topic.prompts.map((prompt) =>
                prompt.id === promptId
                  ? {
                      ...prompt,
                      promptText: value,
                    }
                  : prompt
              ),
            }
          : topic
      )
    )
    setValidation((current) => ({
      ...current,
      step4: undefined,
      topicPromptErrors: {
        ...current.topicPromptErrors,
        [topicId]: undefined,
      },
    }))
  }

  function addPromptToTopic(topicId: string) {
    setTopics((current) =>
      current.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              prompts: [
                ...topic.prompts,
                createPromptDraft({
                  addedVia: "user_created",
                }),
              ],
            }
          : topic
      )
    )
  }

  function removePromptFromTopic(topicId: string, promptId: string) {
    setTopics((current) =>
      current.map((topic) =>
        topic.id === topicId
          ? {
              ...topic,
              prompts: topic.prompts.filter((prompt) => prompt.id !== promptId),
            }
          : topic
      )
    )
  }

  async function handleNext() {
    if (isSaving) {
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
    if (currentStep === 1) {
      setPrefillNotice(null)
    }
    setSaveMessage(
      currentStep === 1 ? "Saving your brand basics..." : `Saving step ${currentStep}...`
    )
    setSubmitError(null)

    try {
      if (currentStep === 1) {
        const nextBrand = await saveBrandDraftStep(client, {
          company_name: companyName,
          website,
        })

        setProjectId(nextBrand.id)
        setSaveMessage("Analyzing your homepage...")
        setIsPrefillingStepOne(true)

        try {
          const suggestion = await fetchOnboardingBrandSuggestions({
            companyName,
            website,
          })

          const nextWarnings = [...suggestion.warnings]

          if (suggestion.topics.length === 0) {
            nextWarnings.push(
              "The AI model could not load any topics. Review this step manually."
            )
          }

          if (suggestion.competitors.length === 0) {
            nextWarnings.push(
              "The AI model could not load any competitors. Review this step manually."
            )
          }

          console.log("[onboarding] Applying generated suggestions to wizard", {
            competitorCount: suggestion.competitors.length,
            descriptionLength: suggestion.description.length,
            topics: suggestion.topics,
            warnings: nextWarnings,
          })

          setDescription(suggestion.description)
          setTopics(buildTopicDrafts(suggestion.topics, "ai_suggested"))
          setCompetitors(buildCompetitorRows(suggestion.competitors))

          if (nextWarnings.length) {
            setPrefillNotice([...new Set(nextWarnings)].join(" "))
          }
        } catch (error) {
          setPrefillNotice(
            error instanceof Error
              ? error.message
              : "We could not prefill the next steps. Continue manually."
          )
        } finally {
          setIsPrefillingStepOne(false)
        }

        setCurrentStep(2)
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
      setSaveMessage(null)
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
    setSaveMessage("Finalizing your setup...")
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
          prompts: topic.prompts.map((prompt) => ({
            addedVia: prompt.addedVia,
            promptText: prompt.promptText,
          })),
          source: topic.source,
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
      setSaveMessage(null)
    }
  }

  const currentMeta = stepMeta[currentStep - 1]
  const descriptionLength = description.length
  const progressValue = (currentStep / stepMeta.length) * 100

  return (
    <div className="min-h-svh bg-muted/30">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-4 p-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <Card size="sm" className="gap-0 lg:sticky lg:top-4">
          <CardHeader className="gap-3 border-b bg-muted/30">
            <Badge variant="outline">Onboarding</Badge>
            <div className="space-y-1">
              <CardTitle className="text-base">
                Launch your brand profile
              </CardTitle>
              <CardDescription>
                Set up the signals Sitebench needs before we start tracking how
                your brand appears across AI search surfaces.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              {stepMeta.map((step) => {
                const isActive = step.key === currentStep
                const isComplete = step.key < currentStep

                return (
                  <div
                    key={step.key}
                    className={cn(
                      "border px-3 py-3 transition-colors",
                      isActive
                        ? "border-primary bg-muted"
                        : "border-border bg-background",
                      isComplete && "border-border bg-secondary/35"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{step.label}</div>
                      <Badge
                        variant={
                          isActive
                            ? "default"
                            : isComplete
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {isComplete
                          ? "Done"
                          : isActive
                            ? "Current"
                            : `Step ${step.key}`}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {step.description}
                    </div>
                  </div>
                )
              })}
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Progress
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentStep}/{stepMeta.length}
                </div>
              </div>
              <Progress
                aria-label="Onboarding progress"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={progressValue}
                value={progressValue}
              />
              <div className="text-xs text-muted-foreground">
                {currentMeta.description}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card size="sm">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Step {currentStep} of 4</Badge>
                <span className="text-xs text-muted-foreground">
                  {currentMeta.description}
                </span>
              </div>
              {saveMessage ? (
                <Badge variant="secondary">{saveMessage}</Badge>
              ) : null}
            </CardContent>
          </Card>

          {prefillNotice ? (
            <div
              role="status"
              className="border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
            >
              {prefillNotice}
            </div>
          ) : null}

          {submitError ? (
            <div
              role="alert"
              className="border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {submitError}
            </div>
          ) : null}

          <Card className="gap-0 py-0">
            <CardHeader className="border-b bg-muted/30 px-4 py-4">
              <CardTitle className="text-base">{currentMeta.label}</CardTitle>
              <CardDescription>
                {currentStep === 1
                  ? "Add the brand name and website you want us to track."
                  : currentStep === 2
                    ? "Review the suggested description or write your own concise version."
                    : currentStep === 3
                      ? "List the companies you want to benchmark against."
                      : "Review the suggested topics and prompts or add the ones you want to track."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 py-4">
              <div
                key={currentStep}
                className="duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
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
                      <FieldLabel htmlFor="company-name">
                        Company name
                      </FieldLabel>
                      <Input
                        id="company-name"
                        placeholder="Acme"
                        value={companyName}
                        onChange={(event) => {
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

                    {isPrefillingStepOne ? (
                      <div className="border border-dashed border-border bg-muted/30 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              Generating suggestions from your homepage
                            </div>
                            <div className="text-xs text-muted-foreground">
                              We&apos;re preparing a suggested description, topics,
                              and competitors for review.
                            </div>
                          </div>
                          <Badge variant="secondary">In progress</Badge>
                        </div>
                        <Progress
                          className="mt-4"
                          aria-label="Generating onboarding suggestions"
                          value={66}
                        />
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-28 w-full md:col-span-2" />
                        </div>
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
                          500 characters max. Keep it specific and
                          customer-facing.
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
                        Add competitor
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {competitors.map((competitor, index) => {
                        const rowErrors = validation.competitors[index] ?? {}

                        return (
                          <Card
                            key={competitor.id}
                            size="sm"
                            className="gap-0 py-0"
                          >
                            <CardHeader className="border-b bg-muted/20">
                              <div className="flex items-center justify-between gap-3">
                                <CardTitle>Competitor {index + 1}</CardTitle>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    removeCompetitorRow(competitor.id)
                                  }
                                  aria-label={`Remove competitor ${index + 1}`}
                                  disabled={
                                    isSaving || competitors.length === 1
                                  }
                                >
                                  Remove competitor
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="py-3">
                              <FieldGroup>
                                <Field data-invalid={Boolean(rowErrors.name)}>
                                  <FieldLabel
                                    htmlFor={`competitor-name-${competitor.id}`}
                                  >
                                    Competitor name {index + 1}
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
                                <Field
                                  data-invalid={Boolean(rowErrors.website)}
                                >
                                  <FieldLabel
                                    htmlFor={`competitor-website-${competitor.id}`}
                                  >
                                    Competitor website {index + 1}
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
                            </CardContent>
                          </Card>
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
                  <div className="flex flex-col gap-5">
                    <FieldGroup>
                      <Field data-invalid={Boolean(validation.topicInput)}>
                        <FieldLabel htmlFor="topic-input">
                          Add a topic
                        </FieldLabel>
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
                            Add topic
                          </Button>
                        </div>
                        {validation.topicInput ? (
                          <FieldDescription className="text-destructive">
                            {validation.topicInput}
                          </FieldDescription>
                        ) : (
                          <FieldDescription>
                            Press Enter to add each topic. Minimum 3, maximum
                            10. Each topic needs at least 2 prompts.
                          </FieldDescription>
                        )}
                      </Field>
                    </FieldGroup>

                    <div className="flex min-h-16 flex-wrap gap-2 border border-dashed border-border bg-muted/30 p-3">
                      {topics.length ? (
                        topics.map((topic) => (
                          <Badge key={topic.id} asChild variant="secondary">
                            <button
                              type="button"
                              onClick={() => removeTopic(topic.topicName)}
                              aria-label={`Remove topic ${topic.topicName}`}
                            >
                              <span>{topic.topicName}</span>
                              <span className="text-muted-foreground">x</span>
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No topics added yet.
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      {topics.map((topic, topicIndex) => (
                        <Card key={topic.id} size="sm" className="gap-0 py-0">
                          <CardHeader className="border-b bg-muted/20">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-sm">
                                  Topic {topicIndex + 1}: {topic.topicName}
                                </CardTitle>
                                <Badge variant="outline">
                                  {topic.source === "ai_suggested"
                                    ? "AI suggested"
                                    : "User added"}
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => addPromptToTopic(topic.id)}
                              >
                                Add prompt
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4 py-3">
                            {topic.prompts.map((prompt, promptIndex) => (
                              <Field
                                key={prompt.id}
                                data-invalid={Boolean(
                                  validation.topicPromptErrors[topic.id]
                                )}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <FieldLabel
                                    htmlFor={`topic-prompt-${topic.id}-${prompt.id}`}
                                  >
                                    Prompt {promptIndex + 1}
                                  </FieldLabel>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      removePromptFromTopic(topic.id, prompt.id)
                                    }
                                  >
                                    Remove prompt
                                  </Button>
                                </div>
                                <Textarea
                                  id={`topic-prompt-${topic.id}-${prompt.id}`}
                                  value={prompt.promptText}
                                  onChange={(event) =>
                                    updateTopicPrompt(
                                      topic.id,
                                      prompt.id,
                                      event.target.value
                                    )
                                  }
                                  aria-invalid={Boolean(
                                    validation.topicPromptErrors[topic.id]
                                  )}
                                  rows={3}
                                />
                              </Field>
                            ))}

                            {validation.topicPromptErrors[topic.id] ? (
                              <FieldDescription className="text-destructive">
                                {validation.topicPromptErrors[topic.id]}
                              </FieldDescription>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {validation.step4 ? (
                      <FieldDescription className="text-destructive">
                        {validation.step4}
                      </FieldDescription>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <Separator className="my-6" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void (currentStep === 4 ? handleComplete() : handleNext())
                  }}
                  disabled={isSaving || isGeneratingTopicPrompts}
                  className="sm:min-w-40"
                >
                  {isSaving || isGeneratingTopicPrompts
                    ? currentStep === 4
                      ? isGeneratingTopicPrompts
                        ? "Generating prompts..."
                        : "Completing setup..."
                      : "Saving and continuing..."
                    : currentStep === 4
                      ? "Complete setup"
                      : "Save and continue"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
