"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useMessages } from "@/hooks/useMessages";
import { useArtifacts } from "@/hooks/useArtifacts";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { NamePrompt } from "@/components/chat/NamePrompt";
import { InteractiveCanvas } from "@/components/design/InteractiveCanvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/auth/UserMenu";
import { DesignState, DEFAULT_DESIGN_STATE } from "@/lib/design-state";

interface Session {
  id: string;
  status: string;
  is_public: boolean;
  share_slug: string;
  vibe_description: string | null;
}

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function SharePage({ params }: PageProps) {
  const { sessionId: shareSlug } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [designState, setDesignState] = useState<DesignState>(DEFAULT_DESIGN_STATE);

  const handleDesignStateChange = useCallback((newState: DesignState) => {
    setDesignState(newState);
  }, []);

  // Fetch session by share slug
  useEffect(() => {
    async function fetchSession() {
      try {
        // First, we need to find the session by share slug
        const response = await fetch(`/api/sessions?shareSlug=${shareSlug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Session not found");
          } else {
            setError("Failed to load session");
          }
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

  const sessionId = session?.id;

  const { messages, isLoading: messagesLoading, isSending, sendMessage } = useMessages(
    sessionId || null
  );
  const { artifacts, latestArtifact } = useArtifacts(sessionId || null);

  // Load saved username from localStorage
  useEffect(() => {
    if (sessionId) {
      const saved = localStorage.getItem(`vibeshirt-name-${sessionId}`);
      if (saved) {
        setUserName(saved);
      }
    }
  }, [sessionId]);

  const handleNameSubmit = (name: string) => {
    setUserName(name);
    if (sessionId) {
      localStorage.setItem(`vibeshirt-name-${sessionId}`, name);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!userName || !sessionId) return;
    await sendMessage(content, userName);
  };

  // Get display artifact
  const displayArtifact = selectedArtifact
    ? artifacts.find((a) => a.id === selectedArtifact)
    : latestArtifact;

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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-bold text-lg">
            Vibeshirt
          </Link>
          <Badge variant="secondary">Shared Session</Badge>
          <Badge variant="outline">{session.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="outline" size="sm">
              Start Your Own
            </Button>
          </Link>
          <UserMenu />
        </div>
      </header>

      {/* Shared session banner */}
      {session.vibe_description && (
        <div className="bg-muted/50 px-4 py-2 text-sm text-center">
          <span className="text-muted-foreground">Vibe: </span>
          <span className="font-medium">{session.vibe_description}</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Design preview panel */}
        <div className="lg:w-1/2 border-b lg:border-b-0 lg:border-r p-6 flex flex-col overflow-auto">
          <div className="flex-1 flex items-center justify-center">
            <InteractiveCanvas
              artifact={displayArtifact ? {
                id: displayArtifact.id,
                type: displayArtifact.type,
                storage_url: displayArtifact.storage_url,
                prompt: displayArtifact.prompt,
                metadata: displayArtifact.metadata as Record<string, unknown>,
              } : null}
              designState={designState}
              onDesignStateChange={handleDesignStateChange}
              recentArtifacts={artifacts
                .filter((a) => a.type === "GENERATED" || a.type === "NORMALIZED")
                .map((a) => ({
                  id: a.id,
                  type: a.type,
                  storage_url: a.storage_url,
                  prompt: a.prompt,
                  metadata: a.metadata as Record<string, unknown>,
                }))}
              onArtifactSelect={(a) => setSelectedArtifact(a.id)}
            />
          </div>
        </div>

        {/* Chat panel */}
        <div className="lg:w-1/2 flex flex-col min-h-[400px] lg:min-h-0">
          <ChatContainer
            messages={messages}
            artifacts={artifacts.map((a) => ({
              id: a.id,
              type: a.type,
              storage_url: a.storage_url,
              prompt: a.prompt,
            }))}
            isLoading={messagesLoading || isSending}
            userName={userName || ""}
            onSendMessage={handleSendMessage}
            onArtifactClick={(a) => setSelectedArtifact(a.id)}
          />
        </div>
      </div>

      {/* Name prompt modal */}
      <NamePrompt
        open={!userName}
        onSubmit={handleNameSubmit}
      />
    </div>
  );
}
