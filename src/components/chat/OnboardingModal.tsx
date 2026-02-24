"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, Paintbrush, Upload, Shirt } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onDismiss: () => void;
}

const CAPABILITIES = [
  {
    icon: <MessageSquare className="w-4 h-4" />,
    title: "Describe your vision",
    description: "Tell the AI what you want and it generates artwork",
    color: "text-neon-pink bg-neon-pink/15 border-neon-pink/30",
  },
  {
    icon: <Paintbrush className="w-4 h-4" />,
    title: "Iterate with chat",
    description: "Ask for changes \u2014 colors, style, positioning",
    color: "text-neon-purple bg-neon-purple/15 border-neon-purple/30",
  },
  {
    icon: <Upload className="w-4 h-4" />,
    title: "Upload your own art",
    description: "Drag & drop an image to use as your design",
    color: "text-neon-cyan bg-neon-cyan/15 border-neon-cyan/30",
  },
  {
    icon: <Shirt className="w-4 h-4" />,
    title: "Preview on products",
    description: "See your design on real t-shirt mockups",
    color: "text-neon-pink bg-neon-pink/15 border-neon-pink/30",
  },
];

export function OnboardingModal({ open, onDismiss }: OnboardingModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="gradient-text text-xl font-extrabold italic">
            Welcome to Vibeshirting
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className="flex items-start gap-3">
              <div className={`mt-0.5 p-1.5 rounded-lg border shrink-0 ${cap.color}`}>
                {cap.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{cap.title}</p>
                <p className="text-xs text-muted-foreground">{cap.description}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onDismiss} className="w-full bg-neon-pink hover:bg-neon-pink/80 text-background font-semibold glow-pink">
            Start Designing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
