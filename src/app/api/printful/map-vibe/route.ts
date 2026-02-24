import { NextRequest, NextResponse } from "next/server";
import { mapVibeToConfig } from "@/lib/vibe-mapper/mapper";

// POST /api/printful/map-vibe - Map user vibe to Printful config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.vibeDescription) {
      return NextResponse.json(
        { error: "Vibe description is required" },
        { status: 400 }
      );
    }

    const config = await mapVibeToConfig({
      vibeDescription: body.vibeDescription,
      artworkDescription: body.artworkDescription,
      productId: body.productId,
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to map vibe:", error);
    return NextResponse.json(
      { error: "Failed to map vibe to configuration" },
      { status: 500 }
    );
  }
}
