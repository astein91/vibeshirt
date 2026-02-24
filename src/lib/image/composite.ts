import { createCanvas, loadImage, type CanvasRenderingContext2D as NodeCanvasCtx } from "canvas";
import {
  type Layer,
  type MultiSideDesignState,
  isTextLayer,
  isImageLayer,
} from "@/lib/design-state";

interface ArtifactInfo {
  storage_url: string;
  storage_key: string;
}

/**
 * Composite all layers (image + text) for a given side into a single PNG buffer.
 * Renders at full print resolution.
 */
export async function compositeDesignToImage(
  layers: Layer[],
  artifactMap: Record<string, ArtifactInfo>,
  printArea: { width: number; height: number }
): Promise<Buffer> {
  const { width, height } = printArea;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Transparent background
  ctx.clearRect(0, 0, width, height);

  // Sort layers by zIndex
  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of sorted) {
    const ds = layer.designState;

    // Calculate center position in pixels
    const cx = (ds.x / 100) * width;
    const cy = (ds.y / 100) * height;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((ds.rotation * Math.PI) / 180);
    ctx.scale(ds.scale, ds.scale);

    if (isTextLayer(layer)) {
      // Render text
      const fontStyle = layer.fontStyle === "italic" ? "italic" : "";
      const fontWeight = layer.fontWeight === "bold" ? "bold" : "";
      // Scale fontSize proportionally to print resolution (preview is ~400px, print is ~3600px)
      const scaleFactor = width / 400;
      const fontSize = Math.round(layer.fontSize * scaleFactor);

      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${layer.fontFamily}", sans-serif`.trim();
      ctx.fillStyle = layer.fontColor;
      ctx.textAlign = layer.textAlign;
      ctx.textBaseline = "middle";

      const lines = layer.text.split("\n");
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const startY = -totalHeight / 2 + lineHeight / 2;

      // Alignment offset
      let alignX = 0;
      if (layer.textAlign === "left") alignX = -(width * 0.3);
      else if (layer.textAlign === "right") alignX = width * 0.3;

      if (layer.letterSpacing > 0) {
        // Manual letter spacing
        for (let i = 0; i < lines.length; i++) {
          const y = startY + i * lineHeight;
          drawTextWithSpacing(ctx, lines[i], alignX, y, layer.letterSpacing * scaleFactor);
        }
      } else {
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], alignX, startY + i * lineHeight);
        }
      }
    } else if (isImageLayer(layer)) {
      const info = artifactMap[layer.artifactId];
      if (info) {
        try {
          const img = await loadImage(info.storage_url);

          // Fit image within 80% of print area (matching preview logic)
          const maxW = width * 0.8;
          const maxH = height * 0.8;
          const ar = img.width / img.height;
          let drawW: number;
          let drawH: number;

          if (ar > maxW / maxH) {
            drawW = maxW;
            drawH = maxW / ar;
          } else {
            drawH = maxH;
            drawW = maxH * ar;
          }

          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } catch (err) {
          console.error(`[Composite] Failed to load image for layer ${layer.id}:`, err);
        }
      }
    }

    ctx.restore();
  }

  return canvas.toBuffer("image/png");
}

/** Draw text character by character with custom letter spacing */
function drawTextWithSpacing(
  ctx: NodeCanvasCtx,
  text: string,
  x: number,
  y: number,
  spacing: number
) {
  // Measure total width for alignment
  let totalWidth = 0;
  for (const char of text) {
    totalWidth += ctx.measureText(char).width + spacing;
  }
  totalWidth -= spacing; // Remove trailing spacing

  const align = ctx.textAlign;
  let startX = x;
  if (align === "center") startX = x - totalWidth / 2;
  else if (align === "right") startX = x - totalWidth;

  // Save/restore textAlign since we draw left-aligned characters
  const origAlign = ctx.textAlign;
  ctx.textAlign = "left";

  let currentX = startX;
  for (const char of text) {
    ctx.fillText(char, currentX, y);
    currentX += ctx.measureText(char).width + spacing;
  }

  ctx.textAlign = origAlign;
}
