import { NextResponse } from "next/server";
import { getPrintfulClient } from "@/lib/printful/client";

// T-shirt category ID in Printful
const TSHIRT_CATEGORY_ID = 24;

// Curated list of popular t-shirt product IDs
const FEATURED_PRODUCTS = [
  71,  // Unisex Staple T-Shirt (Bella+Canvas 3001)
  380, // Men's Staple Tee
  638, // Women's Relaxed T-Shirt
  586, // Unisex Organic Cotton T-Shirt
];

export async function GET() {
  try {
    const client = getPrintfulClient();

    // Get all t-shirt products
    const products = await client.getProducts(TSHIRT_CATEGORY_ID);

    // Filter to only show featured/popular products for now
    // and exclude discontinued ones
    const filteredProducts = products
      .filter((p) => !p.is_discontinued)
      .map((p) => ({
        id: p.id,
        name: `${p.brand || ""} ${p.model}`.trim(),
        type: p.type_name,
        image: p.image,
        variantCount: p.variant_count,
        isFeatured: FEATURED_PRODUCTS.includes(p.id),
      }))
      .sort((a, b) => {
        // Sort featured products first
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      products: filteredProducts,
      total: filteredProducts.length,
    });
  } catch (error) {
    console.error("Failed to fetch Printful products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
