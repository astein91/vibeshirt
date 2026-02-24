import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeForPrint } from "@/lib/image/normalize";
import { removeBackground, hasTransparentBackground } from "@/lib/image/background";
import { uploadToStorage, getFromStorage, getPublicUrl } from "@/lib/storage/client";
import { nanoid } from "nanoid";

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

    // Get the source artifact storage key
    const sourceStorageKey = await step.run("get-source", async () => {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("artifacts")
        .select("storage_key")
        .eq("id", artifactId)
        .single();
      return data?.storage_key ?? null;
    });

    if (!sourceStorageKey) {
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

    // Download, process, and upload in a single step to avoid
    // passing large image buffers across step boundaries
    // (Inngest has a step output size limit)
    const result = await step.run("process-and-upload", async () => {
      const supabase = createServiceClient();

      // Download source image
      const sourceImage = await getFromStorage(sourceStorageKey);

      // Remove background if requested
      let processedImage = sourceImage;
      if (shouldRemoveBackground) {
        const alreadyTransparent = await hasTransparentBackground(sourceImage);
        if (!alreadyTransparent) {
          const bgResult = await removeBackground(sourceImage);
          if (bgResult.success && bgResult.imageData) {
            processedImage = bgResult.imageData;
          }
        }
      }

      // Normalize for printing
      const normalized = await normalizeForPrint(processedImage, {
        targetWidth,
        targetHeight,
        targetDpi,
        maintainAspectRatio: true,
      });

      // Upload normalized image
      const storageKey = `normalized/${sessionId}/${nanoid()}.png`;
      await uploadToStorage(storageKey, normalized.buffer, "image/png");
      const storageUrl = getPublicUrl(storageKey);

      // Create artifact record
      const { data: artifact } = await supabase
        .from("artifacts")
        .insert({
          session_id: sessionId,
          type: "NORMALIZED",
          storage_url: storageUrl,
          storage_key: storageKey,
          metadata: {
            width: normalized.width,
            height: normalized.height,
            dpi: normalized.dpi,
            format: normalized.format,
            hasTransparency: normalized.hasAlpha,
            normalizedAt: new Date().toISOString(),
          },
          source_artifact_id: artifactId,
        })
        .select()
        .single();

      // Update session status
      await supabase
        .from("design_sessions")
        .update({ status: "NORMALIZED" })
        .eq("id", sessionId);

      // Return only metadata (no buffers!)
      return {
        artifactId: artifact!.id,
        storageUrl,
        width: normalized.width,
        height: normalized.height,
        dpi: normalized.dpi,
      };
    });

    // Mark job as completed
    await step.run("mark-completed", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("jobs")
        .update({
          status: "COMPLETED",
          output: result,
        })
        .eq("id", jobId);

      await supabase.from("messages").insert({
        session_id: sessionId,
        role: "assistant",
        author_name: "Tailor",
        content: `Your design is now print-ready! It's been optimized to ${result.width}x${result.height} pixels at ${result.dpi} DPI.`,
        artifact_id: result.artifactId,
      });
    });

    return {
      success: true,
      artifactId: result.artifactId,
      storageUrl: result.storageUrl,
    };
  }
);
