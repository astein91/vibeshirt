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
  X,
  Plus,
} from "lucide-react";
import {
  type DesignState,
  type MultiSideDesignState,
  type Layer,
  type TextLayer,
  DEFAULT_DESIGN_STATE,
  MAX_SCALE,
  MIN_SCALE,
  applyPositionCommand,
  designStateToTransform,
  updateLayerDesignState,
  removeLayerFromSide,
  isTextLayer,
  isImageLayer,
} from "@/lib/design-state";
import { PhotoMockup } from "./PhotoMockup";
import { TextLayerPreview } from "./TextLayerPreview";
import { TextToolbar } from "./TextToolbar";
import { Type } from "lucide-react";

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
  hex2: string | null;
  variantIds: number[];
  image: string;
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
  multiState: MultiSideDesignState;
  allArtifacts: Artifact[];
  onMultiStateChange: (state: MultiSideDesignState) => void;
  onRemoveLayer: (layerId: string) => void;
  onAddLayerRequest?: () => void;
  onAddTextLayer?: () => void;
  selectedLayerId?: string | null;
  onSelectLayer?: (layerId: string | null) => void;
  onUpdateTextLayer?: (props: Partial<Omit<TextLayer, "id" | "type" | "designState" | "zIndex">>) => void;
  isLoading?: boolean;
  productId: number;
  onColorChange?: (color: PrintfulColor) => void;
  onPrintAreaChange?: (printArea: PrintArea) => void;
  onSizesChange?: (sizes: string[]) => void;
  mockupPreview?: MockupPreview | null;
  isMockupLoading?: boolean;
}

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

const MAX_LAYERS_PER_SIDE = 3;

/** Find artifact URL from allArtifacts by layer's artifactId (image layers only) */
function getArtifactForLayer(layer: Layer, allArtifacts: Artifact[]): Artifact | undefined {
  if (!isImageLayer(layer)) return undefined;
  return allArtifacts.find((a) => a.id === layer.artifactId);
}

