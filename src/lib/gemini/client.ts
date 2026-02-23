import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("[Gemini] No API key configured. Image generation will be unavailable.");
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Get the image generation model (Nano Banana Pro / Gemini 3 Pro Image)
export function getImageModel(): GenerativeModel | null {
  if (!genAI) return null;
  return genAI.getGenerativeModel({
    model: "gemini-3-pro-image-preview",
  });
}

// Get the text model for chat/analysis
export function getTextModel(): GenerativeModel | null {
  if (!genAI) return null;
  return genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
}

export { genAI };
