import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { nanoid } from "nanoid";

// POST /api/sessions/fork - Fork/remix a shared session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceSessionId } = body;

    if (!sourceSessionId) {
      return NextResponse.json(
        { error: "sourceSessionId is required" },
        { status: 400 }
      );
    }

    const user = await getUser().catch(() => null);
    const supabase = createServiceClient();

    // Fetch source session
    const { data: source, error: sourceError } = await supabase
      .from("design_sessions")
      .select("*")
      .eq("id", sourceSessionId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json(
        { error: "Source session not found" },
        { status: 404 }
      );
    }

    // Create new session based on source
    const { data: newSession, error: createError } = await supabase
      .from("design_sessions")
      .insert({
        vibe_description: source.vibe_description,
        design_state: source.design_state,
        share_slug: nanoid(8),
        user_id: user?.id ?? null,
      })
      .select()
      .single();

    if (createError) throw createError;

    // Find best artifact to copy (prefer NORMALIZED, then GENERATED)
    const { data: artifacts } = await supabase
      .from("artifacts")
      .select("*")
      .eq("session_id", sourceSessionId)
      .in("type", ["NORMALIZED", "GENERATED"])
      .order("created_at", { ascending: false })
      .limit(5);

    const artifactToCopy =
      artifacts?.find((a) => a.type === "NORMALIZED") ||
      artifacts?.find((a) => a.type === "GENERATED");

    if (artifactToCopy) {
      await supabase.from("artifacts").insert({
        session_id: newSession.id,
        type: artifactToCopy.type,
        storage_url: artifactToCopy.storage_url,
        storage_key: artifactToCopy.storage_key,
        metadata: artifactToCopy.metadata,
        prompt: artifactToCopy.prompt,
        source_artifact_id: artifactToCopy.id,
      });
    }

    // Create welcome message
    await supabase.from("messages").insert({
      session_id: newSession.id,
      role: "assistant",
      author_name: "Tailor",
      content:
        "This design was remixed from a shared session! I'm Tailor, your AI design assistant. You can ask me to modify this design, create something new, or just describe the vibe you're going for.",
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    console.error("Failed to fork session:", error);
    return NextResponse.json(
      { error: "Failed to fork session" },
      { status: 500 }
    );
  }
}
