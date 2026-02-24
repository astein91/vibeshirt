"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface ChatInputProps {
  userName: string;
  onSend: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  userName,
  onSend,
  placeholder = "Type a message...",
  disabled = false,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setContent("");

    // Focus back on textarea
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[48px] max-h-[200px] resize-none pr-12 bg-card border-border/50 focus:border-neon-pink/50 focus:ring-neon-pink/20 rounded-xl text-sm"
          rows={1}
        />
        <div className="absolute right-3 bottom-3 text-xs text-muted-foreground/50">
          {userName}
        </div>
      </div>
      <Button
        onClick={handleSend}
        disabled={!content.trim() || disabled}
        size="icon"
        className="h-[48px] w-[48px] rounded-xl bg-neon-pink hover:bg-neon-pink/80 text-background glow-pink shrink-0"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}
