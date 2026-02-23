import { inngest } from "../client";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadImage, createProduct, getShopId } from "@/lib/printify/client";

export const createPrintifyProduct = inngest.createFunction(
  { id: "create-printify-product" },
  { event: "printify/create-product" },
  async ({ event, step }) => {
    const { jobId, sessionId, artifactId, config } = event.data;

    // Mark job as running
    await step.run("mark-running", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("jobs")
        .update({ status: "RUNNING" })
        .eq("id", jobId);
    });

    // Get the artifact
    const artifact = await step.run("get-artifact", async () => {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("artifacts")
        .select("*")
        .eq("id", artifactId)
        .single();
      return data;
    });

    if (!artifact) {
      await step.run("mark-failed-no-artifact", async () => {
        const supabase = createServiceClient();
        await supabase
          .from("jobs")
          .update({
            status: "FAILED",
            error: "Artifact not found",
          })
          .eq("id", jobId);
      });
      return { success: false, error: "Artifact not found" };
    }

    // Upload image to Printify
    const printifyImage = await step.run("upload-to-printify", async () => {
      const imageUrl = artifact.storage_url.startsWith("http")
        ? artifact.storage_url
        : `${process.env.NEXT_PUBLIC_APP_URL}${artifact.storage_url}`;

      return uploadImage(`design-${artifact.id}.png`, imageUrl);
    });

    // Update artifact with Printify image ID
    await step.run("update-artifact", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("artifacts")
        .update({ printify_image_id: printifyImage.id })
        .eq("id", artifactId);
    });

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
            placeholders: [
              {
                position: "front",
                images: [
                  {
                    id: printifyImage.id,
                    x: 0.5,
                    y: 0.5,
                    scale: 1,
                    angle: 0,
                  },
                ],
              },
            ],
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
            printifyImageId: printifyImage.id,
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
      printifyImageId: printifyImage.id,
    };
  }
);
