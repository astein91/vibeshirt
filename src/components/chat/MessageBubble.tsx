"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";

interface Message {
  id: string;
  role: string;
  author_name: string | null;
  content: string;
  created_at: string;
}

interface Artifact {
  id: string;
  type: string;
  storage_url: string;
  prompt: string | null;
}

interface MessageBubbleProps {
  message: Message;
  artifact?: Artifact;
  onArtifactClick?: (artifact: Artifact) => void;
}

export function MessageBubble({
  message,
  artifact,
  onArtifactClick,
}: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const authorName = message.author_name || (isAssistant ? "Tailor" : "User");
  const initials = authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const timeAgo = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        isAssistant ? "" : "flex-row-reverse"
      )}
    >
      <Avatar className="w-8 h-8">
        <AvatarFallback
          className={cn(
            "text-xs font-bold",
            isAssistant
              ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/30"
              : "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex flex-col gap-1 max-w-[80%]",
          isAssistant ? "items-start" : "items-end"
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("font-medium", isAssistant ? "text-neon-purple/70" : "text-neon-cyan/70")}>{authorName}</span>
          <span>{timeAgo}</span>
        </div>

        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
            isAssistant
              ? "bg-card border border-border/50 text-foreground"
              : "bg-neon-pink/15 border border-neon-pink/20 text-foreground"
          )}
        >
          {message.content}
        </div>

        {/* Artifact preview */}
        {artifact && (
          <button
            onClick={() => onArtifactClick?.(artifact)}
            className="mt-2 rounded-xl overflow-hidden border border-neon-purple/30 hover:border-neon-pink/50 transition-all hover:glow-purple"
          >
            <Image
              src={artifact.storage_url}
              alt={artifact.prompt || "Design preview"}
              width={200}
              height={200}
              className="object-cover"
            />
          </button>
        )}
      </div>
    </div>
  );
}
