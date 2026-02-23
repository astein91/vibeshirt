import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Must match PRINT_AREA in PhotoMockup.tsx
const PRINT_AREA_FRONT = { top: 0.24, left: 0.30, width: 0.40, height: 0.45 };

// Mockup image dimensions within the OG image
const MOCKUP_W = 460;
const MOCKUP_H = 560;
const CONTAINER_W = 580;
const CONTAINER_H = 630;

// Mockup image offset (centered in container)
const MOCKUP_LEFT = Math.round((CONTAINER_W - MOCKUP_W) / 2);
const MOCKUP_TOP = Math.round((CONTAINER_H - MOCKUP_H) / 2);

// Print area in absolute pixels
const PA_LEFT = MOCKUP_LEFT + Math.round(MOCKUP_W * PRINT_AREA_FRONT.left);
const PA_TOP = MOCKUP_TOP + Math.round(MOCKUP_H * PRINT_AREA_FRONT.top);
const PA_WIDTH = Math.round(MOCKUP_W * PRINT_AREA_FRONT.width);
const PA_HEIGHT = Math.round(MOCKUP_H * PRINT_AREA_FRONT.height);

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

interface DesignState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
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
      .select("id, vibe_description, design_state")
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

    // Apply design state (default: centered, scale 1)
    const ds: DesignState = session.design_state || { x: 50, y: 50, scale: 1, rotation: 0 };

    // Artwork size: fit within ~80% of print area, then apply scale
    const artW = Math.round(PA_WIDTH * 0.8 * ds.scale);
    const artH = Math.round(PA_HEIGHT * 0.8 * ds.scale);

    // Position artwork center based on design state x/y (% of print area)
    const artCenterX = PA_LEFT + (ds.x / 100) * PA_WIDTH;
    const artCenterY = PA_TOP + (ds.y / 100) * PA_HEIGHT;
    const artLeft = Math.round(artCenterX - artW / 2);
    const artTop = Math.round(artCenterY - artH / 2);

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
              width: CONTAINER_W,
              height: CONTAINER_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mockupDataUrl}
              width={MOCKUP_W}
              height={MOCKUP_H}
              alt=""
            />
            {artworkDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artworkDataUrl}
                alt=""
                width={artW}
                height={artH}
                style={{
                  position: "absolute",
                  top: artTop,
                  left: artLeft,
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
