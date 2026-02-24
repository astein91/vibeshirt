"use client";

import { useState, useRef, useEffect } from "react";
import { type TextLayer } from "@/lib/design-state";
import { FONTS } from "@/lib/fonts";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  ChevronDown,
  Minus,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TextToolbarProps {
  layer: TextLayer;
  onUpdate: (props: Partial<Omit<TextLayer, "id" | "type" | "designState" | "zIndex">>) => void;
  onDelete: () => void;
}

const PRESET_COLORS = [
  "#FFFFFF", "#000000", "#EF4444", "#F97316", "#EAB308",
  "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6",
];

export function TextToolbar({ layer, onUpdate, onDelete }: TextToolbarProps) {
  const [showFonts, setShowFonts] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const fontsRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click — use click (not mousedown) to avoid
  // conflicts with the toolbar's onMouseDown stopPropagation
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showFonts && fontsRef.current && !fontsRef.current.contains(e.target as Node)) {
        setShowFonts(false);
      }
      if (showColors && colorsRef.current && !colorsRef.current.contains(e.target as Node)) {
        setShowColors(false);
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [showFonts, showColors]);

  const fontLabel = FONTS.find((f) => f.family === layer.fontFamily)?.label || layer.fontFamily;

  return (
    <div
      className="flex items-center gap-1 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-2 py-1.5 flex-wrap"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Font selector */}
      <div className="relative" ref={fontsRef}>
        <button
          onClick={() => { setShowFonts(!showFonts); setShowColors(false); }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-muted/50 transition-colors max-w-[90px] truncate"
          style={{ fontFamily: `"${layer.fontFamily}", sans-serif` }}
        >
          {fontLabel}
          <ChevronDown className={cn("w-3 h-3 shrink-0 transition-transform", showFonts && "rotate-180")} />
        </button>
        {showFonts && (
          <div className="absolute z-50 top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-52 w-44 overflow-auto">
            {FONTS.map((font) => (
              <button
                key={font.family}
                onClick={() => {
                  onUpdate({ fontFamily: font.family });
                  setShowFonts(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors",
                  layer.fontFamily === font.family && "bg-primary/10 text-primary"
                )}
                style={{ fontFamily: `"${font.family}", sans-serif` }}
              >
                {font.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Font size */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onUpdate({ fontSize: Math.max(12, layer.fontSize - 2) })}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted/50 text-muted-foreground"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-xs font-mono w-6 text-center">{layer.fontSize}</span>
        <button
          onClick={() => onUpdate({ fontSize: Math.min(120, layer.fontSize + 2) })}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted/50 text-muted-foreground"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Bold / Italic */}
      <Button
        variant={layer.fontWeight === "bold" ? "default" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onUpdate({ fontWeight: layer.fontWeight === "bold" ? "normal" : "bold" })}
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant={layer.fontStyle === "italic" ? "default" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onUpdate({ fontStyle: layer.fontStyle === "italic" ? "normal" : "italic" })}
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-5 bg-border" />

      {/* Alignment */}
      {(["left", "center", "right"] as const).map((align) => {
        const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
        return (
          <Button
            key={align}
            variant={layer.textAlign === align ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onUpdate({ textAlign: align })}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        );
      })}

      <div className="w-px h-5 bg-border" />

      {/* Color swatch + picker */}
      <div className="relative" ref={colorsRef}>
        <button
          onClick={() => { setShowColors(!showColors); setShowFonts(false); }}
          className="w-7 h-7 rounded border-2 border-muted hover:border-muted-foreground/50 transition-colors"
          style={{
            backgroundColor: layer.fontColor,
            boxShadow: layer.fontColor === "#FFFFFF" ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined,
          }}
        />
        {showColors && (
          <div className="absolute z-50 top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-xl p-2">
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => { onUpdate({ fontColor: color }); setShowColors(false); }}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                    layer.fontColor === color
                      ? "border-primary ring-1 ring-primary/30 scale-110"
                      : "border-muted"
                  )}
                  style={{
                    backgroundColor: color,
                    boxShadow: color === "#FFFFFF" ? "inset 0 0 0 1px rgba(0,0,0,0.15)" : undefined,
                  }}
                />
              ))}
            </div>
            <input
              type="color"
              value={layer.fontColor}
              onChange={(e) => onUpdate({ fontColor: e.target.value })}
              className="w-full h-7 rounded cursor-pointer border-0"
            />
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
