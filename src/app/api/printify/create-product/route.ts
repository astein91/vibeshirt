import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";

// POST /api/printify/create-product - Create a Printify product
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

    if (!body.config) {
      return NextResponse.json(
        { error: "Product configuration is required" },
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

    // Verify artifact exists and is suitable
    const { data: artifact, error: artifactError } = await supabase
      .from("artifacts")
      .select("*")
      .eq("id", body.artifactId)
      .eq("session_id", body.sessionId)
      .in("type", ["GENERATED", "NORMALIZED"])
      .single();

    if (artifactError || !artifact) {
      return NextResponse.json(
        { error: "Artifact not found or not suitable for printing" },
        { status: 404 }
      );
    }

    // Create a job record
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        session_id: body.sessionId,
        type: "CREATE_PRODUCT",
        status: "PENDING",
        input: {
          artifactId: body.artifactId,
          config: body.config,
        },
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Trigger Inngest function
    await inngest.send({
      name: "printify/create-product",
      data: {
        jobId: job.id,
        sessionId: body.sessionId,
        artifactId: body.artifactId,
        config: body.config,
      },
    });

    return NextResponse.json({
      jobId: job.id,
      status: "PENDING",
    }, { status: 202 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
