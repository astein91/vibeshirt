"use client";

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { Skeleton } from "@/components/ui/skeleton";

export interface Message {
  id: string;
  role: string;
  author_name: string | null;
  content: string;
  artifact_id: string | null;
  created_at: string;
}

export interface Artifact {
  id: string;
  type: string;
  storage_url: string;
  prompt: string | null;
}

interface ChatContainerProps {
  messages: Message[];
  artifacts: Artifact[];
  isLoading: boolean;
  userName: string;
  onSendMessage: (content: string) => void;
  onFileSelect?: (file: File) => void;
  onArtifactClick?: (artifact: Artifact) => void;
}

export function ChatContainer({
  messages,
  artifacts,
  isLoading,
  userName,
  onSendMessage,
  onFileSelect,
  onArtifactClick,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const artifactMap = new Map(artifacts.map((a) => [a.id, a]));

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-2xl mx-auto">
          {messages.map((message) => {
            const linkedArtifact = message.artifact_id
              ? artifactMap.get(message.artifact_id)
              : undefined;

            return (
              <MessageBubble
                key={message.id}
                message={message}
                artifact={linkedArtifact}
                onArtifactClick={onArtifactClick}
              />
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-neon-purple/20 border border-neon-purple/30 flex items-center justify-center text-sm text-neon-purple">
                T
              </div>
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-muted" />
                <Skeleton className="h-4 w-1/2 bg-muted" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/50 p-4 bg-card/50">
        <div className="max-w-2xl mx-auto">
          <ChatInput
            userName={userName}
            onSend={onSendMessage}
            onFileSelect={onFileSelect}
            placeholder="Describe your design or ask for changes..."
          />
        </div>
      </div>
    </div>
  );
}
