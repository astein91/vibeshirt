"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Move,
  RotateCcw,
  Maximize2,
} from "lucide-react";
import {
  DesignState,
  DEFAULT_DESIGN_STATE,
  applyPositionCommand,
  designStateToTransform,
} from "@/lib/design-state";
import { PhotoMockup } from "./PhotoMockup";

interface Artifact {
  id: string;
  type: string;
  storage_url: string;
  prompt: string | null;
  metadata: Record<string, unknown>;
}

interface PrintfulColor {
  name: string;
  hex: string;
  hex2: string | null; // Secondary color for heathers
  variantIds: number[];
  image: string; // Color-specific product image from Printful
}

interface PrintArea {
  placement: string;
  title: string;
  width: number;
  height: number;
  dpi: number;
}

interface ProductData {
  product: {
    id: number;
    name: string;
    type: string;
    image: string;
  };
  colors: PrintfulColor[];
  sizes: { name: string; variantIds: number[] }[];
  printAreas: PrintArea[];
}

interface MockupPreview {
  imageUrl: string;
  placement: string;
}

interface InteractiveCanvasProps {
  artifact: Artifact | null;
  isLoading?: boolean;
  designState: DesignState;
  onDesignStateChange: (state: DesignState) => void;
  onArtifactSelect?: (artifact: Artifact) => void;
  recentArtifacts?: Artifact[];
  onColorChange?: (color: PrintfulColor) => void;
  onProductChange?: (productId: number) => void;
  onPrintAreaChange?: (printArea: PrintArea) => void;
  mockupPreview?: MockupPreview | null;
  isMockupLoading?: boolean;
}

// Curated list of popular t-shirt products from Printful
const PRODUCTS = [
  { id: 71, name: "Bella+Canvas 3001", description: "Unisex Staple Tee" },
  { id: 380, name: "Gildan 5000", description: "Men's Staple Tee" },
  { id: 586, name: "Stanley/Stella", description: "Organic Cotton Tee" },
];

// Fallback colors if API fails
const FALLBACK_COLORS: PrintfulColor[] = [
  { name: "White", hex: "#FFFFFF", hex2: null, variantIds: [], image: "" },
  { name: "Black", hex: "#1A1A1A", hex2: null, variantIds: [], image: "" },
  { name: "Navy", hex: "#1E3A5F", hex2: null, variantIds: [], image: "" },
  { name: "Red", hex: "#DC2626", hex2: null, variantIds: [], image: "" },
  { name: "Royal Blue", hex: "#1D4ED8", hex2: null, variantIds: [], image: "" },
  { name: "Forest Green", hex: "#166534", hex2: null, variantIds: [], image: "" },
  { name: "Heather Grey", hex: "#9CA3AF", hex2: null, variantIds: [], image: "" },
  { name: "Maroon", hex: "#7F1D1D", hex2: null, variantIds: [], image: "" },
];

