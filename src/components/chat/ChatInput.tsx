"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ImagePlus, X } from "lucide-react";
import Image from "next/image";

interface ChatInputProps {
  userName: string;
  onSend: (content: string) => void;
  onFileSelect?: (file: File) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  userName,
  onSend,
  onFileSelect,
  placeholder = "Type a message...",
  disabled = false,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (pendingFile) {
      onFileSelect?.(pendingFile);
      clearFile();
      // Also send text if any
      const trimmed = content.trim();
      if (trimmed) {
        onSend(trimmed);
        setContent("");
      }
      textareaRef.current?.focus();
      return;
    }

    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setContent("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith("image/")) return;

    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;

    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Image preview */}
      {previewUrl && (
        <div className="relative inline-block ml-1">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border/50">
            <Image
              src={previewUrl}
              alt="Upload preview"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <button
            onClick={clearFile}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div
        className="flex gap-2 items-end"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Image upload button */}
        {onFileSelect && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-[48px] w-[48px] rounded-xl shrink-0 text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Upload image"
          >
            <ImagePlus className="w-5 h-5" />
          </Button>
        )}

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
          disabled={(!content.trim() && !pendingFile) || disabled}
          size="icon"
          className="h-[48px] w-[48px] rounded-xl bg-neon-pink hover:bg-neon-pink/80 text-background glow-pink shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
