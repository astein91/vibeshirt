import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  generateArtwork,
  normalizeArtwork,
  createPrintfulProduct,
  handleTailorMention,
} from "@/inngest/functions";

// Create an API that serves the Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateArtwork,
    normalizeArtwork,
    createPrintfulProduct,
    handleTailorMention,
  ],
});
