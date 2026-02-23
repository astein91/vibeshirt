import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { sessionId: shareSlug } = await params;
  const supabase = createServiceClient();

  // Look up session by share slug
  const { data: session } = await supabase
    .from("design_sessions")
    .select("id, vibe_description, share_slug")
    .eq("share_slug", shareSlug)
    .eq("is_public", true)
    .single();

  if (!session) {
    return {
      title: "Shared Design - Vibeshirt",
    };
  }

  // Get the latest artifact image (prefer NORMALIZED, then GENERATED)
  const { data: artifacts } = await supabase
    .from("artifacts")
    .select("storage_url, type, prompt")
    .eq("session_id", session.id)
    .in("type", ["NORMALIZED", "GENERATED"])
    .order("created_at", { ascending: false })
    .limit(5);

  const bestArtifact =
    artifacts?.find((a) => a.type === "NORMALIZED") ||
    artifacts?.find((a) => a.type === "GENERATED");

  const title = session.vibe_description
    ? `${session.vibe_description} - Vibeshirt`
    : "Shared Design - Vibeshirt";
  const description = session.vibe_description
    ? `Check out this custom t-shirt design: "${session.vibe_description}". Remix it with AI on Vibeshirt!`
    : "Check out this custom AI-designed t-shirt. Remix it on Vibeshirt!";

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Vibeshirt",
    },
    twitter: {
      card: bestArtifact ? "summary_large_image" : "summary",
      title,
      description,
    },
  };

  if (bestArtifact?.storage_url) {
    const imageUrl = bestArtifact.storage_url;
    metadata.openGraph!.images = [
      {
        url: imageUrl,
        width: 1200,
        height: 1200,
        alt: bestArtifact.prompt || "T-shirt design",
      },
    ];
    metadata.twitter!.images = [imageUrl];
  }

  return metadata;
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
