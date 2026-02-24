"use client";

import Image from "next/image";

interface PhotoMockupProps {
  color: string; // Hex color (used for fallback)
  productImage?: string; // Printful product image URL (already in correct color)
  className?: string;
  view?: "front" | "back";
  children?: React.ReactNode; // Design overlay
  showPrintArea?: boolean; // Show dashed print area bounding box
}

// Print area positioning as percentages of the mockup image
// These values work for standard t-shirt mockups
const PRINT_AREA = {
  front: {
    top: 24,     // % from top
    left: 30,    // % from left
    width: 40,   // % of image width
    height: 45,  // % of image height
  },
  back: {
    top: 22,
    left: 30,
    width: 40,
    height: 47,
  },
};

export function PhotoMockup({
  color = "#FFFFFF",
  productImage,
  className = "",
  view = "front",
  children,
  showPrintArea = false,
}: PhotoMockupProps) {
  // Use Printful product image if available, otherwise fall back to local mockup
  const usePrintfulImage = !!productImage;
  const imageSrc = productImage || (view === "front"
    ? "/mockups/bella-canvas-3001-front.png"
    : "/mockups/bella-canvas-3001-back.png");

  const printArea = PRINT_AREA[view];

  // Only apply color overlay for fallback images (non-Printful)
  const needsColorOverlay = !usePrintfulImage &&
    color.toUpperCase() !== "#FFFFFF" &&
    color.toUpperCase() !== "#FFF";

  return (
    <div className={`relative ${className}`}>
      {/* Base t-shirt image */}
      <div className="relative w-full aspect-square bg-gray-50 rounded-lg overflow-hidden">
        <Image
          src={imageSrc}
          alt={`T-shirt ${view} view`}
          fill
          className="object-contain"
          priority
          unoptimized={usePrintfulImage} // Skip optimization for external URLs
        />

        {/* Color overlay using multiply blend mode (only for fallback) */}
        {needsColorOverlay && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: color,
              mixBlendMode: "multiply",
            }}
          />
        )}

        {/* Luminosity layer to preserve highlights/shadows (only for fallback) */}
        {needsColorOverlay && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${imageSrc})`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              mixBlendMode: "luminosity",
              opacity: 0.3,
            }}
          />
        )}
      </div>

      {/* Print area bounding box */}
      {showPrintArea && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            top: `${printArea.top}%`,
            left: `${printArea.left}%`,
            width: `${printArea.width}%`,
            height: `${printArea.height}%`,
          }}
        >
          <div className="w-full h-full border-2 border-dashed border-gray-400/50 rounded-sm" />
        </div>
      )}

      {/* Design overlay area */}
      {children && (
        <div
          className="absolute pointer-events-none overflow-hidden"
          style={{
            top: `${printArea.top}%`,
            left: `${printArea.left}%`,
            width: `${printArea.width}%`,
            height: `${printArea.height}%`,
          }}
        >
          <div className="relative w-full h-full flex items-center justify-center pointer-events-auto">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
