import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeForPrint } from "@/lib/image/normalize";
import { removeBackground, hasTransparentBackground } from "@/lib/image/background";
import { uploadToStorage, getFromStorage, getPublicUrl } from "@/lib/storage/client";
import { nanoid } from "nanoid";

// Helper to ensure we have a proper Buffer from Inngest step serialization
function toBuffer(data: Buffer | { type: string; data: number[] }): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  return Buffer.from(data.data);
}

export const normalizeArtwork = inngest.createFunction(
  { id: "normalize-artwork" },
  { event: "artwork/normalize" },
  async ({ event, step }) => {
    const {
      jobId,
      sessionId,
      artifactId,
      removeBackground: shouldRemoveBackground,
      targetWidth,
      targetHeight,
      targetDpi,
    } = event.data;

    // Mark job as running
    await step.run("mark-running", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("jobs")
        .update({ status: "RUNNING" })
        .eq("id", jobId);
    });

    // Get the source artifact
    const sourceArtifact = await step.run("get-source", async () => {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("artifacts")
        .select("*")
        .eq("id", artifactId)
        .single();
      return data;
    });

    if (!sourceArtifact) {
      await step.run("mark-failed-no-source", async () => {
        const supabase = createServiceClient();
        await supabase
          .from("jobs")
          .update({
            status: "FAILED",
            error: "Source artifact not found",
          })
          .eq("id", jobId);
      });
      return { success: false, error: "Source artifact not found" };
    }

    // Download the source image
    const sourceImageRaw = await step.run("download-source", async () => {
      return getFromStorage(sourceArtifact.storage_key);
    });

    const sourceImage = toBuffer(sourceImageRaw);

    // Process the image
    let processedImage = sourceImage;

    if (shouldRemoveBackground) {
      const bgResult = await step.run("remove-background", async () => {
        const alreadyTransparent = await hasTransparentBackground(sourceImage);

        if (alreadyTransparent) {
          console.log("[Normalize] Image already has transparent background");
          return { changed: false };
        }

        const result = await removeBackground(sourceImage);
        if (result.success && result.imageData) {
          return { changed: true, data: result.imageData };
        }
        return { changed: false };
      });

      if (bgResult.changed && "data" in bgResult && bgResult.data) {
        processedImage = toBuffer(bgResult.data);
      }
    }

    // Normalize for printing
    const normalizedRaw = await step.run("normalize-image", async () => {
      const result = await normalizeForPrint(processedImage, {
        targetWidth,
        targetHeight,
        targetDpi,
        maintainAspectRatio: true,
      });
      return {
        buffer: result.buffer,
        width: result.width,
        height: result.height,
        dpi: result.dpi,
        format: result.format,
        hasAlpha: result.hasAlpha,
      };
    });

    const normalizedBuffer = toBuffer(normalizedRaw.buffer);

    // Upload the normalized image
    const artifact = await step.run("upload-normalized", async () => {
      const supabase = createServiceClient();
      const storageKey = `normalized/${sessionId}/${nanoid()}.png`;

      await uploadToStorage(storageKey, normalizedBuffer, "image/png");

      const storageUrl = getPublicUrl(storageKey);

      const { data: artifact } = await supabase
        .from("artifacts")
        .insert({
          session_id: sessionId,
          type: "NORMALIZED",
          storage_url: storageUrl,
          storage_key: storageKey,
          metadata: {
            width: normalizedRaw.width,
            height: normalizedRaw.height,
            dpi: normalizedRaw.dpi,
            format: normalizedRaw.format,
            hasTransparency: normalizedRaw.hasAlpha,
            normalizedAt: new Date().toISOString(),
          },
          source_artifact_id: artifactId,
        })
        .select()
        .single();

      await supabase
        .from("design_sessions")
        .update({ status: "NORMALIZED" })
        .eq("id", sessionId);

      return artifact!;
    });

    // Mark job as completed
    await step.run("mark-completed", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("jobs")
        .update({
          status: "COMPLETED",
          output: {
            artifactId: artifact.id,
            storageUrl: artifact.storage_url,
            width: normalizedRaw.width,
            height: normalizedRaw.height,
            dpi: normalizedRaw.dpi,
          },
        })
        .eq("id", jobId);

      await supabase.from("messages").insert({
        session_id: sessionId,
        role: "assistant",
        author_name: "Tailor",
        content: `Your design is now print-ready! It's been optimized to ${normalizedRaw.width}x${normalizedRaw.height} pixels at ${normalizedRaw.dpi} DPI.`,
        artifact_id: artifact.id,
      });
    });

    return {
      success: true,
      artifactId: artifact.id,
      storageUrl: artifact.storage_url,
    };
  }
);
