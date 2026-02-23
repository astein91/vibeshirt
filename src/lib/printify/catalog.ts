import { createServiceClient } from "@/lib/supabase/server";
import {
  getBlueprints,
  getBlueprint,
  getPrintProviders,
  getVariants,
  Blueprint,
  PrintProvider,
  Variant,
} from "./client";

// Cache expiration time (24 hours)
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// T-shirt blueprint IDs that we support
export const SUPPORTED_BLUEPRINT_IDS = [
  12, // Bella+Canvas 3001 - Unisex Jersey Short Sleeve Tee (most popular)
  6, // Gildan 5000 - Unisex Heavy Cotton Tee
  145, // Gildan 64000 - Unisex Softstyle T-Shirt
  5, // Next Level 3600 - Unisex Cotton Crew Tee
  36, // Gildan 2000 - Unisex Ultra Cotton Tee
];

// Get cached blueprint or fetch from API
export async function getCachedBlueprint(
  blueprintId: number
): Promise<Blueprint | null> {
  const supabase = createServiceClient();

  // Check cache
  const { data: cached } = await supabase
    .from("printify_catalog")
    .select("*")
    .eq("type", "blueprint")
    .eq("external_id", blueprintId)
    .single();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return cached.data as unknown as Blueprint;
  }

  // Fetch from API
  try {
    const blueprint = await getBlueprint(blueprintId);

    // Upsert cache
    await supabase
      .from("printify_catalog")
      .upsert(
        {
          id: cached?.id ?? undefined,
          type: "blueprint",
          external_id: blueprintId,
          data: blueprint as unknown as Record<string, unknown>,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CACHE_EXPIRATION_MS).toISOString(),
        },
        { onConflict: "type,external_id" }
      );

    return blueprint;
  } catch (error) {
    console.error(`Failed to fetch blueprint ${blueprintId}:`, error);
    if (cached) {
      return cached.data as unknown as Blueprint;
    }
    return null;
  }
}

// Get all supported blueprints
export async function getSupportedBlueprints(): Promise<Blueprint[]> {
  const blueprints: Blueprint[] = [];

  for (const id of SUPPORTED_BLUEPRINT_IDS) {
    const blueprint = await getCachedBlueprint(id);
    if (blueprint) {
      blueprints.push(blueprint);
    }
  }

  return blueprints;
}

// Get cached print providers for a blueprint
export async function getCachedPrintProviders(
  blueprintId: number
): Promise<PrintProvider[]> {
  const supabase = createServiceClient();
  const cacheKey = `providers-${blueprintId}`;

  const { data: cached } = await supabase
    .from("printify_catalog")
    .select("*")
    .eq("type", cacheKey)
    .single();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return cached.data as unknown as PrintProvider[];
  }

  try {
    const providers = await getPrintProviders(blueprintId);

    await supabase
      .from("printify_catalog")
      .upsert(
        {
          id: cached?.id ?? undefined,
          type: cacheKey,
          external_id: blueprintId,
          data: providers as unknown as Record<string, unknown>,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CACHE_EXPIRATION_MS).toISOString(),
        },
        { onConflict: "type,external_id" }
      );

    return providers;
  } catch (error) {
    console.error(`Failed to fetch providers for blueprint ${blueprintId}:`, error);
    if (cached) {
      return cached.data as unknown as PrintProvider[];
    }
    return [];
  }
}

// Get cached variants
export async function getCachedVariants(
  blueprintId: number,
  printProviderId: number
): Promise<Variant[]> {
  const supabase = createServiceClient();
  const cacheKey = `variants-${blueprintId}-${printProviderId}`;
  const compositeExternalId = blueprintId * 10000 + printProviderId;

  const { data: cached } = await supabase
    .from("printify_catalog")
    .select("*")
    .eq("type", cacheKey)
    .single();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return (cached.data as unknown as { variants: Variant[] }).variants;
  }

  try {
    const result = await getVariants(blueprintId, printProviderId);

    await supabase
      .from("printify_catalog")
      .upsert(
        {
          id: cached?.id ?? undefined,
          type: cacheKey,
          external_id: compositeExternalId,
          data: result as unknown as Record<string, unknown>,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CACHE_EXPIRATION_MS).toISOString(),
        },
        { onConflict: "type,external_id" }
      );

    return result.variants;
  } catch (error) {
    console.error(`Failed to fetch variants for ${blueprintId}/${printProviderId}:`, error);
    if (cached) {
      return (cached.data as unknown as { variants: Variant[] }).variants;
    }
    return [];
  }
}

// Refresh all catalog data
export async function refreshCatalog(): Promise<void> {
  console.log("[Catalog] Refreshing Printify catalog...");
  const supabase = createServiceClient();

  try {
    const allBlueprints = await getBlueprints();

    const tshirtBlueprints = allBlueprints.filter(
      (bp) =>
        bp.title.toLowerCase().includes("t-shirt") ||
        bp.title.toLowerCase().includes("tee")
    );

    console.log(`[Catalog] Found ${tshirtBlueprints.length} T-shirt blueprints`);

    for (const blueprint of tshirtBlueprints.slice(0, 20)) {
      await supabase
        .from("printify_catalog")
        .upsert(
          {
            type: "blueprint",
            external_id: blueprint.id,
            data: blueprint as unknown as Record<string, unknown>,
            fetched_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + CACHE_EXPIRATION_MS).toISOString(),
          },
          { onConflict: "type,external_id" }
        );
    }

    console.log("[Catalog] Refresh complete");
  } catch (error) {
    console.error("[Catalog] Refresh failed:", error);
  }
}
