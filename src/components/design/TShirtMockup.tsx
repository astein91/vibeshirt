"use client";

import { useMemo } from "react";

interface TShirtMockupProps {
  color: string; // Hex color
  className?: string;
  view?: "front" | "back";
  children?: React.ReactNode; // Design overlay
}

// Realistic t-shirt SVG mockup inspired by CustomInk style
export function TShirtMockup({
  color = "#FFFFFF",
  className = "",
  view = "front",
  children,
}: TShirtMockupProps) {
  // Calculate shadow/highlight colors based on base color
  const colors = useMemo(() => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // Darken for shadows
    const shadowR = Math.max(0, Math.floor(r * 0.7));
    const shadowG = Math.max(0, Math.floor(g * 0.7));
    const shadowB = Math.max(0, Math.floor(b * 0.7));
    const shadow = `rgb(${shadowR}, ${shadowG}, ${shadowB})`;

    // Even darker for deep shadows
    const deepShadowR = Math.max(0, Math.floor(r * 0.5));
    const deepShadowG = Math.max(0, Math.floor(g * 0.5));
    const deepShadowB = Math.max(0, Math.floor(b * 0.5));
    const deepShadow = `rgb(${deepShadowR}, ${deepShadowG}, ${deepShadowB})`;

    // Lighten for highlights
    const highlightR = Math.min(255, Math.floor(r + (255 - r) * 0.3));
    const highlightG = Math.min(255, Math.floor(g + (255 - g) * 0.3));
    const highlightB = Math.min(255, Math.floor(b + (255 - b) * 0.3));
    const highlight = `rgb(${highlightR}, ${highlightG}, ${highlightB})`;

    return { base: color, shadow, deepShadow, highlight };
  }, [color]);

  const gradientId = useMemo(() => `shirt-gradient-${Math.random().toString(36).slice(2)}`, []);
  const shadowGradientId = `${gradientId}-shadow`;
  const highlightGradientId = `${gradientId}-highlight`;
  const bodyGradientId = `${gradientId}-body`;

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 400 480"
        className="w-full h-full"
        style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }}
      >
        <defs>
          {/* Main body gradient for fabric effect */}
          <linearGradient id={bodyGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.highlight} />
            <stop offset="30%" stopColor={colors.base} />
            <stop offset="70%" stopColor={colors.base} />
            <stop offset="100%" stopColor={colors.shadow} />
          </linearGradient>

          {/* Shadow gradient for folds */}
          <linearGradient id={shadowGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.shadow} stopOpacity="0.3" />
            <stop offset="50%" stopColor={colors.shadow} stopOpacity="0" />
            <stop offset="100%" stopColor={colors.shadow} stopOpacity="0.2" />
          </linearGradient>

          {/* Highlight gradient */}
          <radialGradient id={highlightGradientId} cx="30%" cy="20%" r="50%">
            <stop offset="0%" stopColor={colors.highlight} stopOpacity="0.4" />
            <stop offset="100%" stopColor={colors.highlight} stopOpacity="0" />
          </radialGradient>

          {/* Clip path for design area */}
          <clipPath id={`${gradientId}-design-clip`}>
            <rect x="120" y="140" width="160" height="200" rx="4" />
          </clipPath>
        </defs>

        {/* Left sleeve */}
        <path
          d={view === "front"
            ? "M30 85 Q20 90 10 130 Q5 160 15 180 L55 165 Q60 140 65 115 Q60 95 55 85 Z"
            : "M30 85 Q20 90 10 130 Q5 160 15 180 L55 165 Q60 140 65 115 Q60 95 55 85 Z"
          }
          fill={`url(#${bodyGradientId})`}
          stroke={colors.shadow}
          strokeWidth="1"
        />
        {/* Left sleeve shadow */}
        <path
          d="M30 85 Q35 100 40 130 Q42 150 45 165 L55 165 Q60 140 65 115 Q60 95 55 85 Z"
          fill={colors.shadow}
          opacity="0.15"
        />

        {/* Right sleeve */}
        <path
          d={view === "front"
            ? "M370 85 Q380 90 390 130 Q395 160 385 180 L345 165 Q340 140 335 115 Q340 95 345 85 Z"
            : "M370 85 Q380 90 390 130 Q395 160 385 180 L345 165 Q340 140 335 115 Q340 95 345 85 Z"
          }
          fill={`url(#${bodyGradientId})`}
          stroke={colors.shadow}
          strokeWidth="1"
        />
        {/* Right sleeve shadow */}
        <path
          d="M370 85 Q365 100 360 130 Q358 150 355 165 L345 165 Q340 140 335 115 Q340 95 345 85 Z"
          fill={colors.shadow}
          opacity="0.15"
        />

        {/* Main body */}
        <path
          d="M55 85
             Q80 75 120 65
             Q160 55 200 55
             Q240 55 280 65
             Q320 75 345 85
             L345 165
             Q340 180 335 200
             L335 450
             Q335 465 320 465
             L80 465
             Q65 465 65 450
             L65 200
             Q60 180 55 165
             Z"
          fill={`url(#${bodyGradientId})`}
          stroke={colors.shadow}
          strokeWidth="1"
        />

        {/* Body highlight overlay */}
        <path
          d="M55 85
             Q80 75 120 65
             Q160 55 200 55
             Q240 55 280 65
             Q320 75 345 85
             L345 165
             Q340 180 335 200
             L335 450
             Q335 465 320 465
             L80 465
             Q65 465 65 450
             L65 200
             Q60 180 55 165
             Z"
          fill={`url(#${highlightGradientId})`}
        />

        {/* Collar */}
        {view === "front" ? (
          <>
            {/* Front crew neck */}
            <ellipse
              cx="200"
              cy="70"
              rx="45"
              ry="25"
              fill={colors.deepShadow}
            />
            <ellipse
              cx="200"
              cy="68"
              rx="40"
              ry="20"
              fill={colors.shadow}
            />
            {/* Collar rim */}
            <path
              d="M155 65 Q165 50 200 48 Q235 50 245 65 Q235 60 200 58 Q165 60 155 65"
              fill={colors.base}
              stroke={colors.shadow}
              strokeWidth="1"
            />
          </>
        ) : (
          <>
            {/* Back neck - simpler */}
            <path
              d="M160 60 Q180 55 200 55 Q220 55 240 60 Q230 65 200 67 Q170 65 160 60"
              fill={colors.shadow}
              stroke={colors.deepShadow}
              strokeWidth="1"
            />
          </>
        )}

        {/* Fabric fold lines for realism */}
        <g opacity="0.1" stroke={colors.deepShadow} strokeWidth="1" fill="none">
          {/* Vertical fold hints */}
          <path d="M150 200 Q148 280 152 360" />
          <path d="M250 200 Q252 280 248 360" />
          {/* Horizontal fold at waist */}
          <path d="M80 350 Q200 355 320 350" />
          {/* Shoulder seams */}
          <path d="M55 90 Q100 100 120 95" />
          <path d="M345 90 Q300 100 280 95" />
        </g>

        {/* Side seam shadows */}
        <path
          d="M65 170 L65 450"
          stroke={colors.shadow}
          strokeWidth="3"
          opacity="0.2"
        />
        <path
          d="M335 170 L335 450"
          stroke={colors.shadow}
          strokeWidth="3"
          opacity="0.2"
        />

        {/* Bottom hem shadow */}
        <path
          d="M80 460 Q200 470 320 460"
          stroke={colors.shadow}
          strokeWidth="2"
          fill="none"
          opacity="0.3"
        />

        {/* Design area indicator (subtle) */}
        <rect
          x="120"
          y="140"
          width="160"
          height="200"
          rx="4"
          fill="none"
          stroke={colors.shadow}
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.2"
        />
      </svg>

      {/* Design overlay area */}
      {children && (
        <div
          className="absolute"
          style={{
            top: "29%",
            left: "30%",
            width: "40%",
            height: "42%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
