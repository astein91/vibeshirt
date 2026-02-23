import { NextResponse } from "next/server";
import { getSupportedBlueprints, getCachedPrintProviders } from "@/lib/printify/catalog";

// GET /api/printify/blueprints - Get cached T-shirt blueprints
export async function GET() {
  try {
    const blueprints = await getSupportedBlueprints();

    // Enrich with provider count
    const enrichedBlueprints = await Promise.all(
      blueprints.map(async (blueprint) => {
        const providers = await getCachedPrintProviders(blueprint.id);
        return {
          ...blueprint,
          providerCount: providers.length,
        };
      })
    );

    return NextResponse.json({
      blueprints: enrichedBlueprints,
      count: enrichedBlueprints.length,
    });
  } catch (error) {
    console.error("Failed to get blueprints:", error);
    return NextResponse.json(
      { error: "Failed to get blueprints" },
      { status: 500 }
    );
  }
}
