import { NextResponse } from "next/server";
import { getCachedPrintProviders, getCachedVariants } from "@/lib/printify/catalog";

// Color name to hex mapping for common Printify colors
// This provides a reasonable approximation for UI display
const COLOR_HEX_MAP: Record<string, string> = {
  // Basic colors
  "White": "#FFFFFF",
  "Black": "#1A1A1A",
  "Navy": "#1F2937",
  "Navy Blue": "#1F2937",
  "Red": "#DC2626",
  "Blue": "#2563EB",
  "Gray": "#6B7280",
  "Grey": "#6B7280",
  "Green": "#16A34A",
  "Yellow": "#EAB308",
  "Orange": "#EA580C",
  "Pink": "#EC4899",
  "Purple": "#9333EA",
  "Brown": "#78350F",

  // Extended colors
  "Aqua": "#06B6D4",
  "Army": "#4B5320",
  "Ash": "#B0B0B0",
  "Asphalt": "#4A4A4A",
  "Athletic Heather": "#9CA3AF",
  "Autumn": "#D97706",
  "Baby Blue": "#93C5FD",
  "Berry": "#9D174D",
  "Black Heather": "#374151",
  "Burnt Orange": "#C2410C",
  "Canvas Red": "#B91C1C",
  "Cardinal": "#991B1B",
  "Charity Pink": "#F9A8D4",
  "Citron": "#84CC16",
  "Columbia Blue": "#7DD3FC",
  "Coral": "#F97316",
  "Dark Grey": "#374151",
  "Dark Grey Heather": "#4B5563",
  "Dark Olive": "#3F3F46",
  "Deep Heather": "#6B7280",
  "Deep Teal": "#0D9488",
  "Dusty Blue": "#64748B",
  "Evergreen": "#166534",
  "Forest": "#14532D",
  "Fuchsia": "#D946EF",
  "Gold": "#CA8A04",
  "Heather Aqua": "#67E8F9",
  "Heather Blue": "#60A5FA",
  "Heather Forest": "#4ADE80",
  "Heather Grey": "#9CA3AF",
  "Heather Midnight Navy": "#1E3A5F",
  "Heather Navy": "#3B5998",
  "Heather Red": "#F87171",
  "Kelly": "#15803D",
  "Lavender Blue": "#A5B4FC",
  "Leaf": "#65A30D",
  "Light Blue": "#BAE6FD",
  "Lilac": "#C4B5FD",
  "Maize Yellow": "#FDE047",
  "Maroon": "#7F1D1D",
  "Mauve": "#C084FC",
  "Military Green": "#4D5B3C",
  "Mint": "#86EFAC",
  "Mustard": "#CA8A04",
  "Natural": "#FAFAF9",
  "Ocean Blue": "#0284C7",
  "Olive": "#84CC16",
  "Orchid": "#E879F9",
  "Peach": "#FDBA74",
  "Rust": "#B45309",
  "Sage": "#94A3B8",
  "Sand Dune": "#D6BCAB",
  "Silver": "#C0C0C0",
  "Soft Cream": "#FEF3C7",
  "Soft Pink": "#FBCFE8",
  "Steel Blue": "#475569",
  "Storm": "#64748B",
  "Sunset": "#FB923C",
  "Tan": "#D4A574",
  "Teal": "#14B8A6",
  "Team Purple": "#7C3AED",
  "True Royal": "#1D4ED8",
  "Turquoise": "#2DD4BF",
  "Vintage Black": "#27272A",
  "Vintage White": "#F5F5F4",
};

// Get a hex color for a color name, or generate one if not found
function getColorHex(colorName: string): string {
  // Try exact match first
  if (COLOR_HEX_MAP[colorName]) {
    return COLOR_HEX_MAP[colorName];
  }

  // Try case-insensitive match
  const lowerName = colorName.toLowerCase();
  for (const [name, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (name.toLowerCase() === lowerName) {
      return hex;
    }
  }

  // Try partial match (e.g., "Heather Blue Lagoon" might match "Heather Blue")
  for (const [name, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (lowerName.includes(name.toLowerCase()) || name.toLowerCase().includes(lowerName)) {
      return hex;
    }
  }

  // Generate a hash-based color as fallback
  let hash = 0;
  for (let i = 0; i < colorName.length; i++) {
    hash = colorName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 50%, 50%)`;
}

// Default print provider ID - Printify Choice (generally good quality/price)
const DEFAULT_PRINT_PROVIDER_ID = 99;

// GET /api/printify/blueprints/[blueprintId]/variants
export async function GET(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    const { blueprintId: blueprintIdStr } = await params;
    const blueprintId = parseInt(blueprintIdStr, 10);

    if (isNaN(blueprintId)) {
      return NextResponse.json(
        { error: "Invalid blueprint ID" },
        { status: 400 }
      );
    }

    // Get print providers for this blueprint
    const providers = await getCachedPrintProviders(blueprintId);

    if (providers.length === 0) {
      return NextResponse.json(
        { error: "No print providers found for this blueprint" },
        { status: 404 }
      );
    }

    // Use the URL param or default provider
    const url = new URL(request.url);
    const providerIdParam = url.searchParams.get("providerId");
    const printProviderId = providerIdParam
      ? parseInt(providerIdParam, 10)
      : (providers.find(p => p.id === DEFAULT_PRINT_PROVIDER_ID)?.id || providers[0].id);

    // Get variants for this blueprint/provider
    const variants = await getCachedVariants(blueprintId, printProviderId);

    if (variants.length === 0) {
      return NextResponse.json(
        { error: "No variants found" },
        { status: 404 }
      );
    }

    // Extract unique colors with hex values
    const colorMap = new Map<string, { name: string; hex: string; variantIds: number[] }>();

    for (const variant of variants) {
      const colorName = variant.options.color;
      if (!colorMap.has(colorName)) {
        colorMap.set(colorName, {
          name: colorName,
          hex: getColorHex(colorName),
          variantIds: [],
        });
      }
      colorMap.get(colorName)!.variantIds.push(variant.id);
    }

    // Extract unique sizes
    const sizes = [...new Set(variants.map(v => v.options.size))];

    // Get print areas from first variant (they're consistent across colors for same size)
    // Group by size since print areas vary by size
    const printAreasBySize: Record<string, Array<{ position: string; width: number; height: number }>> = {};

    for (const variant of variants) {
      const size = variant.options.size;
      if (!printAreasBySize[size] && variant.placeholders) {
        printAreasBySize[size] = variant.placeholders;
      }
    }

    // Get a reference print area (use M or first available)
    const referencePrintAreas = printAreasBySize["M"] || printAreasBySize["L"] || Object.values(printAreasBySize)[0] || [];

    return NextResponse.json({
      blueprintId,
      printProviderId,
      providers: providers.map(p => ({ id: p.id, title: p.title })),
      colors: Array.from(colorMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      sizes,
      printAreas: referencePrintAreas,
      printAreasBySize,
      variantCount: variants.length,
    });
  } catch (error) {
    console.error("Failed to get variants:", error);
    return NextResponse.json(
      { error: "Failed to get variants" },
      { status: 500 }
    );
  }
}
