import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";
import { migrateDesignState, isImageLayer } from "@/lib/design-state";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Must match PRINT_AREA in PhotoMockup.tsx
const PRINT_AREA_FRONT = { top: 0.24, left: 0.30, width: 0.40, height: 0.45 };

// Mockup fills the full OG image height with padding
const MOCKUP_H = 610;
const MOCKUP_W = Math.round(MOCKUP_H * (460 / 560)); // maintain aspect ratio
const IMG_W = size.width;
const IMG_H = size.height;

// Mockup centered in the full image
const MOCKUP_LEFT = Math.round((IMG_W - MOCKUP_W) / 2);
const MOCKUP_TOP = Math.round((IMG_H - MOCKUP_H) / 2);

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

    // Migrate design state to multi-layer format
    const multiState = migrateDesignState(session.design_state);
    const frontLayers = multiState.front;

    const { data: artifacts } = await supabase
      .from("artifacts")
      .select("id, storage_url, type, prompt")
      .eq("session_id", session.id)
      .in("type", ["NORMALIZED", "GENERATED"])
      .order("created_at", { ascending: false })
      .limit(10);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://vibeshirt-seven.vercel.app";
    const mockupUrl = `${appUrl}/mockups/bella-canvas-3001-front.png`;

    // Determine which artwork images to fetch
    const artworkUrlsToFetch: Array<{ url: string; artifactId: string }> = [];
    const frontImageLayers = frontLayers.filter(isImageLayer);
    if (frontImageLayers.length > 0) {
      for (const layer of frontImageLayers) {
        const artifact = artifacts?.find((a) => a.id === layer.artifactId);
        if (artifact) {
          artworkUrlsToFetch.push({ url: artifact.storage_url, artifactId: artifact.id });
        }
      }
      // If layer has empty artifactId (migrated from old format), use latest artifact
      if (artworkUrlsToFetch.length === 0 && frontImageLayers.some((l) => !l.artifactId)) {
        const fallbackArtifact =
          artifacts?.find((a) => a.type === "NORMALIZED") ||
          artifacts?.find((a) => a.type === "GENERATED");
        if (fallbackArtifact) {
          artworkUrlsToFetch.push({ url: fallbackArtifact.storage_url, artifactId: fallbackArtifact.id });
        }
      }
    } else {
      // No layers - use latest artifact
      const artifact =
        artifacts?.find((a) => a.type === "NORMALIZED") ||
        artifacts?.find((a) => a.type === "GENERATED");
      if (artifact) {
        artworkUrlsToFetch.push({ url: artifact.storage_url, artifactId: artifact.id });
      }
    }

    // Fetch mockup and all artwork images
    const mockupDataUrl = await fetchImageAsDataUrl(mockupUrl);
    if (!mockupDataUrl) {
      return fallbackImage();
    }

    const artworkDataUrls: Array<{ dataUrl: string; artifactId: string }> = [];
    for (const { url, artifactId } of artworkUrlsToFetch) {
      const dataUrl = await fetchImageAsDataUrl(url);
      if (dataUrl) {
        artworkDataUrls.push({ dataUrl, artifactId });
      }
    }

    // Build positioned artwork elements
    const artworkElements: Array<{
      dataUrl: string;
      left: number;
      top: number;
      width: number;
      height: number;
    }> = [];

    if (frontImageLayers.length > 0) {
      for (const layer of frontImageLayers) {
        const artData = artworkDataUrls.find((a) => a.artifactId === layer.artifactId)
          || artworkDataUrls[0]; // fallback for migrated empty artifactId
        if (!artData) continue;

        const ds = layer.designState;
        const artW = Math.round(PA_WIDTH * 0.8 * ds.scale);
        const artH = Math.round(PA_HEIGHT * 0.8 * ds.scale);
        const artCenterX = PA_LEFT + (ds.x / 100) * PA_WIDTH;
        const artCenterY = PA_TOP + (ds.y / 100) * PA_HEIGHT;

        artworkElements.push({
          dataUrl: artData.dataUrl,
          left: Math.round(artCenterX - artW / 2),
          top: Math.round(artCenterY - artH / 2),
          width: artW,
          height: artH,
        });
      }
    } else if (artworkDataUrls.length > 0) {
      // No layers - render single artwork centered
      const artW = Math.round(PA_WIDTH * 0.8);
      const artH = Math.round(PA_HEIGHT * 0.8);
      const artCenterX = PA_LEFT + 0.5 * PA_WIDTH;
      const artCenterY = PA_TOP + 0.5 * PA_HEIGHT;

      artworkElements.push({
        dataUrl: artworkDataUrls[0].dataUrl,
        left: Math.round(artCenterX - artW / 2),
        top: Math.round(artCenterY - artH / 2),
        width: artW,
        height: artH,
      });
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f1f5f9",
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
          {artworkElements.map((art, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={art.dataUrl}
              alt=""
              width={art.width}
              height={art.height}
              style={{
                position: "absolute",
                top: art.top,
                left: art.left,
              }}
            />
          ))}
          {/* Small branding badge */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              right: 24,
              display: "flex",
              alignItems: "center",
              backgroundColor: "rgba(15, 23, 42, 0.75)",
              color: "white",
              padding: "6px 16px",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            vibeshirt.com
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
