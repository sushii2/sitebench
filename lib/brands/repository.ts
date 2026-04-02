import type { InsForgeClient } from "@insforge/sdk"

import {
  normalizeBrandDraftStep,
  normalizeBrandTopics,
  normalizeCompanyName,
  normalizeCompetitors,
  normalizeDescription,
  normalizeWebsite,
} from "@/lib/brands/normalizers"
import type {
  Brand,
  BrandCompetitor,
  BrandCompetitorInput,
  BrandDraftStepInput,
  BrandWithCompetitors,
} from "@/lib/brands/types"

type BrandClient = Pick<InsForgeClient, "auth" | "database">

function takeSingleRow<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

async function getCurrentUserId(client: BrandClient) {
  const { data, error } = await client.auth.getCurrentUser()

  if (error || !data?.user?.id) {
    return null
  }

  return data.user.id
}

async function loadBrandRecord(client: BrandClient, userId: string) {
  const response = await client.database
    .from("brands")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (!response) {
    throw new Error("Unable to load brand details.")
  }

  if (response.error) {
    throw new Error(response.error.message ?? "Unable to load brand details.")
  }

  return takeSingleRow(response.data as Brand | Brand[] | null)
}

export async function loadCurrentUserBrand(
  client: BrandClient
): Promise<BrandWithCompetitors | null> {
  const userId = await getCurrentUserId(client)

  if (!userId) {
    return null
  }

  const brand = await loadBrandRecord(client, userId)

  if (!brand) {
    return null
  }

  const competitorResponse = await client.database
    .from("brand_competitors")
    .select("*")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: true })

  if (!competitorResponse) {
    throw new Error("Unable to load brand competitors.")
  }

  if (competitorResponse.error) {
    throw new Error(
      competitorResponse.error.message ?? "Unable to load brand competitors."
    )
  }

  return {
    ...brand,
    competitors: (competitorResponse.data ?? []) as unknown as BrandCompetitor[],
  }
}

export async function saveBrandDraftStep(
  client: BrandClient,
  input: BrandDraftStepInput
): Promise<Brand> {
  const userId = await getCurrentUserId(client)

  if (!userId) {
    throw new Error("You must be signed in to save brand details.")
  }

  const patch = normalizeBrandDraftStep(input)
  const existingBrand = await loadBrandRecord(client, userId)

  if (!existingBrand) {
    const companyName = "company_name" in patch ? patch.company_name : undefined
    const website = "website" in patch ? patch.website : undefined

    if (typeof companyName !== "string" || typeof website !== "string") {
      throw new Error("Company name and website are required before saving.")
    }

    const response = await client.database
      .from("brands")
      .insert([
        {
          company_name: normalizeCompanyName(companyName),
          description: "",
          onboarding_completed_at: null,
          topics: [],
          user_id: userId,
          website: normalizeWebsite(website),
        },
      ])
      .select("*")
      .maybeSingle()

    if (!response || response.error || !response.data) {
      throw response?.error ?? new Error("Unable to create brand draft.")
    }

    const createdBrand = takeSingleRow(response.data as Brand | Brand[] | null)

    if (!createdBrand) {
      throw new Error("Unable to create brand draft.")
    }

    return createdBrand
  }

  const updatePayload: Record<string, string | string[]> = {}

  if ("company_name" in patch && typeof patch.company_name === "string") {
    updatePayload.company_name = normalizeCompanyName(patch.company_name)
  }

  if ("website" in patch && typeof patch.website === "string") {
    updatePayload.website = normalizeWebsite(patch.website)
  }

  if ("description" in patch && typeof patch.description === "string") {
    updatePayload.description = normalizeDescription(patch.description)
  }

  if ("topics" in patch && Array.isArray(patch.topics)) {
    updatePayload.topics = normalizeBrandTopics(patch.topics)
  }

  const response = await client.database
    .from("brands")
    .update(updatePayload)
    .eq("id", existingBrand.id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle()

  if (!response || response.error || !response.data) {
    throw response?.error ?? new Error("Unable to update brand draft.")
  }

  const updatedBrand = takeSingleRow(response.data as Brand | Brand[] | null)

  if (!updatedBrand) {
    throw new Error("Unable to update brand draft.")
  }

  return updatedBrand
}

export async function replaceBrandCompetitors(
  client: BrandClient,
  brandId: string,
  competitors: BrandCompetitorInput[]
): Promise<BrandCompetitor[]> {
  const userId = await getCurrentUserId(client)

  if (!userId) {
    throw new Error("You must be signed in to update competitors.")
  }

  await client.database
    .from("brand_competitors")
    .delete()
    .eq("brand_id", brandId)
    .eq("user_id", userId)

  const normalizedCompetitors = normalizeCompetitors(competitors)

  if (!normalizedCompetitors.length) {
    return []
  }

  const response = await client.database
    .from("brand_competitors")
    .insert(
      normalizedCompetitors.map((competitor) => ({
        brand_id: brandId,
        name: competitor.name,
        user_id: userId,
        website: competitor.website,
      }))
    )
    .select("*")

  if (!response || response.error || !response.data) {
    throw response?.error ?? new Error("Unable to replace competitors.")
  }

  return response.data as unknown as BrandCompetitor[]
}

export async function markOnboardingComplete(
  client: BrandClient,
  brandId: string
): Promise<Brand> {
  const userId = await getCurrentUserId(client)

  if (!userId) {
    throw new Error("You must be signed in to complete onboarding.")
  }

  const completedAt = new Date().toISOString()

  const response = await client.database
    .from("brands")
    .update({
      onboarding_completed_at: completedAt,
    })
    .eq("id", brandId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle()

  if (!response || response.error || !response.data) {
    throw response?.error ?? new Error("Unable to mark onboarding as complete.")
  }

  const completedBrand = takeSingleRow(response.data as Brand | Brand[] | null)

  if (!completedBrand) {
    throw new Error("Unable to mark onboarding as complete.")
  }

  return completedBrand
}

export function isOnboardingComplete(brand: BrandWithCompetitors) {
  return Boolean(
    brand.onboarding_completed_at &&
      brand.company_name.trim() &&
      brand.website.trim() &&
      brand.description.trim() &&
      brand.topics.length >= 3 &&
      brand.competitors.length >= 3
  )
}