export function InteractiveCanvas({
  artifact,
  isLoading = false,
  designState,
  onDesignStateChange,
  onArtifactSelect,
  recentArtifacts = [],
  onColorChange,
  onProductChange,
  onPrintAreaChange,
  mockupPreview,
  isMockupLoading = false,
}: InteractiveCanvasProps) {
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0]);
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [selectedColor, setSelectedColor] = useState<PrintfulColor>(FALLBACK_COLORS[0]);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [showAllColors, setShowAllColors] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, stateX: 50, stateY: 50 });
  const [view, setView] = useState<"front" | "back" | "mockup">("front");

  // Pinch-to-zoom state
  const isPinchingRef = useRef(false);
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);

  const designAreaRef = useRef<HTMLDivElement>(null);
  const hasFetchedInitialRef = useRef(false);
  const onPrintAreaChangeRef = useRef(onPrintAreaChange);
  const onColorChangeRef = useRef(onColorChange);

  // Keep refs up to date
  useEffect(() => {
    onPrintAreaChangeRef.current = onPrintAreaChange;
    onColorChangeRef.current = onColorChange;
  });

  // Fetch product variants from Printful when product changes
  useEffect(() => {
    let cancelled = false;

    async function fetchProductData() {
      setLoadingProduct(true);
      try {
        const response = await fetch(`/api/printful/products/${selectedProduct.id}`);
        if (response.ok && !cancelled) {
          const data = await response.json();
          setProductData(data);

          // Only set default color on first load for this product
          if (!hasFetchedInitialRef.current) {
            const defaultColor =
              data.colors.find((c: PrintfulColor) => c.name === "White") ||
              data.colors.find((c: PrintfulColor) => c.name === "Black") ||
              data.colors[0];
            if (defaultColor) {
              setSelectedColor(defaultColor);
            }
            hasFetchedInitialRef.current = true;
          }

          // Notify about print area (front placement)
          const frontPrintArea = data.printAreas?.find(
            (p: PrintArea) => p.placement === "front"
          );
          if (frontPrintArea) {
            onPrintAreaChangeRef.current?.(frontPrintArea);
          }
        } else if (!cancelled) {
          setProductData(null);
        }
      } catch (error) {
        console.error("Failed to fetch Printful product data:", error);
        if (!cancelled) {
          setProductData(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingProduct(false);
        }
      }
    }

    fetchProductData();

    return () => {
      cancelled = true;
    };
  }, [selectedProduct.id]);

  // Notify parent of color changes
  useEffect(() => {
    onColorChangeRef.current?.(selectedColor);
  }, [selectedColor]);

  const colors = productData?.colors || FALLBACK_COLORS;
  const frontPrintArea = productData?.printAreas?.find((p) => p.placement === "front");

  const handleColorSelect = useCallback((color: PrintfulColor) => {
    setSelectedColor(color);
  }, []);

  const handleProductSelect = useCallback((product: (typeof PRODUCTS)[0]) => {
    setSelectedProduct(product);
    hasFetchedInitialRef.current = false; // Reset to allow new default color
    onProductChange?.(product.id);
  }, [onProductChange]);

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!artifact) return;
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        stateX: designState.x,
        stateY: designState.y,
      });
    },
    [artifact, designState.x, designState.y]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !designAreaRef.current) return;

      const rect = designAreaRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;

      const newX = Math.min(100, Math.max(0, dragStart.stateX + deltaX));
      const newY = Math.min(100, Math.max(0, dragStart.stateY + deltaY));

      onDesignStateChange({
        ...designState,
        x: newX,
        y: newY,
      });
    },
    [isDragging, dragStart, designState, onDesignStateChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch handlers with pinch-to-zoom support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!artifact) return;

      if (e.touches.length === 2) {
        // Start pinch gesture
        isPinchingRef.current = true;
        setIsDragging(false);
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDistRef.current = Math.hypot(dx, dy);
        pinchStartScaleRef.current = designState.scale;
        return;
      }

      // Single-finger drag
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({
        x: touch.clientX,
        y: touch.clientY,
        stateX: designState.x,
        stateY: designState.y,
      });
    },
    [artifact, designState.x, designState.y, designState.scale]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!designAreaRef.current) return;

      if (isPinchingRef.current && e.touches.length === 2) {
        // Pinch zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const ratio = newDist / pinchStartDistRef.current;
        const newScale = Math.min(3, Math.max(0.1, pinchStartScaleRef.current * ratio));

        onDesignStateChange({
          ...designState,
          scale: newScale,
        });
        return;
      }

      if (!isDragging) return;
      const touch = e.touches[0];

      const rect = designAreaRef.current.getBoundingClientRect();
      const deltaX = ((touch.clientX - dragStart.x) / rect.width) * 100;
      const deltaY = ((touch.clientY - dragStart.y) / rect.height) * 100;

      const newX = Math.min(100, Math.max(0, dragStart.stateX + deltaX));
      const newY = Math.min(100, Math.max(0, dragStart.stateY + deltaY));

      onDesignStateChange({
        ...designState,
        x: newX,
        y: newY,
      });
    },
    [isDragging, dragStart, designState, onDesignStateChange]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
      }
      if (e.touches.length === 0) {
        setIsDragging(false);
      }
    },
    []
  );

  // Scroll-wheel zoom (desktop)
  const designStateRef = useRef(designState);
  designStateRef.current = designState;

  const onDesignStateChangeRef = useRef(onDesignStateChange);
  onDesignStateChangeRef.current = onDesignStateChange;

  useEffect(() => {
    const el = designAreaRef.current;
    if (!el || !artifact) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = designStateRef.current;
      const factor = e.deltaY < 0 ? 1.05 : 0.95;
      const newScale = Math.min(3, Math.max(0.1, state.scale * factor));
      onDesignStateChangeRef.current({
        ...state,
        scale: newScale,
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [artifact]);

  const handleCenter = () => {
    onDesignStateChange(
      applyPositionCommand(designState, { action: "center", preset: "center" })
    );
  };

  const handleReset = () => {
    onDesignStateChange(DEFAULT_DESIGN_STATE);
  };

  const handleRotate = () => {
    onDesignStateChange(
      applyPositionCommand(designState, { action: "rotate", rotation: 15 })
    );
  };

  const displayedColors = showAllColors ? colors : colors.slice(0, 12);

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {/* Product selector */}
      <div className="flex justify-center gap-2">
        {PRODUCTS.map((product) => {
          const isActive = selectedProduct.id === product.id;
          return (
            <button
              key={product.id}
              onClick={() => handleProductSelect(product)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left",
                isActive
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-muted-foreground/30 bg-background"
              )}
            >
              {productData?.product.id === product.id && productData.product.image ? (
                <Image
                  src={productData.product.image}
                  alt={product.name}
                  width={32}
                  height={32}
                  className="rounded object-contain"
                  unoptimized
                />
              ) : (
                <div className="w-8 h-8 rounded bg-muted" />
              )}
              <div>
                <p className="text-xs font-medium leading-tight">{product.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{product.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main preview area */}
      <div className="relative bg-gradient-to-b from-gray-100 to-gray-200 rounded-xl p-6 overflow-hidden">
        {/* View thumbnails */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {(["front", "back"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "w-12 h-12 rounded-md border-2 overflow-hidden transition-all bg-gray-50",
                view === v
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-background/80 hover:border-muted-foreground/50 opacity-70 hover:opacity-100"
              )}
              title={v === "front" ? "Front" : "Back"}
            >
              {selectedColor.image ? (
                <Image
                  src={selectedColor.image}
                  alt={`${v} view`}
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground capitalize">
                  {v}
                </div>
              )}
            </button>
          ))}
          {/* Mockup preview thumbnail */}
          {(mockupPreview || isMockupLoading) && (
            <button
              onClick={() => setView("mockup")}
              className={cn(
                "w-12 h-12 rounded-md border-2 overflow-hidden transition-all",
                view === "mockup"
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-background/80 hover:border-muted-foreground/50 opacity-70 hover:opacity-100"
              )}
              title="Preview"
            >
              {isMockupLoading ? (
                <Skeleton className="w-full h-full" />
              ) : mockupPreview ? (
                <Image
                  src={mockupPreview.imageUrl}
                  alt="Mockup preview"
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : null}
            </button>
          )}
        </div>

        {/* T-Shirt Photo Mockup */}
        <div className="relative aspect-square w-full max-w-md mx-auto">
          {view === "mockup" && mockupPreview ? (
            <div className="relative w-full aspect-square bg-gray-50 rounded-lg overflow-hidden">
              <Image
                src={mockupPreview.imageUrl}
                alt="Product mockup preview"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : loadingProduct ? (
            <Skeleton className="absolute inset-0 rounded-lg" />
          ) : (
            <PhotoMockup
              color={selectedColor.hex}
              productImage={selectedColor.image}
              view={view === "mockup" ? "front" : view}
              className="w-full h-full"
              showPrintArea={!artifact && !isDragging}
            >
              {/* Design overlay */}
              {isLoading ? (
                <Skeleton className="w-3/4 h-3/4 rounded" />
              ) : artifact ? (
                <div
                  ref={designAreaRef}
                  className={cn(
                    "relative w-full h-full cursor-move",
                    isDragging && "cursor-grabbing"
                  )}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      transform: designStateToTransform(designState),
                      transition: isDragging ? "none" : "transform 0.15s ease-out",
                    }}
                  >
                    <Image
                      src={artifact.storage_url}
                      alt={artifact.prompt || "Design"}
                      fill
                      className="object-contain pointer-events-none select-none"
                      draggable={false}
                    />
                    {/* Drag hint */}
                    {!isDragging && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <div className="bg-black/50 rounded-full p-2">
                          <Move className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground/40">
                  <div className="text-center">
                    <p className="text-sm font-medium">Design Area</p>
                    {frontPrintArea && (
                      <p className="text-xs mt-1">
                        {frontPrintArea.width} × {frontPrintArea.height}px
                      </p>
                    )}
                  </div>
                </div>
              )}
            </PhotoMockup>
          )}
        </div>

        {/* Position indicator */}
        {artifact && (
          <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground bg-background/80 px-2 py-1 rounded font-mono">
            {Math.round(designState.x)}%, {Math.round(designState.y)}% •{" "}
            {Math.round(designState.scale * 100)}%
            {designState.rotation !== 0 && ` • ${designState.rotation}°`}
          </div>
        )}
      </div>

      {/* Quick positioning controls */}
      {artifact && (
        <div className="flex justify-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleRotate}
            title="Rotate 15°"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleCenter}
            title="Center"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleReset}
          >
            Reset
          </Button>
        </div>
      )}

      {/* Color picker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full border border-gray-300"
              style={{ backgroundColor: selectedColor.hex }}
            />
            <span className="text-sm font-medium">{selectedColor.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {colors.length} colors
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {displayedColors.map((color) => (
            <button
              key={color.name}
              onClick={() => handleColorSelect(color)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                selectedColor.name === color.name
                  ? "border-primary ring-2 ring-primary/30 scale-110"
                  : "border-gray-200 hover:border-gray-400"
              )}
              style={{
                backgroundColor: color.hex,
                boxShadow:
                  color.hex.toUpperCase() === "#FFFFFF"
                    ? "inset 0 0 0 1px rgba(0,0,0,0.1)"
                    : undefined,
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
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform",
                showAllColors && "rotate-180"
              )}
            />
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
