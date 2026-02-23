"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";

interface Artifact {
  id: string;
  type: string;
  storage_url: string;
  prompt: string | null;
  metadata: Record<string, unknown>;
}

interface PrintifyColor {
  name: string;
  hex: string;
  variantIds: number[];
}

interface PrintArea {
  position: string;
  width: number;
  height: number;
}

interface ProductVariants {
  blueprintId: number;
  printProviderId: number;
  colors: PrintifyColor[];
  sizes: string[];
  printAreas: PrintArea[];
}

interface CanvasPreviewProps {
  artifact: Artifact | null;
  shirtColor?: string;
  isLoading?: boolean;
  onArtifactSelect?: (artifact: Artifact) => void;
  recentArtifacts?: Artifact[];
  onColorChange?: (color: PrintifyColor) => void;
  onProductChange?: (blueprintId: number) => void;
}

// Curated list of popular t-shirt products
const PRODUCTS = [
  { id: 12, name: "Bella+Canvas 3001", description: "Unisex Jersey Tee" },
  { id: 6, name: "Gildan 5000", description: "Heavy Cotton Tee" },
  { id: 145, name: "Gildan 64000", description: "Softstyle T-Shirt" },
];

// Fallback colors if API fails
const FALLBACK_COLORS: PrintifyColor[] = [
  { name: "White", hex: "#FFFFFF", variantIds: [] },
  { name: "Black", hex: "#1A1A1A", variantIds: [] },
  { name: "Navy", hex: "#1F2937", variantIds: [] },
  { name: "Heather Grey", hex: "#9CA3AF", variantIds: [] },
  { name: "Red", hex: "#DC2626", variantIds: [] },
  { name: "Royal Blue", hex: "#2563EB", variantIds: [] },
];

