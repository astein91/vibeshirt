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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when toolbar appears
  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 space-y-3 w-full max-w-lg mx-auto">
      {/* Text input */}
      <textarea
        ref={textareaRef}
        value={layer.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        placeholder="Enter text..."
        rows={2}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {/* Font selector */}
      <div className="relative">
        <button
          onClick={() => setShowFonts(!showFonts)}
          className="w-full flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        >
          <span style={{ fontFamily: `"${layer.fontFamily}", sans-serif` }}>
            {FONTS.find((f) => f.family === layer.fontFamily)?.label || layer.fontFamily}
          </span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", showFonts && "rotate-180")} />
        </button>
        {showFonts && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-auto">
            {FONTS.map((font) => (
              <button
                key={font.family}
                onClick={() => {
                  onUpdate({ fontFamily: font.family });
                  setShowFonts(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                  layer.fontFamily === font.family && "bg-primary/10 text-primary"
                )}
                style={{ fontFamily: `"${font.family}", sans-serif` }}
              >
                {font.label}
                <span className="text-xs text-muted-foreground ml-2">{font.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Size + style row */}
      <div className="flex items-center gap-2">
        {/* Font size */}
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-muted-foreground w-6">{layer.fontSize}</span>
          <input
            type="range"
            min={12}
            max={120}
            value={layer.fontSize}
            onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
            className="flex-1 h-1.5 accent-primary"
          />
        </div>

        {/* Bold */}
        <Button
          variant={layer.fontWeight === "bold" ? "default" : "outline"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onUpdate({ fontWeight: layer.fontWeight === "bold" ? "normal" : "bold" })}
        >
          <Bold className="h-4 w-4" />
        </Button>

        {/* Italic */}
        <Button
          variant={layer.fontStyle === "italic" ? "default" : "outline"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onUpdate({ fontStyle: layer.fontStyle === "italic" ? "normal" : "italic" })}
        >
          <Italic className="h-4 w-4" />
        </Button>

        {/* Alignment */}
        {(["left", "center", "right"] as const).map((align) => {
          const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
          return (
            <Button
              key={align}
              variant={layer.textAlign === align ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onUpdate({ textAlign: align })}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>

      {/* Color row */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-1 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onUpdate({ fontColor: color })}
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
          className="w-8 h-8 rounded cursor-pointer border-0"
        />
      </div>

      {/* Letter spacing + delete */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Spacing</span>
        <input
          type="range"
          min={-2}
          max={20}
          value={layer.letterSpacing}
          onChange={(e) => onUpdate({ letterSpacing: parseInt(e.target.value) })}
          className="flex-1 h-1.5 accent-primary"
        />
        <span className="text-xs text-muted-foreground w-6">{layer.letterSpacing}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
