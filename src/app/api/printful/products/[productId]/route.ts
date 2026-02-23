import { NextResponse } from "next/server";
import { getPrintfulClient, Variant } from "@/lib/printful/client";

interface ColorOption {
  name: string;
  hex: string;
  hex2: string | null; // Secondary color for heathers
  variantIds: number[];
  image: string;
}

interface SizeOption {
  name: string;
  variantIds: number[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId: productIdStr } = await params;
    const productId = parseInt(productIdStr, 10);

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: "Invalid product ID" },
        { status: 400 }
      );
    }

    const client = getPrintfulClient();

    // Get product details with all variants
    const { product, variants } = await client.getProduct(productId);

    // Try to get printfile info for print area dimensions (may fail without store_id)
    let printfiles = null;
    try {
      printfiles = await client.getPrintfiles(productId);
    } catch {
      // Printfiles endpoint requires store_id - use defaults
      console.log("Printfiles endpoint unavailable, using default print areas");
    }

    // Extract unique colors with their hex codes
    const colorMap = new Map<string, ColorOption>();
    const sizeMap = new Map<string, SizeOption>();

    for (const variant of variants) {
      // Only include in-stock variants
      if (!variant.in_stock) continue;

      // Group by color
      const colorKey = variant.color;
      if (!colorMap.has(colorKey)) {
        colorMap.set(colorKey, {
          name: variant.color,
          hex: variant.color_code || "#FFFFFF",
          hex2: variant.color_code2,
          variantIds: [],
          image: variant.image,
        });
      }
      colorMap.get(colorKey)!.variantIds.push(variant.id);

      // Group by size
      const sizeKey = variant.size;
      if (!sizeMap.has(sizeKey)) {
        sizeMap.set(sizeKey, {
          name: variant.size,
          variantIds: [],
        });
      }
      sizeMap.get(sizeKey)!.variantIds.push(variant.id);
    }

    // Get all variants for quick lookup (color + size -> variant)
    const variantLookup: Record<string, Variant> = {};
    for (const variant of variants) {
      variantLookup[`${variant.color}-${variant.size}`] = variant;
    }

    // Extract print area info (use defaults if printfiles unavailable)
    let printAreas: { placement: string; title: string; width: number; height: number; dpi: number }[] = [];

    if (printfiles?.available_placements) {
      printAreas = Object.entries(printfiles.available_placements).map(
        ([placement, title]) => {
          const variantPrintfile = printfiles.variant_printfiles?.[0];
          const placementInfo = variantPrintfile?.placements?.[placement];
          const printfile = printfiles.printfiles?.find(
            (p) => p.printfile_id === placementInfo?.printfile_id
          );

          return {
            placement,
            title: title as string, // Printful returns string titles directly
            width: printfile?.width || 4500,
            height: printfile?.height || 5400,
            dpi: printfile?.dpi || 150,
          };
        }
      );
    } else {
      // Default print areas for t-shirts
      printAreas = [
        { placement: "front", title: "Front", width: 4500, height: 5400, dpi: 150 },
        { placement: "back", title: "Back", width: 4500, height: 5400, dpi: 150 },
      ];
    }

    // Standard size order for sorting
    const sizeOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

    return NextResponse.json({
      product: {
        id: product.id,
        name: `${product.brand || ""} ${product.model}`.trim(),
        type: product.type_name,
        description: product.description,
        image: product.image,
        techniques: product.techniques,
      },
      colors: Array.from(colorMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      sizes: Array.from(sizeMap.values()).sort((a, b) => {
        const aIndex = sizeOrder.indexOf(a.name);
        const bIndex = sizeOrder.indexOf(b.name);
        if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }),
      printAreas,
      variantCount: variants.filter((v) => v.in_stock).length,
    });
  } catch (error) {
    console.error("Failed to fetch Printful product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product details" },
      { status: 500 }
    );
  }
}
