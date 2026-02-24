"use client";

import { useRef, useEffect, useCallback, useState } from "react";
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
  const isLocalEdit = useRef(false);
  const [isHovered, setIsHovered] = useState(false);

  // Set initial content and sync from external changes
  useEffect(() => {
    if (editableRef.current && !isLocalEdit.current) {
      editableRef.current.innerText = layer.text || "Your Text";
    }
    isLocalEdit.current = false;
  }, [layer.text]);

  // Focus the contentEditable when selected
  useEffect(() => {
    if (isSelected && editableRef.current) {
      editableRef.current.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.selectAllChildren(editableRef.current);
        sel.collapseToEnd();
      }
    }
  }, [isSelected]);

  const handleInput = useCallback(() => {
    if (editableRef.current && onTextChange) {
      isLocalEdit.current = true;
      onTextChange(editableRef.current.innerText);
    }
  }, [onTextChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertLineBreak");
    }
    e.stopPropagation();
  }, []);

  const showOutline = isSelected || isHovered;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        transform: designStateToTransform(layer.designState),
        transition: isBeingDragged ? "none" : "transform 0.15s ease-out",
        zIndex: layer.zIndex,
      }}
    >
      {/* Selection/hover outline container with corner handles */}
      <div className="relative">
        <div
          ref={editableRef}
          contentEditable={isSelected}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={isSelected ? handleKeyDown : undefined}
          onMouseDown={(e) => {
            if (isSelected) {
              e.stopPropagation();
            }
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={
            isSelected
              ? "pointer-events-auto cursor-text"
              : "pointer-events-auto cursor-move select-none"
          }
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
            outline: isSelected
              ? "2px solid rgba(139, 92, 246, 0.8)"
              : isHovered
                ? "1px dashed rgba(139, 92, 246, 0.5)"
                : "none",
            outlineOffset: "4px",
            borderRadius: "2px",
            padding: "2px 6px",
            minWidth: "20px",
            caretColor: layer.fontColor,
            transition: "outline 0.15s ease",
          }}
        />
        {/* Corner drag handles when selected */}
        {isSelected && (
          <>
            {[
              { top: -3, left: -3 },
              { top: -3, right: -3 },
              { bottom: -3, left: -3 },
              { bottom: -3, right: -3 },
            ].map((pos, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-primary border border-white pointer-events-none"
                style={pos as React.CSSProperties}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
