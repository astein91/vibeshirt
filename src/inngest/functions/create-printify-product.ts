import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadImage, createProduct, getShopId } from "@/lib/printify/client";
import { type MultiSideDesignState, migrateDesignState, getAllArtifactIds } from "@/lib/design-state";

export const createPrintifyProduct = inngest.createFunction(
  { id: "create-printify-product" },
  { event: "printify/create-product" },
  async ({ event, step }) => {
    const { jobId, sessionId, artifactId, config, multiState: rawMultiState } = event.data;

    // Migrate design state (handles both old single and new multi format)
    const multiState: MultiSideDesignState = migrateDesignState(rawMultiState);

    // Mark job as running
    await step.run("mark-running", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("jobs")
        .update({ status: "RUNNING" })
        .eq("id", jobId);
    });

    // Collect all unique artifact IDs from layers (plus the primary artifactId as fallback)
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

    // Upload each unique image to Printify (deduplicated)
    const printifyImages = await step.run("upload-to-printify", async () => {
      const imageMap: Record<string, string> = {}; // artifactId -> printifyImageId

      for (const artifact of artifacts) {
        const imageUrl = artifact.storage_url.startsWith("http")
          ? artifact.storage_url
          : `${process.env.NEXT_PUBLIC_APP_URL}${artifact.storage_url}`;

        const uploaded = await uploadImage(`design-${artifact.id}.png`, imageUrl);
        imageMap[artifact.id] = uploaded.id;
      }

      return imageMap;
    });

    // Update artifacts with Printify image IDs
    await step.run("update-artifacts", async () => {
      const supabase = createServiceClient();
      for (const [artId, printifyImageId] of Object.entries(printifyImages)) {
        await supabase
          .from("artifacts")
          .update({ printify_image_id: printifyImageId })
          .eq("id", artId);
      }
    });

    // Build placeholders from multiState layers
    const placeholders: Array<{
      position: string;
      images: Array<{ id: string; x: number; y: number; scale: number; angle: number }>;
    }> = [];

    for (const side of ["front", "back"] as const) {
      const layers = multiState[side];
      if (layers.length === 0) continue;

      const images = layers
        .filter((l) => printifyImages[l.artifactId])
        .map((layer) => ({
          id: printifyImages[layer.artifactId],
          x: layer.designState.x / 100, // App uses 0-100%, Printify uses 0-1
          y: layer.designState.y / 100,
          scale: layer.designState.scale,
          angle: layer.designState.rotation,
        }));

      if (images.length > 0) {
        placeholders.push({ position: side, images });
      }
    }

    // Fallback: if no layers produced placeholders, use primary artifact on front
    if (placeholders.length === 0 && printifyImages[artifactId]) {
      placeholders.push({
        position: "front",
        images: [
          {
            id: printifyImages[artifactId],
            x: 0.5,
            y: 0.5,
            scale: 1,
            angle: 0,
          },
        ],
      });
    }

    // Create the product
    const product = await step.run("create-product", async () => {
      const shopId = getShopId();

      const variants = config.variants as Array<{
        id: number;
        price: number;
        isEnabled: boolean;
      }>;

      const enabledVariantIds = variants
        .filter((v) => v.isEnabled)
        .map((v) => v.id);

      return createProduct(shopId, {
        title: config.title,
        description: config.description,
        blueprint_id: config.blueprintId,
        print_provider_id: config.printProviderId,
        variants: variants.map((v) => ({
          id: v.id,
          price: v.price,
          is_enabled: v.isEnabled,
        })),
        print_areas: [
          {
            variant_ids: enabledVariantIds,
            placeholders,
          },
        ],
      });
    });

    // Update session with Printify product ID
    await step.run("update-session", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("design_sessions")
        .update({
          printify_product_id: product.id,
          printify_config: config,
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
          output: {
            productId: product.id,
            printifyImageIds: printifyImages,
          },
        })
        .eq("id", jobId);

      await supabase.from("messages").insert({
        session_id: sessionId,
        role: "assistant",
        author_name: "Tailor",
        content: `Your T-shirt is ready! I've created "${config.title}" in your Printify store. You can now customize variants and publish it.`,
      });
    });

    return {
      success: true,
      productId: product.id,
      printifyImageIds: printifyImages,
    };
  }
);
