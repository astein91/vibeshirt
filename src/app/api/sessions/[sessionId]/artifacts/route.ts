import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

type RouteParams = {
  params: Promise<{ sessionId: string }>;
};

// GET /api/sessions/[sessionId]/artifacts - Get all artifacts for session
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const supabase = createServiceClient();

    let query = supabase
      .from("artifacts")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (type) {
      query = query.eq("type", type);
    }

    const { data: artifacts, error } = await query;
    if (error) throw error;

    return NextResponse.json(artifacts);
  } catch (error) {
    console.error("Failed to get artifacts:", error);
    return NextResponse.json(
      { error: "Failed to get artifacts" },
      { status: 500 }
    );
  }
}
