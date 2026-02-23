"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="flex gap-2">
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[44px] max-h-[200px] resize-none pr-12"
          rows={1}
        />
        <div className="absolute right-2 bottom-2 text-xs text-muted-foreground">
          {userName}
        </div>
      </div>
      <Button
        onClick={handleSend}
        disabled={!content.trim() || disabled}
        size="default"
      >
        Send
      </Button>
    </div>
  );
}
