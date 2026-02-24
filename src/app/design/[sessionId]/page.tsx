"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/hooks/useSession";
import { useMessages } from "@/hooks/useMessages";
import { useArtifacts } from "@/hooks/useArtifacts";
import { usePrintfulMockup } from "@/hooks/usePrintfulMockup";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { OnboardingModal } from "@/components/chat/OnboardingModal";
import { InteractiveCanvas } from "@/components/design/InteractiveCanvas";
import { WorkflowStepper } from "@/components/design/WorkflowStepper";
import { CheckoutModal } from "@/components/design/CheckoutModal";
import { ShareButton } from "@/components/share/ShareButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/auth/UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  type MultiSideDesignState,
  type TextLayer,
  DEFAULT_DESIGN_STATE,
  applyPositionCommand,
  migrateDesignState,
  addLayerToSide,
  addTextLayerToSide,
  removeLayerFromSide,
  updateLayerDesignState,
  updateTextLayerProps,
  isTextLayer,
  isImageLayer,
} from "@/lib/design-state";
import { TextToolbar } from "@/components/design/TextToolbar";
import { DEFAULT_PRODUCT_ID, type FitType, PRODUCTS, getFit } from "@/lib/printful/products";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

const DEFAULT_USER_NAME = "You";
const getDesignStateKey = (sessionId: string) => `vibeshirt-design-state-${sessionId}`;
const getNuxDismissedKey = (sessionId: string) => `vibeshirt-nux-${sessionId}`;

