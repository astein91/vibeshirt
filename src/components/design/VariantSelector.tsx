"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Variant {
  id: number;
  title: string;
  color: string;
  size: string;
  price: number;
  isEnabled: boolean;
}

interface VariantSelectorProps {
  variants: Variant[];
  onVariantsChange: (variants: Variant[]) => void;
}

export function VariantSelector({
  variants,
  onVariantsChange,
}: VariantSelectorProps) {
  // Group variants by color
  const colorGroups = variants.reduce<Record<string, Variant[]>>((acc, v) => {
    if (!acc[v.color]) acc[v.color] = [];
    acc[v.color].push(v);
    return acc;
  }, {});

  // Get unique sizes
  const sizes = [...new Set(variants.map((v) => v.size))];

  const [selectedColor, setSelectedColor] = useState<string>(
    Object.keys(colorGroups)[0] || ""
  );

  const toggleVariant = (variantId: number) => {
    const updated = variants.map((v) =>
      v.id === variantId ? { ...v, isEnabled: !v.isEnabled } : v
    );
    onVariantsChange(updated);
  };

  const toggleColor = (color: string, enable: boolean) => {
    const updated = variants.map((v) =>
      v.color === color ? { ...v, isEnabled: enable } : v
    );
    onVariantsChange(updated);
  };

  const toggleSize = (size: string, enable: boolean) => {
    const updated = variants.map((v) =>
      v.size === size ? { ...v, isEnabled: enable } : v
    );
    onVariantsChange(updated);
  };

  const enabledCount = variants.filter((v) => v.isEnabled).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Variants</h3>
        <Badge variant="outline">
          {enabledCount} of {variants.length} enabled
        </Badge>
      </div>

      {/* Color selection */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Colors</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(colorGroups).map((color) => {
            const colorVariants = colorGroups[color];
            const enabledInColor = colorVariants.filter((v) => v.isEnabled).length;
            const isSelected = selectedColor === color;

            return (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={cn(
                  "px-3 py-1 rounded-full text-sm border transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-muted hover:border-muted-foreground",
                  enabledInColor > 0 && "font-medium"
                )}
              >
                {color}
                {enabledInColor > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({enabledInColor})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Size selection for selected color */}
      {selectedColor && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Sizes for {selectedColor}
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleColor(selectedColor, true)}
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleColor(selectedColor, false)}
              >
                None
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {colorGroups[selectedColor]
              ?.sort((a, b) => {
                const sizeOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
                return sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size);
              })
              .map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => toggleVariant(variant.id)}
                  className={cn(
                    "px-3 py-1 rounded border transition-colors",
                    variant.isEnabled
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted hover:border-muted-foreground"
                  )}
                >
                  {variant.size}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Quick size toggles */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Quick size toggle</p>
        <div className="flex flex-wrap gap-2">
          {sizes
            .sort((a, b) => {
              const sizeOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
              return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
            })
            .map((size) => {
              const sizeVariants = variants.filter((v) => v.size === size);
              const enabledInSize = sizeVariants.filter((v) => v.isEnabled).length;

              return (
                <button
                  key={size}
                  onClick={() =>
                    toggleSize(size, enabledInSize < sizeVariants.length)
                  }
                  className={cn(
                    "px-2 py-1 rounded text-xs border transition-colors",
                    enabledInSize === sizeVariants.length
                      ? "border-primary bg-primary/10"
                      : enabledInSize > 0
                        ? "border-primary/50"
                        : "border-muted hover:border-muted-foreground"
                  )}
                >
                  {size} ({enabledInSize})
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
