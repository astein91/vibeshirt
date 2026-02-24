"use client";

import { useRef, useEffect, useCallback } from "react";
import { type TextLayer, designStateToTransform } from "@/lib/design-state";

interface TextLayerPreviewProps {
  layer: TextLayer;
  isDragging: boolean;
  isBeingDragged: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onTextChange?: (text: string) => void;
}

export function TextLayerPreview({
  layer,
  isDragging,
  isBeingDragged,
  isSelected,
  onSelect,
  onTextChange,
}: TextLayerPreviewProps) {
  const editableRef = useRef<HTMLDivElement>(null);

  // Focus the contentEditable when selected
  useEffect(() => {
    if (isSelected && editableRef.current) {
      editableRef.current.focus();
      // Place cursor at end
      const sel = window.getSelection();
      if (sel) {
        sel.selectAllChildren(editableRef.current);
        sel.collapseToEnd();
      }
    }
  }, [isSelected]);

  const handleInput = useCallback(() => {
    if (editableRef.current && onTextChange) {
      const text = editableRef.current.innerText;
      onTextChange(text);
    }
  }, [onTextChange]);

  // Prevent Enter from creating <div> tags — use plain newlines
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertLineBreak");
    }
    // Stop propagation so canvas shortcuts don't fire while typing
    e.stopPropagation();
  }, []);

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
        ref={editableRef}
        contentEditable={isSelected}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={isSelected ? handleKeyDown : undefined}
        onMouseDown={(e) => {
          if (isSelected) {
            // When already editing, let the cursor be placed without starting a drag
            e.stopPropagation();
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={isSelected ? "pointer-events-auto cursor-text" : "pointer-events-auto cursor-move select-none"}
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
          padding: "2px 6px",
          minWidth: "20px",
          caretColor: layer.fontColor,
        }}
      >
        {layer.text || "Your Text"}
      </div>
    </div>
  );
}
