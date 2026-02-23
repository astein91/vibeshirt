import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

// POST /api/generate - Trigger image generation
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

    if (!body.prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Verify session exists
    const { data: session, error: sessionError } = await supabase
      .from("design_sessions")
      .select("id")
      .eq("id", body.sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Create a job record
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        session_id: body.sessionId,
        type: "GENERATE_ARTWORK",
        status: "PENDING",
        input: {
          prompt: body.prompt,
          style: body.style || "default",
          sourceArtifactId: body.sourceArtifactId || null,
        },
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Update session with the prompt
    await supabase
      .from("design_sessions")
      .update({
        artwork_prompt: body.prompt,
        status: "DESIGNING",
      })
      .eq("id", body.sessionId);

    // Trigger Inngest function
    await inngest.send({
      name: "artwork/generate",
      data: {
        jobId: job.id,
        sessionId: body.sessionId,
        prompt: body.prompt,
        style: body.style || "default",
        sourceArtifactId: body.sourceArtifactId || null,
      },
    });

    return NextResponse.json({
      jobId: job.id,
      status: "PENDING",
    }, { status: 202 });
  } catch (error) {
    console.error("Failed to trigger generation:", error);
    return NextResponse.json(
      { error: "Failed to trigger generation" },
      { status: 500 }
    );
  }
}