export function InteractiveCanvas({
  multiState,
  allArtifacts,
  onMultiStateChange,
  onRemoveLayer,
  onAddLayerRequest,
  onAddTextLayer,
  selectedLayerId,
  onSelectLayer,
  onUpdateTextLayer,
  isLoading = false,
  productId,
  onColorChange,
  onPrintAreaChange,
  onSizesChange,
  mockupPreview,
  isMockupLoading = false,
}: InteractiveCanvasProps) {
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
  const onSizesChangeRef = useRef(onSizesChange);
  const draggedLayerIdRef = useRef<string | null>(null);

  // Keep refs up to date
  useEffect(() => {
    onPrintAreaChangeRef.current = onPrintAreaChange;
    onColorChangeRef.current = onColorChange;
    onSizesChangeRef.current = onSizesChange;
  });

  // Sync view with multiState.activeSide
  useEffect(() => {
    if (view !== "mockup") {
      setView(multiState.activeSide);
    }
  }, [multiState.activeSide]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get current side layers
  const activeSide = view === "mockup" ? multiState.activeSide : view;
  const currentSideLayers = multiState[activeSide] || [];
  const hasLayers = currentSideLayers.length > 0;
  const sortedLayers = [...currentSideLayers].sort((a, b) => a.zIndex - b.zIndex);

  // Fetch product variants from Printful
  useEffect(() => {
    let cancelled = false;

    async function fetchProductData() {
      setLoadingProduct(true);
      try {
        const response = await fetch(`/api/printful/products/${productId}`);
        if (response.ok && !cancelled) {
          const data = await response.json();
          setProductData(data);

          // Always reset color selection when product changes
          const defaultColor =
            data.colors.find((c: PrintfulColor) => c.name === "White") ||
            data.colors.find((c: PrintfulColor) => c.name === "Black") ||
            data.colors[0];
          if (defaultColor) {
            setSelectedColor(defaultColor);
          }

          const frontPrintArea = data.printAreas?.find(
            (p: PrintArea) => p.placement === "front"
          );
          if (frontPrintArea) {
            onPrintAreaChangeRef.current?.(frontPrintArea);
          }

          // Notify parent of available sizes
          if (data.sizes) {
            onSizesChangeRef.current?.(
              data.sizes.map((s: { name: string }) => s.name)
            );
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
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of color changes
  useEffect(() => {
    onColorChangeRef.current?.(selectedColor);
  }, [selectedColor]);

  const colors = productData?.colors || FALLBACK_COLORS;
  const frontPrintArea = productData?.printAreas?.find((p) => p.placement === "front");

  const handleColorSelect = useCallback((color: PrintfulColor) => {
    setSelectedColor(color);
  }, []);

  // Refs for latest state (for event handlers)
  const multiStateRef = useRef(multiState);
  multiStateRef.current = multiState;

  const onMultiStateChangeRef = useRef(onMultiStateChange);
  onMultiStateChangeRef.current = onMultiStateChange;

  // Hit-test: find the topmost layer under a point
  const hitTestLayer = useCallback(
    (clientX: number, clientY: number): Layer | null => {
      const el = designAreaRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      // Click position as % of design area
      const clickXPct = ((clientX - rect.left) / rect.width) * 100;
      const clickYPct = ((clientY - rect.top) / rect.height) * 100;

      const state = multiStateRef.current;
      const side = view === "mockup" ? state.activeSide : view;
      const layers = [...(state[side] || [])].sort((a, b) => b.zIndex - a.zIndex);

      for (const layer of layers) {
        const ds = layer.designState;
        let halfW: number;
        let halfH: number;

        if (isTextLayer(layer)) {
          // Text layers: use generous hit area based on text content
          // Measure in percentage of design area with a generous minimum
          const elW = el.offsetWidth || 300;
          const elH = el.offsetHeight || 300;
          const charWidth = layer.fontSize * 0.65;
          const lines = layer.text.split("\n");
          const maxLineLen = Math.max(...lines.map((l) => l.length), 3);
          const textWidthPct = (maxLineLen * charWidth * ds.scale / elW) * 100;
          const textHeightPct = (lines.length * layer.fontSize * 1.4 * ds.scale / elH) * 100;
          // Generous minimum hit area: at least 15% x 10% of design area
          halfW = Math.max(textWidthPct / 2, 15);
          halfH = Math.max(textHeightPct / 2, 10);
        } else {
          // Image layers: 80% of area at scale 1, half-extent is 40% * scale
          halfW = 40 * ds.scale;
          halfH = 40 * ds.scale;
        }

        if (
          clickXPct >= ds.x - halfW &&
          clickXPct <= ds.x + halfW &&
          clickYPct >= ds.y - halfH &&
          clickYPct <= ds.y + halfH
        ) {
          return layer;
        }
      }
      return null;
    },
    [view]
  );

  // Drag handlers
  // Track if this was a click (no significant movement) vs a drag
  const didDragRef = useRef(false);
  const pendingSelectRef = useRef<string | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!hasLayers) return;

      const hitLayer = hitTestLayer(e.clientX, e.clientY);
      if (!hitLayer) {
        onSelectLayer?.(null);
        return;
      }

      // If clicking an already-selected text layer, don't start drag — let contentEditable handle it
      if (isTextLayer(hitLayer) && selectedLayerId === hitLayer.id) {
        return;
      }

      e.preventDefault();
      didDragRef.current = false;
      pendingSelectRef.current = hitLayer.id;

      draggedLayerIdRef.current = hitLayer.id;
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        stateX: hitLayer.designState.x,
        stateY: hitLayer.designState.y,
      });
    },
    [hasLayers, hitTestLayer, onSelectLayer, selectedLayerId]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !designAreaRef.current || !draggedLayerIdRef.current) return;

      // Mark as a real drag if mouse moved more than 3px
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDragRef.current = true;
      }

      const rect = designAreaRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;

      const state = multiStateRef.current;
      const side = view === "mockup" ? state.activeSide : view;
      const layer = state[side].find((l) => l.id === draggedLayerIdRef.current);
      if (!layer) return;

      // Constrain so design edges stay within the print area
      const halfExtent = layer.designState.scale * 50;
      const minPos = halfExtent;
      const maxPos = 100 - halfExtent;
      const newX = Math.min(Math.max(minPos, 50), Math.max(minPos, Math.min(maxPos, dragStart.stateX + deltaX)));
      const newY = Math.min(Math.max(minPos, 50), Math.max(minPos, Math.min(maxPos, dragStart.stateY + deltaY)));

      onMultiStateChangeRef.current(
        updateLayerDesignState(state, side, draggedLayerIdRef.current, {
          ...layer.designState,
          x: newX,
          y: newY,
        })
      );
    },
    [isDragging, dragStart, view]
  );

  const handleMouseUp = useCallback(() => {
    // If the user clicked without dragging, select the layer
    if (!didDragRef.current && pendingSelectRef.current) {
      onSelectLayer?.(pendingSelectRef.current);
    }
    pendingSelectRef.current = null;
    setIsDragging(false);
    draggedLayerIdRef.current = null;
  }, [onSelectLayer]);

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
      if (!hasLayers) return;

      if (e.touches.length === 2) {
        isPinchingRef.current = true;
        setIsDragging(false);
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDistRef.current = Math.hypot(dx, dy);
        // Use the dragged layer's scale, or default
        const state = multiStateRef.current;
        const side = view === "mockup" ? state.activeSide : view;
        const layer = draggedLayerIdRef.current
          ? state[side].find((l) => l.id === draggedLayerIdRef.current)
          : state[side][state[side].length - 1]; // topmost
        pinchStartScaleRef.current = layer?.designState.scale ?? 1;
        if (layer) draggedLayerIdRef.current = layer.id;
        return;
      }

      const touch = e.touches[0];
      const hitLayer = hitTestLayer(touch.clientX, touch.clientY);
      if (!hitLayer) return;

      draggedLayerIdRef.current = hitLayer.id;
      setIsDragging(true);
      setDragStart({
        x: touch.clientX,
        y: touch.clientY,
        stateX: hitLayer.designState.x,
        stateY: hitLayer.designState.y,
      });
    },
    [hasLayers, hitTestLayer, view]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!designAreaRef.current) return;

      if (isPinchingRef.current && e.touches.length === 2 && draggedLayerIdRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const ratio = newDist / pinchStartDistRef.current;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScaleRef.current * ratio));

        const state = multiStateRef.current;
        const side = view === "mockup" ? state.activeSide : view;
        const layer = state[side].find((l) => l.id === draggedLayerIdRef.current);
        if (!layer) return;

        onMultiStateChangeRef.current(
          updateLayerDesignState(state, side, draggedLayerIdRef.current, {
            ...layer.designState,
            scale: newScale,
          })
        );
        return;
      }

      if (!isDragging || !draggedLayerIdRef.current) return;
      const touch = e.touches[0];

      const rect = designAreaRef.current.getBoundingClientRect();
      const deltaX = ((touch.clientX - dragStart.x) / rect.width) * 100;
      const deltaY = ((touch.clientY - dragStart.y) / rect.height) * 100;

      const state = multiStateRef.current;
      const side = view === "mockup" ? state.activeSide : view;
      const layer = state[side].find((l) => l.id === draggedLayerIdRef.current);
      if (!layer) return;

      // Constrain so design edges stay within the print area
      const halfExtent = layer.designState.scale * 50;
      const minPos = halfExtent;
      const maxPos = 100 - halfExtent;
      const newX = Math.min(Math.max(minPos, 50), Math.max(minPos, Math.min(maxPos, dragStart.stateX + deltaX)));
      const newY = Math.min(Math.max(minPos, 50), Math.max(minPos, Math.min(maxPos, dragStart.stateY + deltaY)));

      onMultiStateChangeRef.current(
        updateLayerDesignState(state, side, draggedLayerIdRef.current, {
          ...layer.designState,
          x: newX,
          y: newY,
        })
      );
    },
    [isDragging, dragStart, view]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
      }
      if (e.touches.length === 0) {
        setIsDragging(false);
        draggedLayerIdRef.current = null;
      }
    },
    []
  );

  // Scroll-wheel zoom (desktop) - zooms layer under cursor
  useEffect(() => {
    const el = designAreaRef.current;
    if (!el || !hasLayers) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const hitLayer = hitTestLayer(e.clientX, e.clientY);
      if (!hitLayer) return;

      const factor = e.deltaY < 0 ? 1.05 : 0.95;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, hitLayer.designState.scale * factor));

      const state = multiStateRef.current;
      const side = view === "mockup" ? state.activeSide : view;

      onMultiStateChangeRef.current(
        updateLayerDesignState(state, side, hitLayer.id, {
          ...hitLayer.designState,
          scale: newScale,
        })
      );
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [hasLayers, hitTestLayer, view]);

  // Quick controls operate on all layers on active side
  const handleCenter = () => {
    let newState = multiState;
    for (const layer of currentSideLayers) {
      const updated = applyPositionCommand(layer.designState, { action: "center", preset: "center" });
      newState = updateLayerDesignState(newState, activeSide, layer.id, updated);
    }
    onMultiStateChange(newState);
  };

  const handleReset = () => {
    let newState = multiState;
    for (const layer of currentSideLayers) {
      newState = updateLayerDesignState(newState, activeSide, layer.id, { ...DEFAULT_DESIGN_STATE });
    }
    onMultiStateChange(newState);
  };

  const handleRotate = () => {
    let newState = multiState;
    for (const layer of currentSideLayers) {
      const updated = applyPositionCommand(layer.designState, { action: "rotate", rotation: 15 });
      newState = updateLayerDesignState(newState, activeSide, layer.id, updated);
    }
    onMultiStateChange(newState);
  };

  const handleSideToggle = (side: "front" | "back") => {
    setView(side);
    onMultiStateChange({ ...multiState, activeSide: side });
  };

  const displayedColors = showAllColors ? colors : colors.slice(0, 12);

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {/* Main preview area */}
      <div className="relative bg-gradient-to-b from-gray-100 to-gray-200 rounded-xl p-6 overflow-hidden">
        {/* View thumbnails */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          {/* Front view only — back toggle disabled until we have a proper back product image */}
          {(["front"] as const).map((v) => {
            const sideLayers = multiState[v];
            return (
              <button
                key={v}
                onClick={() => handleSideToggle(v)}
                className={cn(
                  "relative w-12 h-12 rounded-md border-2 overflow-hidden transition-all bg-gray-50",
                  view === v
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-background/80 hover:border-muted-foreground/50 opacity-70 hover:opacity-100"
                )}
                title="Front"
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
                {sideLayers.length > 0 && (
                  <div className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-primary border border-white" />
                )}
              </button>
            );
          })}
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
              showPrintArea={!hasLayers && !isDragging}
            >
              {/* Multi-layer design overlay */}
              {isLoading ? (
                <Skeleton className="w-3/4 h-3/4 rounded" />
              ) : hasLayers ? (
                /* Click on empty space deselects */
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
                  {sortedLayers.map((layer) => {
                    if (isTextLayer(layer)) {
                      return (
                        <TextLayerPreview
                          key={layer.id}
                          layer={layer}
                          isDragging={isDragging}
                          isBeingDragged={isDragging && draggedLayerIdRef.current === layer.id}
                          isSelected={selectedLayerId === layer.id}
                          onSelect={() => onSelectLayer?.(layer.id)}
                          onTextChange={(text) => onUpdateTextLayer?.({ text })}
                        />
                      );
                    }
                    const artifact = isImageLayer(layer) ? getArtifactForLayer(layer, allArtifacts) : undefined;
                    if (!artifact) return null;
                    return (
                      <div
                        key={layer.id}
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          transform: designStateToTransform(layer.designState),
                          transition: isDragging && draggedLayerIdRef.current === layer.id
                            ? "none"
                            : "transform 0.15s ease-out",
                          zIndex: layer.zIndex,
                        }}
                      >
                        <Image
                          src={artifact.storage_url}
                          alt={artifact.prompt || "Design"}
                          fill
                          className="object-contain pointer-events-none select-none"
                          draggable={false}
                        />
                      </div>
                    );
                  })}
                  {/* Drag hint — pointer-events-none so it doesn't block text layer clicks */}
                  {!isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-50 pointer-events-none">
                      <div className="bg-black/50 rounded-full p-2">
                        <Move className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground/30 animate-in fade-in duration-500">
                  <div className="text-center border-2 border-dashed border-muted-foreground/15 rounded-lg px-6 py-4">
                    <p className="text-sm font-medium">Design Area</p>
                    {frontPrintArea && (
                      <p className="text-xs mt-1">
                        {frontPrintArea.width} x {frontPrintArea.height}px
                      </p>
                    )}
                  </div>
                </div>
              )}
            </PhotoMockup>
          )}
        </div>

        {/* Position indicator — shows selected layer info or topmost */}
        {hasLayers && (() => {
          const targetLayer = selectedLayerId
            ? currentSideLayers.find((l) => l.id === selectedLayerId)
            : sortedLayers[sortedLayers.length - 1];
          const ds = targetLayer?.designState;
          if (!ds) return null;
          const label = targetLayer && isTextLayer(targetLayer)
            ? `"${targetLayer.text.slice(0, 12)}${targetLayer.text.length > 12 ? "..." : ""}"`
            : selectedLayerId ? "image" : "";
          return (
            <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground bg-background/80 px-2 py-1 rounded font-mono">
              {label && <span className="mr-1.5 opacity-70">{label}</span>}
              {Math.round(ds.x)}%, {Math.round(ds.y)}% .{" "}
              {Math.round(ds.scale * 100)}%
              {ds.rotation !== 0 && ` . ${ds.rotation}\u00b0`}
              {currentSideLayers.length > 1 && ` . ${currentSideLayers.length} layers`}
            </div>
          );
        })()}

        {/* Floating add-text button */}
        {onAddTextLayer && currentSideLayers.length < MAX_LAYERS_PER_SIDE && (
          <button
            onClick={onAddTextLayer}
            className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-lg bg-background hover:bg-primary/10 border-2 border-border hover:border-primary/50 flex items-center justify-center text-foreground hover:text-primary transition-all shadow-md"
            title="Add text layer"
          >
            <Type className="w-4.5 h-4.5" />
          </button>
        )}

        {/* Floating text toolbar */}
        {selectedLayerId && onUpdateTextLayer && (() => {
          const layer = currentSideLayers.find((l) => l.id === selectedLayerId);
          if (!layer || !isTextLayer(layer)) return null;
          return (
            <div className="absolute top-3 left-3 right-14 z-20">
              <TextToolbar
                layer={layer}
                onUpdate={onUpdateTextLayer}
                onDelete={() => onRemoveLayer(selectedLayerId)}
              />
            </div>
          );
        })()}
      </div>

      {/* Layer indicator panel */}
      {(hasLayers || multiState.front.length > 0 || multiState.back.length > 0) && (
        <div className="flex justify-center items-center gap-2">
          {sortedLayers.map((layer) => {
            if (isTextLayer(layer)) {
              return (
                <div key={layer.id} className="relative group">
                  <button
                    onClick={() => onSelectLayer?.(selectedLayerId === layer.id ? null : layer.id)}
                    className={cn(
                      "w-10 h-10 rounded border-2 overflow-hidden flex flex-col items-center justify-center gap-0",
                      selectedLayerId === layer.id ? "border-primary ring-1 ring-primary/30" : "border-muted"
                    )}
                    style={{ backgroundColor: layer.fontColor + "15" }}
                    title={`Text: ${layer.text}`}
                  >
                    <Type className="w-3.5 h-3.5 shrink-0" style={{ color: layer.fontColor === "#FFFFFF" ? "#888" : layer.fontColor }} />
                    <span className="text-[7px] leading-tight truncate max-w-[36px] text-muted-foreground">
                      {layer.text.slice(0, 6)}
                    </span>
                  </button>
                  <button
                    onClick={() => onRemoveLayer(layer.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove layer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            }
            const artifact = isImageLayer(layer) ? getArtifactForLayer(layer, allArtifacts) : undefined;
            if (!artifact) return null;
            return (
              <div key={layer.id} className="relative group">
                <div className="w-10 h-10 rounded border-2 border-muted overflow-hidden">
                  <Image
                    src={artifact.storage_url}
                    alt=""
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                </div>
                <button
                  onClick={() => onRemoveLayer(layer.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove layer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
          {currentSideLayers.length < MAX_LAYERS_PER_SIDE && (
            <div className="flex items-center gap-1">
              {onAddLayerRequest && (
                <button
                  onClick={onAddLayerRequest}
                  className="w-10 h-10 rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/50 hover:border-muted-foreground/60 hover:text-muted-foreground/80 transition-colors"
                  title="Add design layer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              {onAddTextLayer && (
                <button
                  onClick={onAddTextLayer}
                  className="w-10 h-10 rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/50 hover:border-muted-foreground/60 hover:text-muted-foreground/80 transition-colors"
                  title="Add text layer"
                >
                  <Type className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick positioning controls */}
      {hasLayers && (
        <div className="flex justify-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleRotate}
            title="Rotate 15deg"
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
    </div>
  );
}
