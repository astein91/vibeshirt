import { getTextModel } from "@/lib/gemini/client";
import { getPrintfulClient, type Variant, type ProductDetails } from "@/lib/printful/client";

const PRODUCT_ID = 71; // Bella+Canvas 3001 on Printful

export interface PrintfulConfig {
  productId: number;
  title: string;
  description: string;
  variantIds: number[];
  retailPrice: number; // cents
}

export interface VibeInput {
  vibeDescription: string;
  artworkDescription?: string;
}

// In-memory cache for product data
let cachedProduct: ProductDetails | null = null;
let cachedProductAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getProduct(): Promise<ProductDetails> {
  if (cachedProduct && Date.now() - cachedProductAt < CACHE_TTL_MS) {
    return cachedProduct;
  }
  const client = getPrintfulClient();
  cachedProduct = await client.getProduct(PRODUCT_ID);
  cachedProductAt = Date.now();
  return cachedProduct;
}

// Map user vibe to Printful configuration using LLM
export async function mapVibeToConfig(input: VibeInput): Promise<PrintfulConfig> {
  const model = getTextModel();
  const product = await getProduct();
  const variants = product.variants.filter((v) => v.in_stock);

  if (variants.length === 0) {
    throw new Error("No in-stock variants available for the product.");
  }

  if (!model) {
    return createDefaultConfig(input, variants);
  }

  try {
    // Build unique colors list for the LLM
    const uniqueColors = [
      ...new Map(variants.map((v) => [v.color, v])).values(),
    ].map((v) => `- "${v.color}" (${v.color_code})`);

    const prompt = `You are helping configure a T-shirt product based on a user's vibe description.

User's vibe: "${input.vibeDescription}"
${input.artworkDescription ? `Artwork description: "${input.artworkDescription}"` : ""}

Available T-shirt colors:
${uniqueColors.join("\n")}

Based on the vibe, suggest:
1. A catchy product title (max 50 chars)
2. A product description (max 200 chars)
3. Recommended colors (list 3-5 color names that match the vibe, from the available colors above)

Respond in JSON format:
{
  "title": "<product title>",
  "description": "<product description>",
  "recommendedColors": ["color1", "color2", ...]
}`;

    const result = await model.generateContent([{ text: prompt }]);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse LLM response");
    }

    const llmConfig = JSON.parse(jsonMatch[0]);

    // Match recommended colors to variant IDs
    const matchedVariantIds = variants
      .filter((v) =>
        llmConfig.recommendedColors?.some(
          (c: string) => v.color.toLowerCase().includes(c.toLowerCase())
        )
      )
      .map((v) => v.id);

    // Fallback: if no colors matched, pick first 10 variants
    const variantIds =
      matchedVariantIds.length > 0
        ? matchedVariantIds
        : variants.slice(0, 10).map((v) => v.id);

    return {
      productId: PRODUCT_ID,
      title: llmConfig.title || `Custom ${input.vibeDescription} Tee`,
      description:
        llmConfig.description ||
        `A unique T-shirt designed with ${input.vibeDescription} vibes.`,
      variantIds,
      retailPrice: 2499,
    };
  } catch (error) {
    console.error("[VibeMapper] LLM mapping failed:", error);
    return createDefaultConfig(input, variants);
  }
}

function createDefaultConfig(
  input: VibeInput,
  variants: Variant[]
): PrintfulConfig {
  return {
    productId: PRODUCT_ID,
    title: "Custom Design Tee",
    description: input.vibeDescription
      ? `A unique T-shirt with ${input.vibeDescription} vibes.`
      : "A custom designed T-shirt.",
    variantIds: variants.slice(0, 10).map((v) => v.id),
    retailPrice: 2499,
  };
}
