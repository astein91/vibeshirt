import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${ct};base64,${base64}`;
  } catch {
    return null;
  }
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  try {
    const { sessionId: shareSlug } = await params;
    const supabase = createServiceClient();

    const { data: session } = await supabase
      .from("design_sessions")
      .select("id, vibe_description")
      .eq("share_slug", shareSlug)
      .eq("is_public", true)
      .single();

    if (!session) {
      return fallbackImage();
    }

    const { data: artifacts } = await supabase
      .from("artifacts")
      .select("storage_url, type, prompt")
      .eq("session_id", session.id)
      .in("type", ["NORMALIZED", "GENERATED"])
      .order("created_at", { ascending: false })
      .limit(5);

    const artifact =
      artifacts?.find((a) => a.type === "NORMALIZED") ||
      artifacts?.find((a) => a.type === "GENERATED");

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://vibeshirt-seven.vercel.app";
    const mockupUrl = `${appUrl}/mockups/bella-canvas-3001-front.png`;

    // Pre-fetch images as data URLs (required for Satori in serverless)
    const [mockupDataUrl, artworkDataUrl] = await Promise.all([
      fetchImageAsDataUrl(mockupUrl),
      artifact ? fetchImageAsDataUrl(artifact.storage_url) : null,
    ]);

    if (!mockupDataUrl) {
      return fallbackImage();
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            backgroundColor: "#f1f5f9",
          }}
        >
          {/* Left: T-shirt mockup */}
          <div
            style={{
              width: 580,
              height: 630,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mockupDataUrl}
              width={460}
              height={560}
              alt=""
            />
            {artworkDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artworkDataUrl}
                alt=""
                width={186}
                height={226}
                style={{
                  position: "absolute",
                  top: 151,
                  left: 197,
                }}
              />
            )}
          </div>

          {/* Right: Text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              paddingLeft: 20,
              paddingRight: 50,
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 42,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Vibeshirt
            </div>
            {session.vibe_description ? (
              <div
                style={{
                  fontSize: 24,
                  color: "#475569",
                  marginTop: 16,
                  lineHeight: 1.4,
                }}
              >
                {session.vibe_description}
              </div>
            ) : null}
            <div
              style={{
                fontSize: 18,
                color: "#94a3b8",
                marginTop: 24,
              }}
            >
              AI-designed custom t-shirt
            </div>
            <div
              style={{
                marginTop: 32,
                backgroundColor: "#0f172a",
                color: "white",
                padding: "12px 28px",
                borderRadius: 10,
                fontSize: 18,
                fontWeight: 600,
                display: "flex",
              }}
            >
              Remix This Design
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
  } catch (e) {
    console.error("OG image generation failed:", e);
    return fallbackImage();
  }
}

function fallbackImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f172a",
          color: "white",
          fontSize: 48,
          fontWeight: 800,
        }}
      >
        Vibeshirt
      </div>
    ),
    { ...size }
  );
}