export default function DesignSessionPage({ params }: PageProps) {
  const { sessionId } = use(params);
  const [multiState, setMultiState] = useState<MultiSideDesignState>({
    version: 2,
    activeSide: "front",
    front: [],
    back: [],
  });
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | null>(null);
  const [printArea, setPrintArea] = useState<{ placement: string; title: string; width: number; height: number; dpi: number } | null>(null);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [productId, setProductId] = useState<number>(DEFAULT_PRODUCT_ID);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showNux, setShowNux] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  const vibeAutoSentRef = useRef(false);
  const mockupGeneratedForRef = useRef<string | null>(null);
  const seenArtifactIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  const { session, isLoading: sessionLoading, makePublic } = useSession(sessionId);
  const { messages, isLoading: messagesLoading, isSending, sendMessage } = useMessages(sessionId);
  const { artifacts, latestArtifact, latestGenerated, latestNormalized, isLoading: artifactsLoading, uploadArtifact } = useArtifacts(sessionId);
  const { generateMockup, mockups, isGenerating: isMockupGenerating } = usePrintfulMockup();

  // Load design state from localStorage first, then DB fallback
  useEffect(() => {
    const savedRaw = localStorage.getItem(getDesignStateKey(sessionId));
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        const migrated = migrateDesignState(parsed);
        setMultiState(migrated);
        initialLoadDoneRef.current = true;
      } catch {
        // Ignore invalid state
      }
    }

    const nuxDismissed = localStorage.getItem(getNuxDismissedKey(sessionId));
    if (!nuxDismissed) {
      setShowNux(true);
    }
  }, [sessionId]);

  // If no localStorage state, migrate from DB design_state when session loads
  useEffect(() => {
    if (session && !initialLoadDoneRef.current) {
      const migrated = migrateDesignState(session.design_state);
      setMultiState(migrated);
      initialLoadDoneRef.current = true;
    }
  }, [session]);

  // Sync productId from session
  useEffect(() => {
    if (session?.product_id) {
      setProductId(session.product_id);
    }
  }, [session]);

  // Fill empty artifactId on migrated layers (from old single-design format)
  useEffect(() => {
    if (!latestArtifact || !initialLoadDoneRef.current) return;

    let changed = false;
    let newState = multiState;

    for (const side of ["front", "back"] as const) {
      for (const layer of newState[side]) {
        // Only backfill image layers that have no artifactId
        if (isImageLayer(layer) && !layer.artifactId && latestArtifact) {
          newState = updateLayerDesignState(newState, side, layer.id, layer.designState);
          newState = {
            ...newState,
            [side]: newState[side].map((l) =>
              l.id === layer.id ? { ...l, artifactId: latestArtifact.id } : l
            ),
          };
          changed = true;
        }
      }
    }

    if (changed) setMultiState(newState);
  }, [latestArtifact]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track seen artifact IDs and auto-add new generations as layers
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;

    for (const artifact of artifacts) {
      if (seenArtifactIdsRef.current.has(artifact.id)) continue;
      seenArtifactIdsRef.current.add(artifact.id);
    }
  }, [artifacts]);

  // Auto-add new artifacts as layers when they appear
  const prevArtifactCountRef = useRef(0);
  useEffect(() => {
    if (!initialLoadDoneRef.current || artifacts.length === 0) return;

    // Only auto-add if we have more artifacts than before
    if (artifacts.length <= prevArtifactCountRef.current) {
      prevArtifactCountRef.current = artifacts.length;
      return;
    }

    const newArtifacts = artifacts.slice(0, artifacts.length - prevArtifactCountRef.current);
    prevArtifactCountRef.current = artifacts.length;

    let newState = multiState;
    for (const artifact of newArtifacts) {
      if (artifact.type !== "GENERATED" && artifact.type !== "UPLOAD") continue;
      // Check if already a layer
      const alreadyLayer = [...newState.front, ...newState.back].some(
        (l) => isImageLayer(l) && l.artifactId === artifact.id
      );
      if (alreadyLayer) continue;

      // Add to active side if under cap
      const side = newState.activeSide;
      if (newState[side].length < 3) {
        newState = addLayerToSide(newState, side, artifact.id);
      }
    }

    if (newState !== multiState) {
      setMultiState(newState);
    }
  }, [artifacts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save multiState to localStorage when it changes
  useEffect(() => {
    if (initialLoadDoneRef.current) {
      localStorage.setItem(getDesignStateKey(sessionId), JSON.stringify(multiState));
    }
  }, [sessionId, multiState]);

  // Debounced save of multiState to DB
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designState: multiState }),
      }).catch(() => {});
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [sessionId, multiState]);

  // Auto-send vibe description from homepage as first message
  useEffect(() => {
    if (
      session?.vibe_description &&
      !vibeAutoSentRef.current &&
      !messagesLoading &&
      messages.length <= 1
    ) {
      vibeAutoSentRef.current = true;
      sendMessage(session.vibe_description, DEFAULT_USER_NAME);
    }
  }, [session, messagesLoading, messages.length, sendMessage]);

  // Clear normalizing state when normalized artifact arrives
  useEffect(() => {
    if (latestNormalized && isNormalizing) {
      setIsNormalizing(false);
    }
  }, [latestNormalized, isNormalizing]);

  // Auto-trigger Printful mockup generation after normalization
  useEffect(() => {
    if (
      latestNormalized &&
      latestNormalized.id !== mockupGeneratedForRef.current &&
      !isMockupGenerating
    ) {
      mockupGeneratedForRef.current = latestNormalized.id;
      generateMockup({
        productId,
        variantIds: [],
        imageUrl: latestNormalized.storage_url,
        placement: "front",
      });
    }
  }, [latestNormalized, productId, isMockupGenerating, generateMockup]);

  const handleDismissNux = () => {
    setShowNux(false);
    localStorage.setItem(getNuxDismissedKey(sessionId), "1");
  };

  const handleMultiStateChange = useCallback((newState: MultiSideDesignState) => {
    setMultiState(newState);
  }, []);

  const handleRemoveLayer = useCallback((layerId: string) => {
    if (selectedLayerId === layerId) setSelectedLayerId(null);
    setMultiState((prev) => removeLayerFromSide(prev, prev.activeSide, layerId));
  }, [selectedLayerId]);

  const handleAddTextLayer = useCallback(() => {
    setMultiState((prev) => {
      const newState = addTextLayerToSide(prev, prev.activeSide);
      // Select the newly created text layer
      const newLayers = newState[prev.activeSide];
      const newest = newLayers[newLayers.length - 1];
      if (newest) setTimeout(() => setSelectedLayerId(newest.id), 0);
      return newState;
    });
  }, []);

  const handleUpdateTextLayer = useCallback(
    (props: Partial<Omit<TextLayer, "id" | "type" | "designState" | "zIndex">>) => {
      if (!selectedLayerId) return;
      setMultiState((prev) =>
        updateTextLayerProps(prev, prev.activeSide, selectedLayerId, props)
      );
    },
    [selectedLayerId]
  );

  const handleSendMessage = async (content: string) => {
    const lowerContent = content.toLowerCase();
    const positionKeywords = [
      "move", "center", "scale", "bigger", "smaller", "larger",
      "rotate", "top", "bottom", "left", "right", "fill", "fit", "reset"
    ];
    const isPositionCommand = positionKeywords.some(kw => lowerContent.includes(kw)) &&
      !lowerContent.includes("design") && !lowerContent.includes("create") && !lowerContent.includes("make");

    if (isPositionCommand && multiState[multiState.activeSide].length > 0) {
      const command = parseSimplePositionCommand(lowerContent);
      if (command) {
        // Apply to all layers on active side
        let newState = multiState;
        for (const layer of newState[newState.activeSide]) {
          const updated = applyPositionCommand(layer.designState, command);
          newState = updateLayerDesignState(newState, newState.activeSide, layer.id, updated);
        }
        setMultiState(newState);
        await sendMessage(content, DEFAULT_USER_NAME);
        return;
      }
    }

    const result = await sendMessage(content, DEFAULT_USER_NAME);

    // Handle add_text response from API
    if (result?.addText) {
      const textProps = result.addText as Partial<Omit<TextLayer, "id" | "type" | "designState" | "zIndex">>;
      setMultiState((prev) => {
        const newState = addTextLayerToSide(prev, prev.activeSide, textProps);
        const newLayers = newState[prev.activeSide];
        const newest = newLayers[newLayers.length - 1];
        if (newest) setTimeout(() => setSelectedLayerId(newest.id), 0);
        return newState;
      });
    }
  };

  const handleShare = async () => {
    await makePublic();
  };

  const handleFitChange = async (fit: FitType) => {
    const newProductId = PRODUCTS[fit].id;
    setProductId(newProductId);
    // Persist to DB
    fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: newProductId }),
    }).catch(() => {});
  };

  const handleFileUpload = async (file: File) => {
    try {
      await uploadArtifact(file);
      // Auto-add as layer is handled by the artifact watcher effect
    } catch (err) {
      console.error("[Upload] Failed:", err);
    }
  };

  const handleNormalize = async () => {
    if (!latestArtifact) return;
    setIsNormalizing(true);

    try {
      // Use first front layer's design state for normalization, or default
      const frontLayers = multiState.front;
      const designState = frontLayers[0]?.designState || DEFAULT_DESIGN_STATE;

      const response = await fetch("/api/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          artifactId: latestArtifact.id,
          designState,
          printArea,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error("[Normalize] Failed:", data.error || response.statusText);
        setIsNormalizing(false);
        return;
      }
    } catch (err) {
      console.error("[Normalize] Request failed:", err);
      setIsNormalizing(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!latestArtifact) {
      console.error("[CreateProduct] No latestArtifact available");
      return;
    }
    console.log("[CreateProduct] Starting with artifact:", latestArtifact.id);
    setIsCreatingProduct(true);

    try {
      const configResponse = await fetch("/api/printful/map-vibe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibeDescription: session?.vibe_description || "custom design",
          artworkDescription: latestArtifact.prompt,
          productId,
        }),
      });

      if (!configResponse.ok) {
        const err = await configResponse.text();
        console.error("[CreateProduct] map-vibe failed:", configResponse.status, err);
        return;
      }

      const config = await configResponse.json();
      console.log("[CreateProduct] Config mapped, creating product...");

      const productResponse = await fetch("/api/printful/create-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          artifactId: latestArtifact.id,
          config,
          multiState,
        }),
      });

      if (!productResponse.ok) {
        const err = await productResponse.text();
        console.error("[CreateProduct] create-product failed:", productResponse.status, err);
      } else {
        console.log("[CreateProduct] Product created successfully");
      }
    } catch (err) {
      console.error("[CreateProduct] Error:", err);
    } finally {
      setTimeout(() => setIsCreatingProduct(false), 5000);
    }
  };

  const isLoading = sessionLoading || messagesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Session Not Found</h1>
          <p className="text-muted-foreground">
            This design session doesn&apos;t exist or has been deleted.
          </p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-5 py-3 flex items-center justify-between bg-card/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image src="/logo.png" alt="Vibeshirting" width={30} height={30} className="rounded-lg ring-1 ring-neon-purple/30 group-hover:ring-neon-pink/50 transition-all" />
            <span className="text-lg font-extrabold italic gradient-text">
              Vibeshirting
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/my-projects">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              My Designs
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="sm" className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 hover:border-neon-cyan/50">
              + New Design
            </Button>
          </Link>
          <ShareButton
            sessionId={sessionId}
            shareSlug={session.share_slug}
            isPublic={session.is_public}
            onShare={handleShare}
          />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Design preview panel */}
        <div className="lg:w-1/2 border-b lg:border-b-0 lg:border-r border-border/50 p-6 flex flex-col overflow-auto synthwave-grid">
          {/* Workflow Stepper + Fit Selector */}
          <div className="mb-4 space-y-3">
            <WorkflowStepper
              sessionStatus={session.status}
              hasGenerated={!!latestGenerated}
              hasNormalized={!!latestNormalized}
              hasProduct={!!session.printful_product_id}
              hasOrdered={session.status === "ORDERED"}
              isNormalizing={isNormalizing}
              isCreatingProduct={isCreatingProduct}
              onNormalize={handleNormalize}
              onCreateProduct={handleCreateProduct}
              onOrder={() => setShowCheckout(true)}
            />
            {/* Fit Selector */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-lg border border-border/50 bg-card/50 p-0.5">
                {(Object.entries(PRODUCTS) as [FitType, { id: number; label: string }][]).map(
                  ([fit, { id, label }]) => (
                    <button
                      key={fit}
                      onClick={() => handleFitChange(fit)}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                        productId === id
                          ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/30"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <InteractiveCanvas
              productId={productId}
              multiState={multiState}
              allArtifacts={artifacts
                .filter((a) => a.type === "GENERATED" || a.type === "UPLOAD")
                .map((a) => ({
                  id: a.id,
                  type: a.type,
                  storage_url: a.storage_url,
                  prompt: a.prompt,
                  metadata: a.metadata as Record<string, unknown>,
                }))}
              onMultiStateChange={handleMultiStateChange}
              onRemoveLayer={handleRemoveLayer}
              onAddTextLayer={handleAddTextLayer}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              isLoading={artifactsLoading}
              onColorChange={(color) => setSelectedColor(color)}
              onPrintAreaChange={(area) => setPrintArea(area)}
              onSizesChange={(sizes) => setAvailableSizes(sizes)}
              mockupPreview={
                mockups?.[0]
                  ? { imageUrl: mockups[0].imageUrl, placement: mockups[0].placement }
                  : null
              }
              isMockupLoading={isMockupGenerating}
            />

            {/* Text toolbar for selected text layer */}
            {selectedLayerId && (() => {
              const allLayers = [...multiState.front, ...multiState.back];
              const layer = allLayers.find((l) => l.id === selectedLayerId);
              if (!layer || !isTextLayer(layer)) return null;
              return (
                <TextToolbar
                  layer={layer}
                  onUpdate={handleUpdateTextLayer}
                  onDelete={() => handleRemoveLayer(selectedLayerId)}
                />
              );
            })()}
          </div>
        </div>

        {/* Chat panel */}
        <div className="lg:w-1/2 flex flex-col min-h-[400px] lg:min-h-0 lg:h-full overflow-hidden">
          <ChatContainer
            messages={messages}
            artifacts={artifacts.map((a) => ({
              id: a.id,
              type: a.type,
              storage_url: a.storage_url,
              prompt: a.prompt,
            }))}
            isLoading={isSending}
            userName={DEFAULT_USER_NAME}
            onSendMessage={handleSendMessage}
            onFileSelect={handleFileUpload}
            onArtifactClick={(a) => {
              // Clicking an artifact in chat could add it as a layer
              const alreadyLayer = [...multiState.front, ...multiState.back].some(
                (l) => isImageLayer(l) && l.artifactId === a.id
              );
              if (!alreadyLayer) {
                const side = multiState.activeSide;
                if (multiState[side].length < 3) {
                  setMultiState(addLayerToSide(multiState, side, a.id));
                }
              }
            }}
          />
        </div>
      </div>

      {/* NUX capabilities overlay */}
      <OnboardingModal open={showNux} onDismiss={handleDismissNux} />

      {/* Checkout modal */}
      {session.printful_product_id != null && session.printful_config != null ? (
        <CheckoutModal
          open={showCheckout}
          onClose={() => setShowCheckout(false)}
          sessionId={sessionId}
          config={session.printful_config as { productId: number; title: string; description: string; variantIds: number[]; retailPrice: number }}
          selectedColor={selectedColor}
          sizes={availableSizes}
        />
      ) : null}
    </div>
  );
}

// Simple position command parser
function parseSimplePositionCommand(message: string): {
  action: "move" | "scale" | "rotate" | "reset" | "center";
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  preset?: "center" | "top" | "bottom" | "left" | "right" | "fill" | "fit";
} | null {
  const lower = message.toLowerCase();

  if (lower.includes("center") || lower.includes("middle")) {
    return { action: "center", preset: "center" };
  }
  if (lower.includes("top") && !lower.includes("stop")) {
    return { action: "move", preset: "top", y: 25 };
  }
  if (lower.includes("bottom")) {
    return { action: "move", preset: "bottom", y: 75 };
  }
  if (lower.includes("left")) {
    return { action: "move", preset: "left", x: 30 };
  }
  if (lower.includes("right")) {
    return { action: "move", preset: "right", x: 70 };
  }
  if (lower.includes("bigger") || lower.includes("larger") || lower.includes("scale up")) {
    return { action: "scale", scale: 1.2 };
  }
  if (lower.includes("smaller") || lower.includes("scale down")) {
    return { action: "scale", scale: 0.8 };
  }
  if (lower.includes("fill")) {
    return { action: "scale", preset: "fill", scale: 1.5 };
  }
  if (lower.includes("fit")) {
    return { action: "scale", preset: "fit", scale: 0.9 };
  }
  if (lower.includes("reset")) {
    return { action: "reset" };
  }

  const rotateMatch = lower.match(/rotate\s*(\d+)/);
  if (rotateMatch) {
    return { action: "rotate", rotation: parseInt(rotateMatch[1], 10) };
  }

  if (lower.includes("rotate")) {
    return { action: "rotate", rotation: 15 };
  }

  return null;
}
