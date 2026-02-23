import { getImageModel, getTextModel } from "./client";
import sharp from "sharp";

export interface GenerateImageResult {
  success: boolean;
  imageData?: Buffer;
  mimeType?: string;
  error?: string;
}

// Background color to use for generation (will be removed to create transparency)
// Using bright magenta as it's unlikely to appear in designs
const CHROMA_KEY_COLOR = { r: 255, g: 0, b: 255 };
const CHROMA_KEY_HEX = "#FF00FF";

// Tolerance for color matching (to handle compression artifacts and anti-aliasing)
const COLOR_TOLERANCE = 30;

/**
 * Remove the magenta background from an image and replace with transparency
 * Uses sharp for high-performance image processing
 */
async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  try {
    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      console.warn("[Background Removal] Could not get image dimensions, returning original");
      return imageBuffer;
    }

    // Extract raw pixel data
    const { data, info } = await image
      .ensureAlpha() // Ensure we have an alpha channel
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    const { width, height, channels } = info;

    // Process each pixel
    for (let i = 0; i < pixels.length; i += channels) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // Check if this pixel is close to the chroma key color
      const rDiff = Math.abs(r - CHROMA_KEY_COLOR.r);
      const gDiff = Math.abs(g - CHROMA_KEY_COLOR.g);
      const bDiff = Math.abs(b - CHROMA_KEY_COLOR.b);

      if (rDiff <= COLOR_TOLERANCE && gDiff <= COLOR_TOLERANCE && bDiff <= COLOR_TOLERANCE) {
        // Make this pixel transparent
        pixels[i + 3] = 0; // Set alpha to 0
      }
    }

    // Create the output image with transparency
    const result = await sharp(Buffer.from(pixels), {
      raw: {
        width,
        height,
        channels: 4, // RGBA
      },
    })
      .png()
      .toBuffer();

    return result;
  } catch (error) {
    console.error("[Background Removal] Error processing image:", error);
    // Return original image if processing fails
    return imageBuffer;
  }
}

// Print area configuration passed to image generation
export interface PrintAreaConfig {
  width: number;
  height: number;
  position: string; // "front", "back", etc.
}

// Default print area dimensions (Bella+Canvas 3001 medium front)
const DEFAULT_PRINT_AREA: PrintAreaConfig = {
  width: 3591,
  height: 4364,
  position: "front",
};

// Options for image generation
export interface GenerateImageOptions {
  printArea?: PrintAreaConfig;
  sourceImage?: Buffer; // For modifications - the image to modify
  sourceImageMimeType?: string;
}

