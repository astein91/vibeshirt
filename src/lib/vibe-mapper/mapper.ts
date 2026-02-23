import { getTextModel } from "@/lib/gemini/client";
import { getSupportedBlueprints, getCachedPrintProviders, getCachedVariants } from "@/lib/printify/catalog";

export interface PrintifyConfig {
  blueprintId: number;
  blueprintTitle: string;
  printProviderId: number;
  printProviderTitle: string;
  variants: Array<{
    id: number;
    title: string;
    color: string;
    size: string;
    price: number;
    isEnabled: boolean;
  }>;
  title: string;
  description: string;
}

export interface VibeInput {
  vibeDescription: string;
  artworkDescription?: string;
}

// Default configuration when LLM is unavailable
const DEFAULT_CONFIG: Partial<PrintifyConfig> = {
  blueprintId: 145, // Bella+Canvas 3001
  printProviderId: 99, // Common provider
};

// Map user vibe to Printify configuration using LLM
export async function mapVibeToConfig(input: VibeInput): Promise<PrintifyConfig> {
  const model = getTextModel();

  // Get available blueprints
  const blueprints = await getSupportedBlueprints();

  if (blueprints.length === 0) {
    throw new Error("No blueprints available. Please check Printify configuration.");
  }

  // Default to first blueprint if LLM unavailable
  const defaultBlueprint = blueprints[0];
  const providers = await getCachedPrintProviders(defaultBlueprint.id);
  const defaultProvider = providers[0];

  if (!defaultProvider) {
    throw new Error("No print providers available for the selected blueprint.");
  }

  const variants = await getCachedVariants(defaultBlueprint.id, defaultProvider.id);

  if (!model) {
    // Return default config without LLM
    return createDefaultConfig(
      input,
      defaultBlueprint,
      defaultProvider,
      variants
    );
  }

  try {
    // Build context for LLM
    const blueprintOptions = blueprints
      .map((bp) => `- ID: ${bp.id}, Name: "${bp.title}", Brand: ${bp.brand}`)
      .join("\n");

    const prompt = `You are helping configure a T-shirt product based on a user's vibe description.

User's vibe: "${input.vibeDescription}"
${input.artworkDescription ? `Artwork description: "${input.artworkDescription}"` : ""}

Available T-shirt options:
${blueprintOptions}

Based on the vibe, select the most appropriate T-shirt and suggest:
1. The best blueprint ID for this vibe
2. A catchy product title (max 50 chars)
3. A product description (max 200 chars)
4. Recommended colors (list 3-5 colors that match the vibe)

Respond in JSON format:
{
  "blueprintId": <number>,
  "title": "<product title>",
  "description": "<product description>",
  "recommendedColors": ["color1", "color2", ...]
}`;

    const result = await model.generateContent([{ text: prompt }]);
    const text = result.response.text();

    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse LLM response");
    }

    const llmConfig = JSON.parse(jsonMatch[0]);

    // Find the selected blueprint
    const selectedBlueprint =
      blueprints.find((bp) => bp.id === llmConfig.blueprintId) || defaultBlueprint;

    // Get providers and variants for selected blueprint
    const selectedProviders = await getCachedPrintProviders(selectedBlueprint.id);
    const selectedProvider = selectedProviders[0] || defaultProvider;
    const selectedVariants = await getCachedVariants(
      selectedBlueprint.id,
      selectedProvider.id
    );

    // Filter variants by recommended colors
    const enabledVariants = selectedVariants.map((v) => {
      const colorMatch = llmConfig.recommendedColors?.some(
        (c: string) => v.options.color.toLowerCase().includes(c.toLowerCase())
      );
      return {
        id: v.id,
        title: v.title,
        color: v.options.color,
        size: v.options.size,
        price: 2499, // Default price in cents
        isEnabled: colorMatch || false,
      };
    });

    // Ensure at least some variants are enabled
    if (!enabledVariants.some((v) => v.isEnabled)) {
      enabledVariants.slice(0, 10).forEach((v) => (v.isEnabled = true));
    }

    return {
      blueprintId: selectedBlueprint.id,
      blueprintTitle: selectedBlueprint.title,
      printProviderId: selectedProvider.id,
      printProviderTitle: selectedProvider.title,
      variants: enabledVariants,
      title: llmConfig.title || `Custom ${input.vibeDescription} Tee`,
      description:
        llmConfig.description || `A unique T-shirt designed with ${input.vibeDescription} vibes.`,
    };
  } catch (error) {
    console.error("[VibeMapper] LLM mapping failed:", error);
    return createDefaultConfig(input, defaultBlueprint, defaultProvider, variants);
  }
}

// Create default config without LLM
function createDefaultConfig(
  input: VibeInput,
  blueprint: { id: number; title: string },
  provider: { id: number; title: string },
  variants: Array<{ id: number; title: string; options: { color: string; size: string } }>
): PrintifyConfig {
  const enabledVariants = variants.slice(0, 20).map((v) => ({
    id: v.id,
    title: v.title,
    color: v.options.color,
    size: v.options.size,
    price: 2499,
    isEnabled: true,
  }));

  return {
    blueprintId: blueprint.id,
    blueprintTitle: blueprint.title,
    printProviderId: provider.id,
    printProviderTitle: provider.title,
    variants: enabledVariants,
    title: `Custom Design Tee`,
    description: input.vibeDescription
      ? `A unique T-shirt with ${input.vibeDescription} vibes.`
      : "A custom designed T-shirt.",
  };
}

// Suggest colors based on vibe
export async function suggestColors(vibeDescription: string): Promise<string[]> {
  const model = getTextModel();

  if (!model) {
    return ["Black", "White", "Navy", "Heather Gray"];
  }

  try {
    const result = await model.generateContent([
      {
        text: `Based on this vibe description for a T-shirt design: "${vibeDescription}"

Suggest 5 T-shirt colors that would complement this vibe.
Respond with just a JSON array of color names:
["color1", "color2", "color3", "color4", "color5"]`,
      },
    ]);

    const text = result.response.text();
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return ["Black", "White", "Navy", "Heather Gray"];
  } catch {
    return ["Black", "White", "Navy", "Heather Gray"];
  }
}
