import { getTextModel } from "@/lib/gemini/client";
import { getPrintfulClient, type Variant, type ProductDetails } from "@/lib/printful/client";
import { DEFAULT_PRODUCT_ID } from "@/lib/printful/products";

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
  productId?: number;
}

// In-memory cache for product data (keyed by product ID)
const productCache = new Map<number, { data: ProductDetails; at: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getProduct(productId: number): Promise<ProductDetails> {
  const cached = productCache.get(productId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }
  const client = getPrintfulClient();
  const data = await client.getProduct(productId);
  productCache.set(productId, { data, at: Date.now() });
  return data;
}

// Map user vibe to Printful configuration using LLM
export async function mapVibeToConfig(input: VibeInput): Promise<PrintfulConfig> {
  const model = getTextModel();
  const productId = input.productId ?? DEFAULT_PRODUCT_ID;
  const product = await getProduct(productId);
  const variants = product.variants.filter((v) => v.in_stock);

  if (variants.length === 0) {
    throw new Error("No in-stock variants available for the product.");
  }

  if (!model) {
    return createDefaultConfig(input, variants, productId);
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
      productId,
      title: llmConfig.title || `Custom ${input.vibeDescription} Tee`,
      description:
        llmConfig.description ||
        `A unique T-shirt designed with ${input.vibeDescription} vibes.`,
      variantIds,
      retailPrice: 2499,
    };
  } catch (error) {
    console.error("[VibeMapper] LLM mapping failed:", error);
    return createDefaultConfig(input, variants, productId);
  }
}

function createDefaultConfig(
  input: VibeInput,
  variants: Variant[],
  productId: number
): PrintfulConfig {
  return {
    productId,
    title: "Custom Design Tee",
    description: input.vibeDescription
      ? `A unique T-shirt with ${input.vibeDescription} vibes.`
      : "A custom designed T-shirt.",
    variantIds: variants.slice(0, 10).map((v) => v.id),
    retailPrice: 2499,
  };
}