// Generate an image from a text prompt using Gemini
export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {}
): Promise<GenerateImageResult> {
  const { printArea = DEFAULT_PRINT_AREA, sourceImage, sourceImageMimeType = "image/png" } = options;
  const model = getImageModel();

  if (!model) {
    return {
      success: false,
      error: "Gemini API not configured",
    };
  }

  try {
    // Calculate aspect ratio for the prompt
    const aspectRatio = printArea.width / printArea.height;
    const isPortrait = aspectRatio < 1;
    const orientationHint = isPortrait ? "portrait/vertical" : "square";

    // Different prompts for new generation vs modification
    const isModification = !!sourceImage;

    // Create an optimized prompt for T-shirt design with specific dimensions
    // We use a solid magenta background that we'll remove in post-processing
    const enhancedPrompt = isModification
      ? `Modify this existing T-shirt design based on the user's request.

USER REQUEST: ${prompt}

CRITICAL REQUIREMENTS:
- Keep the same overall style and composition unless specifically asked to change it
- The modified image MUST have a SOLID BRIGHT MAGENTA/PINK background (hex ${CHROMA_KEY_HEX}, RGB 255,0,255)
- The ENTIRE background must be this exact solid magenta color - no patterns, no gradients
- Do NOT use magenta/pink in the design itself
- Maintain the same dimensions and orientation as the original

Apply the requested changes while preserving what works well in the original design.
The background MUST be solid ${CHROMA_KEY_HEX} magenta for transparency processing.`
      : `Create a high-quality artwork design for T-shirt printing.

CRITICAL REQUIREMENTS:
- The image MUST have a SOLID BRIGHT MAGENTA/PINK background (hex ${CHROMA_KEY_HEX}, RGB 255,0,255)
- The ENTIRE background must be this exact solid magenta color - no patterns, no gradients, no variations
- Target dimensions: ${printArea.width} x ${printArea.height} pixels (${orientationHint} orientation)
- The design should be centered and fill most of the canvas
- Leave some breathing room around edges (don't extend to the very edge)
- Do NOT use magenta/pink in the design itself - avoid any colors close to ${CHROMA_KEY_HEX}

DESIGN GUIDELINES:
- Clean, bold lines that print well on fabric
- High contrast colors (avoid very light colors that won't show on light shirts)
- Solid colors work better than gradients for DTG printing
- Vector-style graphics or clean illustrations preferred
- Avoid tiny details that may get lost in printing
- No watermarks, signatures, or text unless specifically requested

STYLE:
- Modern, professional aesthetic suitable for apparel
- Design should work on both light and dark colored shirts if possible
- Consider how the design will look when worn

DESIGN REQUEST: ${prompt}

IMPORTANT: The background MUST be solid ${CHROMA_KEY_HEX} magenta with no patterns or variations. This will be removed later to make the design transparent.`;

    // Build content parts - include source image for modifications
    const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // Add the source image first if this is a modification
    if (sourceImage) {
      contentParts.push({
        inlineData: {
          mimeType: sourceImageMimeType,
          data: sourceImage.toString("base64"),
        },
      });
    }

    // Add the text prompt
    contentParts.push({ text: enhancedPrompt });

    const result = await model.generateContent(contentParts);

    const response = result.response;
    const parts = response.candidates?.[0]?.content?.parts || [];

    // Look for image data in the response
    for (const part of parts) {
      if ("inlineData" in part && part.inlineData) {
        const { data, mimeType } = part.inlineData;
        const rawImageBuffer = Buffer.from(data, "base64");

        // Remove the magenta background to create true transparency
        const transparentBuffer = await removeBackground(rawImageBuffer);

        return {
          success: true,
          imageData: transparentBuffer,
          mimeType: "image/png", // Always PNG for transparency
        };
      }
    }

    // If no image was generated, return an error
    return {
      success: false,
      error: "No image was generated. The model may have returned text instead.",
    };
  } catch (error) {
    console.error("[Gemini] Image generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Parse user intent from a message
export interface ParsedIntent {
  type: "generate" | "modify" | "position" | "question" | "other";
  prompt?: string;
  modifications?: string[];
  question?: string;
  positionChanges?: DesignPositionCommand;
}

// Design position command from natural language
export interface DesignPositionCommand {
  action: "move" | "scale" | "rotate" | "reset" | "center";
  x?: number; // Percentage or absolute
  y?: number;
  scale?: number; // Multiplier (1 = 100%)
  rotation?: number; // Degrees
  preset?: "center" | "top" | "bottom" | "left" | "right" | "fill" | "fit";
}

export async function parseUserIntent(message: string): Promise<ParsedIntent> {
  const model = getTextModel();

  // Quick check for positioning keywords
  const lowerMessage = message.toLowerCase();
  const positionKeywords = [
    "move", "position", "center", "scale", "bigger", "smaller",
    "larger", "rotate", "tilt", "shift", "nudge", "place", "put",
    "top", "bottom", "left", "right", "middle", "fill", "fit"
  ];
  const hasPositionIntent = positionKeywords.some(kw => lowerMessage.includes(kw));

  if (!model) {
    // Fallback to simple keyword detection
    if (hasPositionIntent && !lowerMessage.includes("design") && !lowerMessage.includes("create")) {
      return {
        type: "position",
        positionChanges: parseSimplePositionCommand(message)
      };
    }
    if (
      lowerMessage.includes("create") ||
      lowerMessage.includes("design") ||
      lowerMessage.includes("make") ||
      lowerMessage.includes("generate")
    ) {
      return { type: "generate", prompt: message };
    }
    if (
      lowerMessage.includes("change") ||
      lowerMessage.includes("modify") ||
      lowerMessage.includes("more") ||
      lowerMessage.includes("less") ||
      lowerMessage.includes("add") ||
      lowerMessage.includes("remove")
    ) {
      return { type: "modify", modifications: [message] };
    }
    if (message.includes("?")) {
      return { type: "question", question: message };
    }
    return { type: "other" };
  }

  try {
    const result = await model.generateContent([
      {
        text: `Analyze this message from a user designing a T-shirt and classify their intent.

Message: "${message}"

Respond in JSON format only:
{
  "type": "generate" | "modify" | "position" | "question" | "other",
  "prompt": "the full design prompt if type is generate",
  "modifications": ["list of modifications if type is modify"],
  "question": "the question if type is question",
  "positionChanges": {
    "action": "move" | "scale" | "rotate" | "reset" | "center",
    "x": <number 0-100 percentage from left>,
    "y": <number 0-100 percentage from top>,
    "scale": <number multiplier, 1 = 100%, 0.5 = 50%, 2 = 200%>,
    "rotation": <number in degrees>,
    "preset": "center" | "top" | "bottom" | "left" | "right" | "fill" | "fit"
  }
}

Intent types:
- "generate": User wants to create a new design from scratch
- "modify": User wants to change the artwork itself (colors, elements, style)
- "position": User wants to move, resize, or rotate the design placement on the shirt
- "question": User is asking a question
- "other": General conversation or unclear intent

Position examples:
- "move it up" → position with y: 30, preset: "top"
- "make it bigger" → position with action: "scale", scale: 1.3
- "center it" → position with preset: "center"
- "rotate 45 degrees" → position with action: "rotate", rotation: 45
- "put it on the left" → position with preset: "left"`,
      },
    ]);

    const text = result.response.text();
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ParsedIntent;
    }

    return { type: "other" };
  } catch (error) {
    console.error("[Gemini] Intent parsing error:", error);
    return { type: "other" };
  }
}

// Simple position command parser (fallback when AI not available)
function parseSimplePositionCommand(message: string): DesignPositionCommand {
  const lower = message.toLowerCase();

  if (lower.includes("center") || lower.includes("middle")) {
    return { action: "center", preset: "center" };
  }
  if (lower.includes("top")) {
    return { action: "move", preset: "top", y: 20 };
  }
  if (lower.includes("bottom")) {
    return { action: "move", preset: "bottom", y: 80 };
  }
  if (lower.includes("left")) {
    return { action: "move", preset: "left", x: 30 };
  }
  if (lower.includes("right")) {
    return { action: "move", preset: "right", x: 70 };
  }
  if (lower.includes("bigger") || lower.includes("larger") || lower.includes("scale up")) {
    return { action: "scale", scale: 1.2 };
  }
  if (lower.includes("smaller") || lower.includes("scale down")) {
    return { action: "scale", scale: 0.8 };
  }
  if (lower.includes("fill")) {
    return { action: "scale", preset: "fill", scale: 1.5 };
  }
  if (lower.includes("fit")) {
    return { action: "scale", preset: "fit", scale: 0.9 };
  }
  if (lower.includes("reset")) {
    return { action: "reset" };
  }

  // Try to extract rotation angle
  const rotateMatch = lower.match(/rotate\s*(\d+)/);
  if (rotateMatch) {
    return { action: "rotate", rotation: parseInt(rotateMatch[1], 10) };
  }

  return { action: "center", preset: "center" };
}

// Generate a conversational response
export async function generateResponse(
  context: string,
  userMessage: string
): Promise<string> {
  const model = getTextModel();

  if (!model) {
    return "I'm having trouble connecting to my AI assistant right now. Please try again in a moment.";
  }

  try {
    const result = await model.generateContent([
      {
        text: `You are Tailor, a friendly AI assistant helping users design custom T-shirts.
You're creative, helpful, and knowledgeable about design and fashion.

Context about the current design session:
${context}

User message: "${userMessage}"

Respond naturally and helpfully. If they want to create or modify a design, acknowledge their request and let them know you're working on it.

For positioning requests (move, scale, rotate):
- Confirm what you're doing: "Moving the design up..." or "Scaling it larger..."
- Keep it brief

Keep responses concise and friendly.`,
      },
    ]);

    return result.response.text();
  } catch (error) {
    console.error("[Gemini] Response generation error:", error);
    return "I encountered an error processing your request. Let me try again.";
  }
}
