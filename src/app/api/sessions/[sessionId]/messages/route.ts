import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseUserIntent, generateResponse, generateImage, GenerateImageOptions } from "@/lib/gemini/generate";
import { uploadToStorage, getPublicUrl, getFromStorage } from "@/lib/storage/client";
import { nanoid } from "nanoid";

type RouteParams = {
  params: Promise<{ sessionId: string }>;
};

// GET /api/sessions/[sessionId]/messages - Get messages with optional polling
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const after = searchParams.get("after");
    const supabase = createServiceClient();

    let query = supabase
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (after) {
      query = query.gt("created_at", after);
    }

    const { data: messages, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      messages,
      cursor: messages && messages.length > 0
        ? messages[messages.length - 1].created_at
        : after,
    });
  } catch (error) {
    console.error("Failed to get messages:", error);
    return NextResponse.json(
      { error: "Failed to get messages" },
      { status: 500 }
    );
  }
}

// POST /api/sessions/[sessionId]/messages - Add a message
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Verify session exists and get recent artifacts
    const { data: session, error: sessionError } = await supabase
      .from("design_sessions")
      .select("*, artifacts(*)")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Sort artifacts desc
    const artifacts = (session.artifacts as Array<{ created_at: string }>)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);

    // Create the user message
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .insert({
        session_id: sessionId,
        role: body.role || "user",
        author_name: body.authorName || "Anonymous",
        content: body.content,
        artifact_id: body.artifactId || null,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Always trigger AI response for user messages
    const cleanedContent = body.content.replace(/@tailor/gi, "").trim();

    if (cleanedContent) {
      const intent = await parseUserIntent(cleanedContent);

      const contextSummary = `
Session vibe: ${session.vibe_description || "Not set yet"}
Current artwork prompt: ${session.artwork_prompt || "None"}
Recent artifacts: ${artifacts.length} images
Status: ${session.status}
`.trim();

      if (intent.type === "generate" || intent.type === "modify") {
        const prompt = intent.prompt || cleanedContent;
        const isModification = intent.type === "modify";

        const options: GenerateImageOptions = {};
        const latestArtifact = artifacts[0] as unknown as { id: string; storage_key: string } | undefined;
        let sourceArtifactId: string | null = null;

        if (isModification && latestArtifact?.storage_key) {
          try {
            const sourceImageBuffer = await getFromStorage(latestArtifact.storage_key);
            options.sourceImage = sourceImageBuffer;
            options.sourceImageMimeType = "image/png";
            sourceArtifactId = latestArtifact.id;
            console.log("[Messages] Using source artifact for modification:", sourceArtifactId);
          } catch (error) {
            console.warn("[Messages] Could not fetch source image:", error);
          }
        }

        // "Working on it" message
        await supabase.from("messages").insert({
          session_id: sessionId,
          role: "assistant",
          author_name: "Tailor",
          content: isModification
            ? `Got it! I'm modifying the design: "${prompt}". This might take a moment...`
            : `Got it! I'm creating a design based on "${prompt}". This might take a moment...`,
        });

        const result = await generateImage(prompt, options);

        if (result.success && result.imageData) {
          const storageKey = `generated/${sessionId}/${nanoid()}.png`;
          await uploadToStorage(storageKey, result.imageData, result.mimeType || "image/png");
          const storageUrl = getPublicUrl(storageKey);

          const { data: artifact } = await supabase
            .from("artifacts")
            .insert({
              session_id: sessionId,
              type: "GENERATED",
              storage_url: storageUrl,
              storage_key: storageKey,
              metadata: {
                format: "png",
                generatedAt: new Date().toISOString(),
                isModification,
              },
              prompt,
              source_artifact_id: sourceArtifactId,
            })
            .select()
            .single();

          await supabase
            .from("design_sessions")
            .update({
              artwork_prompt: prompt,
              status: "DESIGNING",
            })
            .eq("id", sessionId);

          await supabase.from("messages").insert({
            session_id: sessionId,
            role: "assistant",
            author_name: "Tailor",
            content: `Here's your design! Let me know if you'd like any changes.`,
            artifact_id: artifact?.id ?? null,
          });
        } else {
          await supabase.from("messages").insert({
            session_id: sessionId,
            role: "assistant",
            author_name: "Tailor",
            content: `Sorry, I couldn't generate that image. ${result.error || "Please try a different description."}`,
          });
        }
      } else {
        const reply = await generateResponse(contextSummary, cleanedContent);

        await supabase.from("messages").insert({
          session_id: sessionId,
          role: "assistant",
          author_name: "Tailor",
          content: reply,
        });
      }
    }

    return NextResponse.json({
      message,
      aiTriggered: true,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
