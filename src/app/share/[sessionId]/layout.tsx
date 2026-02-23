import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { sessionId: shareSlug } = await params;
  const supabase = createServiceClient();

  const { data: session } = await supabase
    .from("design_sessions")
    .select("id, vibe_description")
    .eq("share_slug", shareSlug)
    .eq("is_public", true)
    .single();

  if (!session) {
    return { title: "Shared Design - Vibeshirt" };
  }

  const title = session.vibe_description
    ? `${session.vibe_description} - Vibeshirt`
    : "Shared Design - Vibeshirt";
  const description = session.vibe_description
    ? `Check out this custom t-shirt design: "${session.vibe_description}". Remix it with AI on Vibeshirt!`
    : "Check out this custom AI-designed t-shirt. Remix it on Vibeshirt!";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Vibeshirt",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
