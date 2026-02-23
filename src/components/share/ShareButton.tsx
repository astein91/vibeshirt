"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShareModal } from "./ShareModal";

interface ShareButtonProps {
  sessionId: string;
  shareSlug: string | null;
  isPublic: boolean;
  onShare: () => Promise<void>;
}

export function ShareButton({
  sessionId,
  shareSlug,
  isPublic,
  onShare,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        Share
      </Button>
      <ShareModal
        open={isOpen}
        onOpenChange={setIsOpen}
        sessionId={sessionId}
        shareSlug={shareSlug}
        isPublic={isPublic}
        onShare={onShare}
      />
    </>
  );
}
