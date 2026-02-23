"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  shareSlug: string | null;
  isPublic: boolean;
  onShare: () => Promise<void>;
}

export function ShareModal({
  open,
  onOpenChange,
  sessionId,
  shareSlug,
  isPublic,
  onShare,
}: ShareModalProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareSlug
    ? `${window.location.origin}/share/${shareSlug}`
    : null;

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await onShare();
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Design Session</DialogTitle>
          <DialogDescription>
            Share your design session with others. They can chat and collaborate
            on the design with you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isPublic && shareUrl ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500">
                  Public
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Anyone with the link can view and chat
                </span>
              </div>

              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="secondary"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    window.open(
                      `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent("Check out my T-shirt design on Vibeshirt!")}`,
                      "_blank"
                    );
                  }}
                >
                  Share on X
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    window.open(shareUrl, "_blank");
                  }}
                >
                  Open Link
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Private</Badge>
                <span className="text-sm text-muted-foreground">
                  Only you can see this session
                </span>
              </div>

              <Button
                onClick={handleShare}
                disabled={isSharing}
                className="w-full"
              >
                {isSharing ? "Creating link..." : "Make Public & Get Link"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
