import type { InsForgeClient } from "@insforge/sdk"

import {
  getWebsiteHost,
  normalizeBrandDraftStep,
  normalizeBrandNameKey,
  normalizeCompanyName,
  normalizeCompetitors,
  normalizeDescription,
  normalizeWebsite,
} from "@/lib/brands/normalizers"
import { syncProjectTopics } from "@/lib/project-topics/repository"
import type {
  Brand,
  BrandCompetitor,
  BrandCompetitorInput,
  BrandDraftStepInput,
  BrandEntity,
  BrandWithCompetitors,
  ProjectProfile,
  ProjectTopic,
  TrackingProject,
} from "@/lib/brands/types"

type BrandClient = Pick<InsForgeClient, "auth" | "database">

function takeSingleRow<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

async function getCurrentUserId(client: BrandClient) {
  const { data, error } = await client.auth.getCurrentUser()

  if (error || !data?.user?.id) {
    return null
  }

  return data.user.id
}

async function loadProjectRecord(client: BrandClient, userId: string) {
  const response = await client.database
    .from("tracking_projects")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (!response) {
    throw new Error("Unable to load project details.")
  }

  if (response.error) {
    throw new Error(response.error.message ?? "Unable to load project details.")
  }

  return takeSingleRow(response.data as TrackingProject | TrackingProject[] | null)
}

async function loadBrandEntities(client: BrandClient, projectId: string) {
  const response = await client.database
    .from("brand_entities")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })

  if (!response) {
    throw new Error("Unable to load project brands.")
  }

  if (response.error) {
    throw new Error(response.error.message ?? "Unable to load project brands.")
  }

  return takeRows(response.data as BrandEntity[] | BrandEntity | null)
}

async function loadProjectTopics(client: BrandClient, projectId: string) {
  const response = await client.database
    .from("project_topics")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })

  if (!response) {
    throw new Error("Unable to load project topics.")
  }

  if (response.error) {
    throw new Error(response.error.message ?? "Unable to load project topics.")
  }

  return takeRows(response.data as ProjectTopic[] | ProjectTopic | null)
}

function buildProjectProfile(
  project: TrackingProject,
  brandEntities: BrandEntity[],
  topics: ProjectTopic[]
): ProjectProfile {
  const primaryBrand =
    brandEntities.find((brandEntity) => brandEntity.role === "primary") ?? null

  return {
    competitors: brandEntities.filter(
      (brandEntity) => brandEntity.role === "competitor"
    ),
    primaryBrand,
    project,
    topics,
  }
}

function toOnboardingBrand(profile: ProjectProfile): BrandWithCompetitors {
  const primaryBrand = profile.primaryBrand

  return {
    company_name: primaryBrand?.name ?? "",
    competitors: profile.competitors.map((competitor) => ({
      brand_id: profile.project.id,
      created_at: competitor.created_at,
      id: competitor.id,
      name: competitor.name,
      updated_at: competitor.updated_at,
      user_id: profile.project.user_id,
      website: competitor.website_url,
    })),
    created_at: profile.project.created_at,
    description: primaryBrand?.description ?? "",
    id: profile.project.id,
    onboarding_completed_at: profile.project.onboarding_completed_at,
    topics: profile.topics.map((topic) => topic.name),
    updated_at: profile.project.updated_at,
    user_id: profile.project.user_id,
    website: primaryBrand?.website_url ?? "",
  }
}

async function createTrackingProject(
  client: BrandClient,
  userId: string
): Promise<TrackingProject> {
  const response = await client.database
    .from("tracking_projects")
    .insert([
      {
        onboarding_completed_at: null,
        onboarding_status: "draft",
        reporting_timezone: "UTC",
        user_id: userId,
      },
    ])
    .select("*")
    .maybeSingle()

  if (!response || response.error || !response.data) {
    throw response?.error ?? new Error("Unable to create tracking project.")
  }

  const project = takeSingleRow(response.data as TrackingProject | TrackingProject[] | null)

  if (!project) {
    throw new Error("Unable to create tracking project.")
  }

  return project
}

