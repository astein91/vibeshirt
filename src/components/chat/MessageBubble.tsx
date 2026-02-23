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
            isAssistant
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
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
          <span className="font-medium">{authorName}</span>
          <span>{timeAgo}</span>
        </div>

        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isAssistant
              ? "bg-muted text-foreground"
              : "bg-primary text-primary-foreground"
          )}
        >
          {message.content}
        </div>

        {/* Artifact preview */}
        {artifact && (
          <button
            onClick={() => onArtifactClick?.(artifact)}
            className="mt-2 rounded-lg overflow-hidden border hover:border-primary transition-colors"
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
