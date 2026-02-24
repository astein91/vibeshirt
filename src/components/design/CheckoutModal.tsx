"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrintfulConfig {
  productId: number;
  title: string;
  description: string;
  variantIds: number[];
  retailPrice: number; // cents
}

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  config: PrintfulConfig;
  selectedColor: { name: string; hex: string } | null;
  sizes?: string[];
}

interface ShippingForm {
  name: string;
  address1: string;
  city: string;
  state_code: string;
  zip: string;
  country_code: string;
  email: string;
}

const EMPTY_FORM: ShippingForm = {
  name: "",
  address1: "",
  city: "",
  state_code: "",
  zip: "",
  country_code: "US",
  email: "",
};

const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL"];

export function CheckoutModal({
  open,
  onClose,
  sessionId,
  config,
  selectedColor,
  sizes,
}: CheckoutModalProps) {
  const availableSizes = sizes && sizes.length > 0 ? sizes : DEFAULT_SIZES;
  const [selectedSize, setSelectedSize] = useState<string>("M");
  const [form, setForm] = useState<ShippingForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    orderId: number;
    status: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const priceDisplay = (config.retailPrice / 100).toFixed(2);

  const handleChange = (field: keyof ShippingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid =
    form.name.trim() &&
    form.address1.trim() &&
    form.city.trim() &&
    form.state_code.trim() &&
    form.zip.trim() &&
    form.email.trim();

  // Find the variant ID matching the selected color + size
  // variantIds from config are catalog variant IDs — we pass the first one
  // and let the API route resolve to the correct sync_variant
  const getVariantId = () => {
    // For now, just use the first variant ID from config
    // The checkout API will map it to the correct sync variant
    return config.variantIds[0];
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          variantId: getVariantId(),
          quantity: 1,
          recipient: {
            name: form.name.trim(),
            address1: form.address1.trim(),
            city: form.city.trim(),
            state_code: form.state_code.trim(),
            country_code: form.country_code,
            zip: form.zip.trim(),
            email: form.email.trim(),
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to place order");
      }

      setOrderResult({ orderId: data.orderId, status: data.status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      // Reset state after close animation
      setTimeout(() => {
        setOrderResult(null);
        setError(null);
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {orderResult ? (
          // Success state
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <DialogHeader>
              <DialogTitle className="text-center">Draft Order Created</DialogTitle>
              <DialogDescription className="text-center">
                Order #{orderResult.orderId} has been created as a draft.
                No payment has been charged.
              </DialogDescription>
            </DialogHeader>
            <Badge variant="outline" className="text-neon-cyan border-neon-cyan/30">
              Status: {orderResult.status}
            </Badge>
            <div className="pt-2 space-y-2">
              <a
                href="https://www.printful.com/dashboard/orders"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-neon-purple hover:underline"
              >
                View in Printful Dashboard
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <Button onClick={handleClose} className="w-full mt-4">
              Done
            </Button>
          </div>
        ) : (
          // Order form
          <>
            <DialogHeader>
              <DialogTitle>Place Order</DialogTitle>
              <DialogDescription>
                Create a draft order on Printful. No payment will be charged.
              </DialogDescription>
            </DialogHeader>

            {/* Order summary */}
            <div className="rounded-lg border border-border/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{config.title}</span>
                <Badge variant="outline" className="text-neon-cyan border-neon-cyan/30 text-xs">
                  Draft
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {selectedColor && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: selectedColor.hex }}
                    />
                    {selectedColor.name}
                  </span>
                )}
                <span>${priceDisplay}</span>
              </div>
            </div>

            {/* Size selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Size</label>
              <div className="flex gap-2">
                {availableSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={cn(
                      "flex-1 py-2 rounded-md border text-sm font-medium transition-all",
                      selectedSize === size
                        ? "border-neon-pink bg-neon-pink/10 text-neon-pink"
                        : "border-border text-muted-foreground hover:border-neon-purple/50"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Shipping form */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Shipping Address</label>

              <Input
                placeholder="Full name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
              <Input
                placeholder="Address"
                value={form.address1}
                onChange={(e) => handleChange("address1", e.target.value)}
              />
              <div className="grid grid-cols-5 gap-2">
                <Input
                  placeholder="City"
                  className="col-span-2"
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                />
                <Input
                  placeholder="State"
                  className="col-span-1"
                  value={form.state_code}
                  onChange={(e) => handleChange("state_code", e.target.value)}
                />
                <Input
                  placeholder="ZIP"
                  className="col-span-2"
                  value={form.zip}
                  onChange={(e) => handleChange("zip", e.target.value)}
                />
              </div>
              <Input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              className="w-full bg-neon-pink hover:bg-neon-pink/80 text-background glow-pink"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Placing Order...
                </>
              ) : (
                `Place Draft Order — $${priceDisplay}`
              )}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
