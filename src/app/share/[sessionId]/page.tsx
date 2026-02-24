"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useArtifacts } from "@/hooks/useArtifacts";
import { PhotoMockup } from "@/components/design/PhotoMockup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/auth/UserMenu";
import {
  type MultiSideDesignState,
  migrateDesignState,
  designStateToTransform,
} from "@/lib/design-state";

interface Session {
  id: string;
  status: string;
  is_public: boolean;
  share_slug: string;
  vibe_description: string | null;
  design_state: unknown;
}

interface PrintfulColor {
  name: string;
  hex: string;
  hex2: string | null;
  variantIds: number[];
  image: string;
}

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

const PRODUCT_ID = 71; // Bella+Canvas 3001

export default function SharePage({ params }: PageProps) {
  const { sessionId: shareSlug } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForking, setIsForking] = useState(false);
  const [productImage, setProductImage] = useState<string>("");
  const [productColor, setProductColor] = useState<string>("#FFFFFF");
  const [selectedColor, setSelectedColor] = useState<PrintfulColor | null>(null);
  const [colors, setColors] = useState<PrintfulColor[]>([]);
  const [viewSide, setViewSide] = useState<"front" | "back">("front");

  // Fetch session by share slug
  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch(`/api/sessions?shareSlug=${shareSlug}`);
        if (!response.ok) {
          setError(response.status === 404 ? "Session not found" : "Failed to load session");
          return;
        }
        const data = await response.json();
        if (!data || data.error) {
          setError("This session is not publicly shared");
          return;
        }
        setSession(data);
      } catch {
        setError("Failed to load session");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSession();
  }, [shareSlug]);

  // Fetch product data for rendering
  useEffect(() => {
    async function fetchProduct() {
      try {
        const response = await fetch(`/api/printful/products/${PRODUCT_ID}`);
        if (response.ok) {
          const data = await response.json();
          setColors(data.colors || []);
          const white = data.colors?.find((c: PrintfulColor) => c.name === "White") || data.colors?.[0];
          if (white) {
            setSelectedColor(white);
            setProductImage(white.image);
            setProductColor(white.hex);
          }
        }
      } catch {
        // Fall back to defaults
      }
    }
    fetchProduct();
  }, []);

  const sessionId = session?.id;
  const { artifacts, latestArtifact } = useArtifacts(sessionId || null);

  // Migrate design state
  const multiState: MultiSideDesignState = migrateDesignState(session?.design_state);

  // Fill empty artifactIds from latest artifact (migration from old format)
  const filledMultiState: MultiSideDesignState = {
    ...multiState,
    front: multiState.front.map((l) => ({
      ...l,
      artifactId: l.artifactId || latestArtifact?.id || "",
    })),
    back: multiState.back.map((l) => ({
      ...l,
      artifactId: l.artifactId || latestArtifact?.id || "",
    })),
  };

  const currentLayers = filledMultiState[viewSide];
  const sortedLayers = [...currentLayers].sort((a, b) => a.zIndex - b.zIndex);
  const hasFrontLayers = filledMultiState.front.length > 0;
  const hasBackLayers = filledMultiState.back.length > 0;

  const handleFork = async () => {
    if (!sessionId) return;
    setIsForking(true);
    try {
      const response = await fetch("/api/sessions/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceSessionId: sessionId }),
      });
      if (!response.ok) throw new Error("Failed to remix");
      const newSession = await response.json();
      router.push(`/design/${newSession.id}`);
    } catch {
      setIsForking(false);
    }
  };

  const handleColorSelect = (color: PrintfulColor) => {
    setSelectedColor(color);
    setProductImage(color.image);
    setProductColor(color.hex);
  };

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

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">
            {error === "Session not found" ? "Session Not Found" : "Access Denied"}
          </h1>
          <p className="text-muted-foreground">
            {error === "Session not found"
              ? "This shared design session doesn't exist."
              : "This session is not publicly shared."}
          </p>
          <Link href="/">
            <Button>Create Your Own Design</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Vibeshirting" width={28} height={28} className="rounded" />
            <span className="text-lg font-extrabold italic bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Vibeshirting
            </span>
          </Link>
          <Badge variant="secondary">Shared Design</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleFork}
            disabled={isForking}
            size="sm"
          >
            {isForking ? "Creating..." : "Remix This Design"}
          </Button>
          <UserMenu />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8 max-w-4xl mx-auto w-full">
        {/* Vibe description */}
        {session.vibe_description && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Design vibe</p>
            <p className="text-lg font-medium">{session.vibe_description}</p>
          </div>
        )}

        {/* Product mockup */}
        <div className="w-full max-w-lg">
          <div className="relative bg-white rounded-xl shadow-sm p-6">
            <PhotoMockup
              color={productColor}
              productImage={productImage}
              view={viewSide}
              className="w-full"
            >
              {sortedLayers.length > 0 && (
                <div className="relative w-full h-full">
                  {sortedLayers.map((layer) => {
                    const artifact = artifacts.find((a) => a.id === layer.artifactId);
                    if (!artifact) return null;
                    return (
                      <div
                        key={layer.id}
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          transform: designStateToTransform(layer.designState),
                          zIndex: layer.zIndex,
                        }}
                      >
                        <Image
                          src={artifact.storage_url}
                          alt={artifact.prompt || "Design"}
                          fill
                          className="object-contain pointer-events-none"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </PhotoMockup>

            {/* Front/Back toggle */}
            {(hasFrontLayers || hasBackLayers) && (
              <div className="flex justify-center gap-2 mt-3">
                {(["front", "back"] as const).map((side) => {
                  const sideHasLayers = filledMultiState[side].length > 0;
                  return (
                    <button
                      key={side}
                      onClick={() => setViewSide(side)}
                      className={`px-3 py-1 text-xs rounded-full border transition-all capitalize ${
                        viewSide === side
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-gray-200 text-muted-foreground hover:border-gray-400"
                      }`}
                    >
                      {side}
                      {sideHasLayers && (
                        <span className="ml-1 text-[10px]">({filledMultiState[side].length})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Color swatches */}
          {colors.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {colors.slice(0, 12).map((color) => (
                <button
                  key={color.name}
                  onClick={() => handleColorSelect(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                    selectedColor?.name === color.name
                      ? "border-primary ring-2 ring-primary/30 scale-110"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                  style={{
                    backgroundColor: color.hex,
                    boxShadow: color.hex.toUpperCase() === "#FFFFFF"
                      ? "inset 0 0 0 1px rgba(0,0,0,0.1)"
                      : undefined,
                  }}
                  title={color.name}
                />
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="text-center space-y-3">
          <Button
            onClick={handleFork}
            disabled={isForking}
            size="lg"
          >
            {isForking ? "Creating your remix..." : "Remix This Design"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Create your own version of this design with AI
          </p>
        </div>
      </div>
    </div>
  );
}