export function CanvasPreview({
  artifact,
  shirtColor = "White",
  isLoading = false,
  onArtifactSelect,
  recentArtifacts = [],
  onColorChange,
  onProductChange,
}: CanvasPreviewProps) {
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0]);
  const [productData, setProductData] = useState<ProductVariants | null>(null);
  const [selectedColor, setSelectedColor] = useState<PrintifyColor | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [showAllColors, setShowAllColors] = useState(false);

  // Fetch product variants when product changes
  useEffect(() => {
    async function fetchProductData() {
      setLoadingProduct(true);
      try {
        const response = await fetch(`/api/printify/blueprints/${selectedProduct.id}/variants`);
        if (response.ok) {
          const data = await response.json();
          setProductData(data);
          // Set default color
          const defaultColor = data.colors.find((c: PrintifyColor) => c.name === "White")
            || data.colors.find((c: PrintifyColor) => c.name === "Black")
            || data.colors[0];
          setSelectedColor(defaultColor);
          onColorChange?.(defaultColor);
        } else {
          // Use fallback colors
          setProductData(null);
          setSelectedColor(FALLBACK_COLORS[0]);
        }
      } catch (error) {
        console.error("Failed to fetch product data:", error);
        setProductData(null);
        setSelectedColor(FALLBACK_COLORS[0]);
      } finally {
        setLoadingProduct(false);
      }
    }
    fetchProductData();
  }, [selectedProduct, onColorChange]);

  const colors = productData?.colors || FALLBACK_COLORS;
  const frontPrintArea = productData?.printAreas.find(p => p.position === "front");

  // Calculate aspect ratio for print area
  const printAreaAspect = frontPrintArea
    ? frontPrintArea.width / frontPrintArea.height
    : 0.82; // Default ~3:4 ratio

  const handleColorSelect = (color: PrintifyColor) => {
    setSelectedColor(color);
    onColorChange?.(color);
  };

  const handleProductSelect = (product: typeof PRODUCTS[0]) => {
    setSelectedProduct(product);
    onProductChange?.(product.id);
  };

  // Show limited colors initially, expand on click
  const displayedColors = showAllColors ? colors : colors.slice(0, 12);

  return (
    <div className="flex flex-col gap-4">
      {/* Product selector */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border bg-muted/50 p-1 gap-1">
          {PRODUCTS.map((product) => (
            <button
              key={product.id}
              onClick={() => handleProductSelect(product)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md transition-all",
                selectedProduct.id === product.id
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {product.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main preview */}
      <div className="relative aspect-[3/4] w-full max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
        {/* T-shirt background */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-colors duration-300"
          style={{ backgroundColor: selectedColor?.hex || "#FFFFFF" }}
        >
          {/* Shirt outline SVG */}
          <svg
            viewBox="0 0 200 250"
            className="w-full h-full"
            style={{
              opacity: 0.15,
              color: selectedColor?.hex === "#FFFFFF" || selectedColor?.hex === "#FAFAF9"
                ? "#000000"
                : "#FFFFFF"
            }}
            fill="currentColor"
          >
            <path d="M40 30 L70 10 L100 20 L130 10 L160 30 L180 60 L150 70 L150 220 L50 220 L50 70 L20 60 Z" />
          </svg>
        </div>

        {/* Print area guide (subtle border showing printable region) */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div
            className="relative border border-dashed border-black/10 rounded"
            style={{
              width: "60%",
              aspectRatio: printAreaAspect,
              maxHeight: "65%",
            }}
          >
            {/* Artwork overlay */}
            {loadingProduct ? (
              <Skeleton className="absolute inset-2 rounded" />
            ) : isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Skeleton className="w-3/4 h-3/4 rounded" />
              </div>
            ) : artifact ? (
              <div className="absolute inset-0 flex items-center justify-center p-2">
                <Image
                  src={artifact.storage_url}
                  alt={artifact.prompt || "Design"}
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground/60">
                <div>
                  <p className="text-sm font-medium">Design Area</p>
                  {frontPrintArea && (
                    <p className="text-xs mt-1">
                      {frontPrintArea.width} × {frontPrintArea.height}px
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Artifact type badge */}
        {artifact && (
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 text-xs"
          >
            {artifact.type}
          </Badge>
        )}

        {/* Product info badge */}
        <Badge
          variant="outline"
          className="absolute top-2 left-2 text-xs bg-background/80"
        >
          {selectedProduct.name}
        </Badge>
      </div>

      {/* Color picker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground">
            {selectedColor?.name || "Select color"}
          </span>
          <span className="text-xs text-muted-foreground">
            {colors.length} colors available
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {displayedColors.map((color) => (
            <button
              key={color.name}
              onClick={() => handleColorSelect(color)}
              className={cn(
                "w-7 h-7 rounded-full border-2 transition-all hover:scale-110",
                selectedColor?.name === color.name
                  ? "border-primary ring-2 ring-primary/20 scale-110"
                  : "border-muted-foreground/20 hover:border-muted-foreground/50"
              )}
              style={{
                backgroundColor: color.hex,
                boxShadow: color.hex === "#FFFFFF" ? "inset 0 0 0 1px rgba(0,0,0,0.1)" : undefined
              }}
              title={color.name}
            />
          ))}
        </div>
        {colors.length > 12 && (
          <button
            onClick={() => setShowAllColors(!showAllColors)}
            className="flex items-center justify-center gap-1 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", showAllColors && "rotate-180")} />
            {showAllColors ? "Show less" : `Show all ${colors.length} colors`}
          </button>
        )}
      </div>

      {/* Recent artifacts */}
      {recentArtifacts.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Previous designs
          </p>
          <div className="flex justify-center gap-2">
            {recentArtifacts.slice(0, 5).map((a) => (
              <button
                key={a.id}
                onClick={() => onArtifactSelect?.(a)}
                className={cn(
                  "w-12 h-12 rounded border-2 overflow-hidden transition-all",
                  artifact?.id === a.id
                    ? "border-primary"
                    : "border-muted hover:border-muted-foreground"
                )}
              >
                <Image
                  src={a.storage_url}
                  alt=""
                  width={48}
                  height={48}
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