async function insertPrimaryBrandEntity(
  client: BrandClient,
  projectId: string,
  input: { company_name: string; website: string }
) {
  const companyName = normalizeCompanyName(input.company_name)
  const website = normalizeWebsite(input.website)

  const response = await client.database
    .from("brand_entities")
    .insert([
      {
        description: "",
        is_active: true,
        name: companyName,
        normalized_name: normalizeBrandNameKey(companyName),
        project_id: projectId,
        role: "primary",
        sort_order: 0,
        website_host: getWebsiteHost(website),
        website_url: website,
      },
    ])
    .select("*")
    .maybeSingle()

  if (!response || response.error || !response.data) {
    throw response?.error ?? new Error("Unable to create primary brand.")
  }

  const brandEntity = takeSingleRow(response.data as BrandEntity | BrandEntity[] | null)

  if (!brandEntity) {
    throw new Error("Unable to create primary brand.")
  }

  return brandEntity
}

async function updateBrandEntity(
  client: BrandClient,
  brandEntityId: string,
  values: Partial<Pick<BrandEntity, "description" | "name" | "normalized_name" | "website_host" | "website_url">>
) {
  const response = await client.database
    .from("brand_entities")
    .update(values)
    .eq("id", brandEntityId)
    .select("*")
    .maybeSingle()

  if (!response || response.error || !response.data) {
    throw response?.error ?? new Error("Unable to update brand details.")
  }

  const brandEntity = takeSingleRow(response.data as BrandEntity | BrandEntity[] | null)

  if (!brandEntity) {
    throw new Error("Unable to update brand details.")
  }

  return brandEntity
}

export async function loadCurrentUserProjectProfile(
  client: BrandClient
): Promise<ProjectProfile | null> {
  const userId = await getCurrentUserId(client)

  if (!userId) {
    return null
  }

  const project = await loadProjectRecord(client, userId)

  if (!project) {
    return null
  }

  const [brandEntities, topics] = await Promise.all([
    loadBrandEntities(client, project.id),
    loadProjectTopics(client, project.id),
  ])

  return buildProjectProfile(project, brandEntities, topics)
}

export async function loadCurrentUserBrand(
  client: BrandClient
): Promise<BrandWithCompetitors | null> {
  const profile = await loadCurrentUserProjectProfile(client)

  if (!profile) {
    return null
  }

  return toOnboardingBrand(profile)
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
  let project = await loadProjectRecord(client, userId)

  if (!project) {
    const companyName = "company_name" in patch ? patch.company_name : undefined
    const website = "website" in patch ? patch.website : undefined

    if (typeof companyName !== "string" || typeof website !== "string") {
      throw new Error("Company name and website are required before saving.")
    }

    project = await createTrackingProject(client, userId)
    const primaryBrand = await insertPrimaryBrandEntity(client, project.id, {
      company_name: companyName,
      website,
    })

    return toOnboardingBrand({
      competitors: [],
      primaryBrand,
      project,
      topics: [],
    })
  }

  const brandEntities = await loadBrandEntities(client, project.id)
  const primaryBrand =
    brandEntities.find((brandEntity) => brandEntity.role === "primary") ?? null

  let nextPrimaryBrand = primaryBrand
  let nextTopics: ProjectTopic[] | null = null

  if (
    typeof patch.company_name === "string" &&
    typeof patch.website === "string"
  ) {
    if (!nextPrimaryBrand) {
      nextPrimaryBrand = await insertPrimaryBrandEntity(client, project.id, {
        company_name: patch.company_name,
        website: patch.website,
      })
    } else {
      nextPrimaryBrand = await updateBrandEntity(client, nextPrimaryBrand.id, {
        name: normalizeCompanyName(patch.company_name),
        normalized_name: normalizeBrandNameKey(patch.company_name),
        website_host: getWebsiteHost(patch.website),
        website_url: normalizeWebsite(patch.website),
      })
    }
  }

  if (typeof patch.description === "string") {
    if (!nextPrimaryBrand) {
      throw new Error("Brand basics are required before saving.")
    }

    nextPrimaryBrand = await updateBrandEntity(client, nextPrimaryBrand.id, {
      description: normalizeDescription(patch.description),
    })
  }

  if (Array.isArray(patch.topics)) {
    nextTopics = await syncProjectTopics(client, {
      defaultCadence: "weekly",
      projectId: project.id,
      topics: patch.topics.map((topic) => ({
        source: "user_added",
        topicName: topic,
      })),
    })
  }

  if (!nextTopics) {
    nextTopics = await loadProjectTopics(client, project.id)
  }

  return toOnboardingBrand({
    competitors: brandEntities.filter(
      (brandEntity) => brandEntity.role === "competitor"
    ),
    primaryBrand: nextPrimaryBrand,
    project,
    topics: nextTopics,
  })
}

