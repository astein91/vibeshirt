import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { nanoid } from "nanoid";

// POST /api/sessions - Create a new design session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const user = await getUser().catch(() => null);
    const supabase = createServiceClient();

    const { data: session, error } = await supabase
      .from("design_sessions")
      .insert({
        vibe_description: body.vibeDescription || null,
        share_slug: nanoid(8),
        user_id: user?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    // Create initial system message
    await supabase.from("messages").insert({
      session_id: session.id,
      role: "assistant",
      author_name: "Tailor",
      content: "Hey! I'm Tailor, your AI design assistant. Tell me about the vibe you want for your shirt - just describe it and I'll create designs for you!",
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// GET /api/sessions - List sessions or find by share slug
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const shareSlug = request.nextUrl.searchParams.get("shareSlug");

    if (shareSlug) {
      const { data: session, error } = await supabase
        .from("design_sessions")
        .select("*, messages(count), artifacts(count)")
        .eq("share_slug", shareSlug)
        .eq("is_public", true)
        .single();

      if (error || !session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(session);
    }

    const { data: sessions, error } = await supabase
      .from("design_sessions")
      .select("*, messages(count), artifacts(count)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Failed to list sessions:", error);
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 }
    );
  }
}
