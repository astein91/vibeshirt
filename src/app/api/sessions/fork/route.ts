import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { nanoid } from "nanoid";
import { migrateDesignState, getAllArtifactIds } from "@/lib/design-state";

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

    // Create new session based on source (design_state copied as-is, migration on read)
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

    // Collect all artifact IDs referenced by layers in the design state
    const multiState = migrateDesignState(source.design_state);
    const layerArtifactIds = getAllArtifactIds(multiState);

    // Fetch all referenced artifacts + fallback to latest
    const { data: artifacts } = await supabase
      .from("artifacts")
      .select("*")
      .eq("session_id", sourceSessionId)
      .in("type", ["NORMALIZED", "GENERATED"])
      .order("created_at", { ascending: false })
      .limit(10);

    // Determine which artifacts to copy: all layer-referenced ones, plus fallback
    const artifactIdsToCopy = new Set(layerArtifactIds);

    // If no layer artifacts found (old format), add the latest as fallback
    if (artifactIdsToCopy.size === 0) {
      const fallback =
        artifacts?.find((a) => a.type === "NORMALIZED") ||
        artifacts?.find((a) => a.type === "GENERATED");
      if (fallback) {
        artifactIdsToCopy.add(fallback.id);
      }
    }

    // Copy each artifact, building old-to-new ID mapping for design_state update
    const idMapping: Record<string, string> = {};
    for (const artId of artifactIdsToCopy) {
      const artifact = artifacts?.find((a) => a.id === artId);
      if (!artifact) continue;

      const { data: newArtifact } = await supabase
        .from("artifacts")
        .insert({
          session_id: newSession.id,
          type: artifact.type,
          storage_url: artifact.storage_url,
          storage_key: artifact.storage_key,
          metadata: artifact.metadata,
          prompt: artifact.prompt,
          source_artifact_id: artifact.id,
        })
        .select("id")
        .single();

      if (newArtifact) {
        idMapping[artId] = newArtifact.id;
      }
    }

    // Update design_state layer artifactIds to point to the new copies
    if (Object.keys(idMapping).length > 0 && multiState.front.length + multiState.back.length > 0) {
      const remapLayer = (l: (typeof multiState.front)[number]) => {
        if ("artifactId" in l && l.artifactId) {
          return { ...l, artifactId: idMapping[l.artifactId as string] || l.artifactId };
        }
        return l;
      };
      const updatedState = {
        ...multiState,
        front: multiState.front.map(remapLayer),
        back: multiState.back.map(remapLayer),
      };

      await supabase
        .from("design_sessions")
        .update({ design_state: updatedState })
        .eq("id", newSession.id);

      newSession.design_state = updatedState;
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