export async function replaceBrandCompetitors(
  client: BrandClient,
  projectId: string,
  competitors: BrandCompetitorInput[]
): Promise<BrandCompetitor[]> {
  const userId = await getCurrentUserId(client)

  if (!userId) {
    throw new Error("You must be signed in to update competitors.")
  }

  await client.database
    .from("brand_entities")
    .delete()
    .eq("project_id", projectId)
    .eq("role", "competitor")

  const normalizedCompetitors = normalizeCompetitors(competitors)

  if (!normalizedCompetitors.length) {
    return []
  }

  const response = await client.database
    .from("brand_entities")
    .insert(
      normalizedCompetitors.map((competitor, index) => ({
        description: "",
        is_active: true,
        name: competitor.name,
        normalized_name: normalizeBrandNameKey(competitor.name),
        project_id: projectId,
        role: "competitor",
        sort_order: index,
        website_host: getWebsiteHost(competitor.website),
        website_url: competitor.website,
      }))
    )
    .select("*")

  if (!response || response.error || !response.data) {
    throw response?.error ?? new Error("Unable to replace competitors.")
  }

  return takeRows(response.data as BrandEntity[] | BrandEntity | null).map(
    (competitor) => ({
      brand_id: projectId,
      created_at: competitor.created_at,
      id: competitor.id,
      name: competitor.name,
      updated_at: competitor.updated_at,
      user_id: userId,
      website: competitor.website_url,
    })
  )
}

export async function markOnboardingComplete(
  client: BrandClient,
  projectId: string
): Promise<Brand> {
  const userId = await getCurrentUserId(client)

  if (!userId) {
    throw new Error("You must be signed in to complete onboarding.")
  }

  const completedAt = new Date().toISOString()

  const response = await client.database
    .from("tracking_projects")
    .update({
      onboarding_completed_at: completedAt,
      onboarding_status: "complete",
    })
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle()

  if (!response || response.error || !response.data) {
    throw response?.error ?? new Error("Unable to mark onboarding as complete.")
  }

  const project = takeSingleRow(response.data as TrackingProject | TrackingProject[] | null)

  if (!project) {
    throw new Error("Unable to mark onboarding as complete.")
  }

  const [brandEntities, topics] = await Promise.all([
    loadBrandEntities(client, project.id).catch(() => []),
    loadProjectTopics(client, project.id).catch(() => []),
  ])

  return toOnboardingBrand(
    buildProjectProfile(project, brandEntities, topics)
  )
}

export function isProjectOnboardingComplete(profile: ProjectProfile) {
  return Boolean(
    profile.project.onboarding_completed_at &&
      profile.primaryBrand?.name.trim() &&
      profile.primaryBrand.website_url.trim() &&
      profile.primaryBrand.description.trim() &&
      profile.topics.length >= 3 &&
      profile.competitors.length >= 3
  )
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
