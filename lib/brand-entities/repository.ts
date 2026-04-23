import type { InsForgeClient } from "@insforge/sdk"

import type { BrandEntity } from "@/lib/brand-entities/types"

type BrandEntityClient = Pick<InsForgeClient, "database">

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

export async function loadBrandEntitiesByProject(
  client: BrandEntityClient,
  projectId: string
): Promise<BrandEntity[]> {
  const response = await client.database
    .from("brand_entities")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("role", { ascending: true })
    .order("sort_order", { ascending: true })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load brand entities.")
  }

  return takeRows(response.data as BrandEntity[] | BrandEntity | null)
}
