import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { getPrintfulClient, type SyncProductFile } from "@/lib/printful/client";
import { type MultiSideDesignState, migrateDesignState, getAllArtifactIds, isTextLayer } from "@/lib/design-state";
import { compositeDesignToImage } from "@/lib/image/composite";
import { uploadToStorage, getPublicUrl } from "@/lib/storage/client";
import { nanoid } from "nanoid";

export const createPrintfulProduct = inngest.createFunction(
  { id: "create-printful-product" },
  { event: "printful/create-product" },
  async ({ event, step }) => {
    const { jobId, sessionId, artifactId, config, multiState: rawMultiState } = event.data;

    const multiState: MultiSideDesignState = migrateDesignState(rawMultiState);

    // Mark job as running
    await step.run("mark-running", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("jobs")
        .update({ status: "RUNNING" })
        .eq("id", jobId);
    });

    // Collect all unique artifact IDs from layers
    const layerArtifactIds = getAllArtifactIds(multiState);
    const allArtifactIds = [...new Set([artifactId, ...layerArtifactIds])].filter(Boolean);

    // Get all artifacts
    const artifacts = await step.run("get-artifacts", async () => {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("artifacts")
        .select("*")
        .in("id", allArtifactIds);
      return data || [];
    });

    if (artifacts.length === 0) {
      await step.run("mark-failed-no-artifact", async () => {
        const supabase = createServiceClient();
        await supabase
          .from("jobs")
          .update({
            status: "FAILED",
            error: "No artifacts found",
          })
          .eq("id", jobId);
      });
      return { success: false, error: "No artifacts found" };
    }

    // Build artifact map (id -> { storage_url, storage_key })
    const artifactMap: Record<string, { storage_url: string; storage_key: string }> = {};
    for (const artifact of artifacts) {
      const url = artifact.storage_url.startsWith("http")
        ? artifact.storage_url
        : `${process.env.NEXT_PUBLIC_APP_URL}${artifact.storage_url}`;
      artifactMap[artifact.id] = { storage_url: url, storage_key: artifact.storage_key };
    }

    // Composite layers per side (handles text + image layers)
    const files: SyncProductFile[] = [];
    const hasTextLayers = [...multiState.front, ...multiState.back].some(isTextLayer);
    const hasMultipleLayers = multiState.front.length > 1 || multiState.back.length > 1;

    if (hasTextLayers || hasMultipleLayers) {
      // Full compositing needed
      for (const side of ["front", "back"] as const) {
        const layers = multiState[side];
        if (layers.length === 0) continue;

        // Composite and upload in the same step to avoid Buffer serialization issues
        const url = await step.run(`composite-upload-${side}`, async () => {
          const printArea = { width: 3591, height: 4364 };
          const composited = await compositeDesignToImage(layers, artifactMap, printArea);
          const key = `composited/${sessionId}/${side}-${nanoid()}.png`;
          await uploadToStorage(key, composited, "image/png");
          return getPublicUrl(key);
        });

        files.push({ url, type: side });
      }
    } else {
      // Simple case: single image layer per side, no compositing needed
      for (const side of ["front", "back"] as const) {
        const layers = multiState[side];
        if (layers.length === 0) continue;
        const primaryLayer = layers[0];
        if ("artifactId" in primaryLayer) {
          const info = artifactMap[primaryLayer.artifactId];
          if (info) files.push({ url: info.storage_url, type: side });
        }
      }
    }

    // Fallback: if no layers, use primary artifact on front
    if (files.length === 0 && artifactMap[artifactId]) {
      files.push({ url: artifactMap[artifactId].storage_url, type: "front" });
    }

    // Create the sync product
    const product = await step.run("create-sync-product", async () => {
      const client = getPrintfulClient();
      const retailPriceStr = (config.retailPrice / 100).toFixed(2);

      return client.createSyncProduct({
        sync_product: {
          name: config.title,
          thumbnail: files[0]?.url,
        },
        sync_variants: config.variantIds.map((variantId: number) => ({
          variant_id: variantId,
          retail_price: retailPriceStr,
          files,
        })),
      });
    });

    // Update session with Printful product ID
    await step.run("update-session", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("design_sessions")
        .update({
          printful_product_id: String(product.id),
          printful_config: config,
          status: "READY",
        })
        .eq("id", sessionId);
    });

    // Mark job as completed
    await step.run("mark-completed", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("jobs")
        .update({
          status: "COMPLETED",
          output: { productId: product.id },
        })
        .eq("id", jobId);

      await supabase.from("messages").insert({
        session_id: sessionId,
        role: "assistant",
        author_name: "Tailor",
        content: `Your T-shirt is ready! I've created "${config.title}" in your Printful store.`,
      });
    });

    return {
      success: true,
      productId: product.id,
    };
  }
);
