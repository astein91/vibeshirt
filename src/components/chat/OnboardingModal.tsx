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
  },
  {
    icon: <Paintbrush className="w-4 h-4" />,
    title: "Iterate with chat",
    description: "Ask for changes — colors, style, positioning",
  },
  {
    icon: <Upload className="w-4 h-4" />,
    title: "Upload your own art",
    description: "Drag & drop an image to use as your design",
  },
  {
    icon: <Shirt className="w-4 h-4" />,
    title: "Preview on products",
    description: "See your design on real t-shirt mockups",
  },
];

export function OnboardingModal({ open, onDismiss }: OnboardingModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Welcome to Vibeshirt</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-md bg-muted text-muted-foreground shrink-0">
                {cap.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{cap.title}</p>
                <p className="text-xs text-muted-foreground">{cap.description}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onDismiss} className="w-full">
            Start Designing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
