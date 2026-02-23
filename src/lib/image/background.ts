const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

export interface RemoveBackgroundResult {
  success: boolean;
  imageData?: Buffer;
  error?: string;
}

// Remove background using remove.bg API
export async function removeBackground(
  imageBuffer: Buffer
): Promise<RemoveBackgroundResult> {
  if (!REMOVE_BG_API_KEY) {
    console.warn("[Background] No remove.bg API key configured. Skipping background removal.");
    return {
      success: true,
      imageData: imageBuffer, // Return original if no API key
    };
  }

  try {
    const formData = new FormData();
    const uint8Array = new Uint8Array(imageBuffer);
    formData.append("image_file", new Blob([uint8Array]), "image.png");
    formData.append("size", "auto");
    formData.append("format", "png");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": REMOVE_BG_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Background] remove.bg API error:", error);
      return {
        success: false,
        error: `remove.bg API error: ${response.status}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      success: true,
      imageData: Buffer.from(arrayBuffer),
    };
  } catch (error) {
    console.error("[Background] Failed to remove background:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Simple background detection (checks if image likely has transparent background)
export async function hasTransparentBackground(imageBuffer: Buffer): Promise<boolean> {
  const sharp = await import("sharp");
  const metadata = await sharp.default(imageBuffer).metadata();

  if (!metadata.hasAlpha) {
    return false;
  }

  // Sample the corners to check for transparency
  const { data, info } = await sharp
    .default(imageBuffer)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  // Check corners for transparency
  const corners = [
    0, // top-left
    (info.width - 1) * 4, // top-right
    (info.height - 1) * info.width * 4, // bottom-left
    ((info.height - 1) * info.width + (info.width - 1)) * 4, // bottom-right
  ];

  let transparentCorners = 0;
  for (const offset of corners) {
    // Alpha channel is the 4th byte (index 3) for each pixel
    if (data[offset + 3] < 128) {
      transparentCorners++;
    }
  }

  // If at least 3 corners are transparent, likely has transparent background
  return transparentCorners >= 3;
}
