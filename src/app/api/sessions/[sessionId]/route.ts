import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { nanoid } from "nanoid";

type RouteParams = {
  params: Promise<{ sessionId: string }>;
};

// GET /api/sessions/[sessionId] - Get session with artifacts and recent messages
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const supabase = createServiceClient();

    const { data: session, error } = await supabase
      .from("design_sessions")
      .select(`
        *,
        messages ( * ),
        artifacts ( * ),
        jobs ( * )
      `)
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Sort in JS since Supabase embedded selects don't support order
    session.messages = (session.messages as Array<{ created_at: string }>)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 100);
    session.artifacts = (session.artifacts as Array<{ created_at: string }>)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    session.jobs = (session.jobs as Array<{ status: string; created_at: string }>)
      .filter((j) => j.status === "PENDING" || j.status === "RUNNING")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    // Auto-claim: if user is signed in and session has no owner, claim it
    const user = await getUser().catch(() => null);
    if (user?.id && !session.user_id) {
      await supabase
        .from("design_sessions")
        .update({ user_id: user.id })
        .eq("id", sessionId);
      session.user_id = user.id;
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to get session:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/[sessionId] - Update session
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    const updateData: Record<string, unknown> = {};

    if (body.vibeDescription !== undefined) {
      updateData.vibe_description = body.vibeDescription;
    }
    if (body.artworkPrompt !== undefined) {
      updateData.artwork_prompt = body.artworkPrompt;
    }
    if (body.printfulConfig !== undefined) {
      updateData.printful_config = body.printfulConfig;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.designState !== undefined) {
      updateData.design_state = body.designState;
    }
    if (body.productId !== undefined) {
      updateData.product_id = body.productId;
    }
    if (body.orderId !== undefined) {
      updateData.printful_order_id = body.orderId;
    }
    if (body.orderRecipient !== undefined) {
      updateData.order_recipient = body.orderRecipient;
    }
    if (body.orderedAt !== undefined) {
      updateData.ordered_at = body.orderedAt;
    }

    if (body.isPublic !== undefined) {
      updateData.is_public = body.isPublic;
      if (body.isPublic) {
        const { data: existing } = await supabase
          .from("design_sessions")
          .select("share_slug")
          .eq("id", sessionId)
          .single();
        if (!existing?.share_slug) {
          updateData.share_slug = nanoid(8);
        }
      }
    }

    const { data: session, error } = await supabase
      .from("design_sessions")
      .update(updateData)
      .eq("id", sessionId)
      .select(`
        *,
        messages ( * ),
        artifacts ( * )
      `)
      .single();

    if (error) throw error;

    // Sort embedded
    session.messages = (session.messages as Array<{ created_at: string }>)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 100);
    session.artifacts = (session.artifacts as Array<{ created_at: string }>)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to update session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[sessionId] - Delete session
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("design_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
