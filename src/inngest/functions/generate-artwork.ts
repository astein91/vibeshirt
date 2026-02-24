import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { generateImage, GenerateImageOptions } from "@/lib/gemini/generate";
import { uploadToStorage, getPublicUrl, getFromStorage } from "@/lib/storage/client";
import { nanoid } from "nanoid";

export const generateArtwork = inngest.createFunction(
  { id: "generate-artwork" },
  { event: "artwork/generate" },
  async ({ event, step }) => {
    const { jobId, sessionId, prompt, style, sourceArtifactId } = event.data;

    // Mark job as running
    await step.run("mark-running", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("jobs")
        .update({ status: "RUNNING" })
        .eq("id", jobId);
    });

    // Generate, upload, and save in a single step to avoid
    // passing large image buffers across step boundaries
    // (Inngest has a step output size limit)
    const genResult = await step.run("generate-and-upload", async () => {
      const supabase = createServiceClient();

      let enhancedPrompt = prompt;
      if (style && style !== "default") {
        enhancedPrompt = `${prompt}. Style: ${style}`;
      }

      const options: GenerateImageOptions = {};

      if (sourceArtifactId) {
        const { data: sourceArtifact } = await supabase
          .from("artifacts")
          .select("storage_key")
          .eq("id", sourceArtifactId)
          .single();

        if (sourceArtifact?.storage_key) {
          try {
            const sourceImageBuffer = await getFromStorage(sourceArtifact.storage_key);
            options.sourceImage = sourceImageBuffer;
            options.sourceImageMimeType = "image/png";
            console.log("[Generate] Fetched source image for modification");
          } catch (error) {
            console.warn("[Generate] Could not fetch source image, generating from scratch:", error);
          }
        }
      }

      const result = await generateImage(enhancedPrompt, options);

      if (!result.success || !result.imageData) {
        // Mark job as failed
        await supabase
          .from("jobs")
          .update({
            status: "FAILED",
            error: result.error || "Image generation failed",
          })
          .eq("id", jobId);

        await supabase.from("messages").insert({
          session_id: sessionId,
          role: "assistant",
          author_name: "Tailor",
          content: `Sorry, I couldn't generate that image. ${result.error || "Please try a different description."}`,
        });

        return { success: false as const, error: result.error };
      }

      // Upload image
      const storageKey = `generated/${sessionId}/${nanoid()}.png`;
      const imageBuffer = Buffer.isBuffer(result.imageData)
        ? result.imageData
        : Buffer.from(result.imageData);

      await uploadToStorage(storageKey, imageBuffer, result.mimeType || "image/png");
      const storageUrl = getPublicUrl(storageKey);

      // Create artifact record
      const { data: artifact } = await supabase
        .from("artifacts")
        .insert({
          session_id: sessionId,
          type: "GENERATED",
          storage_url: storageUrl,
          storage_key: storageKey,
          metadata: {
            format: "png",
            generatedAt: new Date().toISOString(),
          },
          prompt,
          source_artifact_id: sourceArtifactId || null,
        })
        .select()
        .single();

      await supabase.from("messages").insert({
        session_id: sessionId,
        role: "assistant",
        author_name: "Tailor",
        content: `I've created a new design based on your request! Take a look and let me know if you'd like any changes.`,
        artifact_id: artifact?.id ?? null,
      });

      // Return only metadata (no buffers!)
      return {
        success: true as const,
        artifactId: artifact!.id,
        storageUrl: artifact!.storage_url,
      };
    });

    if (!genResult.success) {
      return { success: false, error: genResult.error };
    }

    const artifact = { id: genResult.artifactId, storage_url: genResult.storageUrl };

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
          },
        })
        .eq("id", jobId);
    });

    // Auto-trigger normalization
    await step.run("auto-normalize", async () => {
      const supabase = createServiceClient();
      const { data: normalizeJob } = await supabase
        .from("jobs")
        .insert({
          session_id: sessionId,
          type: "NORMALIZE_IMAGE",
          status: "PENDING",
          input: {
            artifactId: artifact.id,
            removeBackground: true,
            targetWidth: 3600,
            targetHeight: 4800,
            targetDpi: 300,
          },
        })
        .select()
        .single();

      await inngest.send({
        name: "artwork/normalize",
        data: {
          jobId: normalizeJob!.id,
          sessionId,
          artifactId: artifact.id,
          removeBackground: true,
          targetWidth: 3600,
          targetHeight: 4800,
          targetDpi: 300,
        },
      });
    });

    return {
      success: true,
      artifactId: artifact.id,
      storageUrl: artifact.storage_url,
    };
  }
);
