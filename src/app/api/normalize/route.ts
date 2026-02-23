import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

// POST /api/normalize - Normalize an image for printing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    if (!body.sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    if (!body.artifactId) {
      return NextResponse.json(
        { error: "Artifact ID is required" },
        { status: 400 }
      );
    }

    // Verify session and artifact exist
    const { data: artifact, error: artifactError } = await supabase
      .from("artifacts")
      .select("*")
      .eq("id", body.artifactId)
      .eq("session_id", body.sessionId)
      .single();

    if (artifactError || !artifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    // Create a job record
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        session_id: body.sessionId,
        type: "NORMALIZE_IMAGE",
        status: "PENDING",
        input: {
          artifactId: body.artifactId,
          removeBackground: body.removeBackground !== false,
          targetWidth: body.targetWidth || 3600,
          targetHeight: body.targetHeight || 4800,
          targetDpi: body.targetDpi || 300,
        },
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Trigger Inngest function
    await inngest.send({
      name: "artwork/normalize",
      data: {
        jobId: job.id,
        sessionId: body.sessionId,
        artifactId: body.artifactId,
        removeBackground: body.removeBackground !== false,
        targetWidth: body.targetWidth || 3600,
        targetHeight: body.targetHeight || 4800,
        targetDpi: body.targetDpi || 300,
      },
    });

    return NextResponse.json({
      jobId: job.id,
      status: "PENDING",
    }, { status: 202 });
  } catch (error) {
    console.error("Failed to trigger normalization:", error);
    return NextResponse.json(
      { error: "Failed to trigger normalization" },
      { status: 500 }
    );
  }
}
