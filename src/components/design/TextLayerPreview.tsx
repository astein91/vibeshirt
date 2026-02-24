"use client";

import { type TextLayer, designStateToTransform } from "@/lib/design-state";

interface TextLayerPreviewProps {
  layer: TextLayer;
  isDragging: boolean;
  isBeingDragged: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

export function TextLayerPreview({
  layer,
  isDragging,
  isBeingDragged,
  isSelected,
  onSelect,
}: TextLayerPreviewProps) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        transform: designStateToTransform(layer.designState),
        transition: isBeingDragged ? "none" : "transform 0.15s ease-out",
        zIndex: layer.zIndex,
      }}
    >
      <div
        className="pointer-events-auto cursor-move select-none"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        style={{
          fontFamily: `"${layer.fontFamily}", sans-serif`,
          fontSize: `${layer.fontSize}px`,
          color: layer.fontColor,
          fontWeight: layer.fontWeight,
          fontStyle: layer.fontStyle,
          textAlign: layer.textAlign,
          letterSpacing: `${layer.letterSpacing}px`,
          whiteSpace: "pre-wrap",
          lineHeight: 1.2,
          textShadow: "0 1px 3px rgba(0,0,0,0.3)",
          outline: isSelected ? "2px solid rgba(139, 92, 246, 0.8)" : "none",
          outlineOffset: "4px",
          borderRadius: "2px",
          padding: "2px 4px",
        }}
      >
        {layer.text || "Your Text"}
      </div>
    </div>
  );
}
