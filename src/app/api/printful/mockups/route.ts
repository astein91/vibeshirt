import { NextResponse } from "next/server";
import { getPrintfulClient } from "@/lib/printful/client";

// POST /api/printful/mockups - Create a mockup generation task
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, variantIds, imageUrl, placement = "front" } = body;

    if (!productId || !variantIds || !imageUrl) {
      return NextResponse.json(
        { error: "Missing required fields: productId, variantIds, imageUrl" },
        { status: 400 }
      );
    }

    const client = getPrintfulClient();

    // Create the mockup generation task
    const task = await client.createMockupTask(productId, {
      variant_ids: variantIds,
      format: "png",
      files: [
        {
          placement,
          image_url: imageUrl,
        },
      ],
    });

    return NextResponse.json({
      taskKey: task.task_key,
      status: task.status,
    });
  } catch (error) {
    console.error("Failed to create mockup task:", error);
    return NextResponse.json(
      { error: "Failed to create mockup task" },
      { status: 500 }
    );
  }
}

// GET /api/printful/mockups?taskKey=xxx - Get mockup task result
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const taskKey = url.searchParams.get("taskKey");

    if (!taskKey) {
      return NextResponse.json(
        { error: "Missing taskKey parameter" },
        { status: 400 }
      );
    }

    const client = getPrintfulClient();

    const result = await client.getMockupTaskResult(taskKey);

    if (result.status === "pending") {
      return NextResponse.json({
        status: "pending",
        taskKey,
      });
    }

    if (result.status === "error") {
      return NextResponse.json(
        { error: result.error || "Mockup generation failed" },
        { status: 500 }
      );
    }

    // Format the mockups response
    const mockups = result.mockups?.map((m) => ({
      placement: m.placement,
      variantIds: m.variant_ids,
      imageUrl: m.mockup_url,
      extras: m.extra?.map((e) => ({
        title: e.title,
        url: e.url,
      })),
    }));

    return NextResponse.json({
      status: "completed",
      taskKey,
      mockups,
    });
  } catch (error) {
    console.error("Failed to get mockup result:", error);
    return NextResponse.json(
      { error: "Failed to get mockup result" },
      { status: 500 }
    );
  }
}
