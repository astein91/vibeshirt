import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadToStorage, getPublicUrl } from "@/lib/storage/client";
import { nanoid } from "nanoid";
import sharp from "sharp";

// POST /api/upload - Upload an image
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;
    const supabase = createServiceClient();

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Verify session exists
    const { data: session, error: sessionError } = await supabase
      .from("design_sessions")
      .select("id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get image metadata using Sharp
    const metadata = await sharp(buffer).metadata();

    // Generate unique storage key
    const ext = file.name.split(".").pop() || "png";
    const storageKey = `uploads/${sessionId}/${nanoid()}.${ext}`;

    // Upload to storage
    await uploadToStorage(storageKey, buffer, file.type);

    // Get public URL
    const storageUrl = getPublicUrl(storageKey);

    // Create artifact record
    const { data: artifact, error: artifactError } = await supabase
      .from("artifacts")
      .insert({
        session_id: sessionId,
        type: "UPLOAD",
        storage_url: storageUrl,
        storage_key: storageKey,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: buffer.length,
          originalName: file.name,
          hasAlpha: metadata.hasAlpha || false,
        },
      })
      .select()
      .single();

    if (artifactError) throw artifactError;

    return NextResponse.json(artifact, { status: 201 });
  } catch (error) {
    console.error("Failed to upload file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
