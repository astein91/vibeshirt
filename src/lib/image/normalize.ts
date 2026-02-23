import sharp from "sharp";

export interface NormalizeOptions {
  targetWidth?: number;
  targetHeight?: number;
  targetDpi?: number;
  maintainAspectRatio?: boolean;
  backgroundColor?: string;
}

export interface NormalizedImage {
  buffer: Buffer;
  width: number;
  height: number;
  dpi: number;
  format: string;
  hasAlpha: boolean;
}

// Default print-ready dimensions (12" x 16" at 300 DPI)
const DEFAULT_WIDTH = 3600;
const DEFAULT_HEIGHT = 4800;
const DEFAULT_DPI = 300;

// Normalize an image for T-shirt printing
export async function normalizeForPrint(
  imageBuffer: Buffer,
  options: NormalizeOptions = {}
): Promise<NormalizedImage> {
  const {
    targetWidth = DEFAULT_WIDTH,
    targetHeight = DEFAULT_HEIGHT,
    targetDpi = DEFAULT_DPI,
    maintainAspectRatio = true,
  } = options;

  // Load the image
  let image = sharp(imageBuffer);
  const metadata = await image.metadata();

  // Ensure we have PNG with alpha channel
  image = image.png({ compressionLevel: 9 });

  // Calculate resize dimensions
  let resizeWidth = targetWidth;
  let resizeHeight = targetHeight;

  if (maintainAspectRatio && metadata.width && metadata.height) {
    const aspectRatio = metadata.width / metadata.height;
    const targetAspectRatio = targetWidth / targetHeight;

    if (aspectRatio > targetAspectRatio) {
      // Image is wider - fit to width
      resizeWidth = targetWidth;
      resizeHeight = Math.round(targetWidth / aspectRatio);
    } else {
      // Image is taller - fit to height
      resizeHeight = targetHeight;
      resizeWidth = Math.round(targetHeight * aspectRatio);
    }
  }

  // Resize the image
  image = image.resize(resizeWidth, resizeHeight, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
  });

  // Set DPI metadata
  image = image.withMetadata({
    density: targetDpi,
  });

  // If we need to center on a canvas of the target size
  if (resizeWidth !== targetWidth || resizeHeight !== targetHeight) {
    const offsetX = Math.round((targetWidth - resizeWidth) / 2);
    const offsetY = Math.round((targetHeight - resizeHeight) / 2);

    image = image.extend({
      top: offsetY,
      bottom: targetHeight - resizeHeight - offsetY,
      left: offsetX,
      right: targetWidth - resizeWidth - offsetX,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  // Get the final buffer
  const buffer = await image.toBuffer();
  const finalMetadata = await sharp(buffer).metadata();

  return {
    buffer,
    width: finalMetadata.width || targetWidth,
    height: finalMetadata.height || targetHeight,
    dpi: targetDpi,
    format: "png",
    hasAlpha: true,
  };
}

// Optimize an image for web display (preview/mockup)
export async function optimizeForWeb(
  imageBuffer: Buffer,
  maxWidth = 800,
  maxHeight = 800
): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  let width = metadata.width || maxWidth;
  let height = metadata.height || maxHeight;

  // Calculate resize if needed
  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;
    if (width > height) {
      width = maxWidth;
      height = Math.round(maxWidth / aspectRatio);
    } else {
      height = maxHeight;
      width = Math.round(maxHeight * aspectRatio);
    }
  }

  return image
    .resize(width, height, { fit: "inside" })
    .webp({ quality: 85 })
    .toBuffer();
}

// Check if an image has transparency
export async function hasTransparency(imageBuffer: Buffer): Promise<boolean> {
  const metadata = await sharp(imageBuffer).metadata();
  return metadata.hasAlpha || false;
}

// Get image dimensions
export async function getImageDimensions(
  imageBuffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}
