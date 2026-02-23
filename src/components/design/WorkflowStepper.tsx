"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

type StepStatus = "completed" | "active" | "disabled";

interface WorkflowStep {
  label: string;
  status: StepStatus;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
}

interface WorkflowStepperProps {
  sessionStatus: string;
  hasGenerated: boolean;
  hasNormalized: boolean;
  hasProduct: boolean;
  isNormalizing?: boolean;
  isCreatingProduct?: boolean;
  onNormalize: () => void;
  onCreateProduct: () => void;
}

function deriveSteps({
  sessionStatus,
  hasGenerated,
  hasNormalized,
  hasProduct,
  isNormalizing,
  isCreatingProduct,
  onNormalize,
  onCreateProduct,
}: WorkflowStepperProps): WorkflowStep[] {
  const steps: WorkflowStep[] = [];

  // Step 1: Design
  const designCompleted = hasGenerated || hasNormalized || hasProduct;
  steps.push({
    label: "Design",
    status: designCompleted ? "completed" : "active",
  });

  // Step 2: Finalize (normalize)
  if (hasNormalized || hasProduct) {
    steps.push({ label: "Finalize", status: "completed" });
  } else if (hasGenerated) {
    steps.push({
      label: "Finalize",
      status: isNormalizing ? "active" : "active",
      action: isNormalizing
        ? { label: "Preparing...", onClick: () => {}, loading: true }
        : { label: "Prepare for Print", onClick: onNormalize },
    });
  } else {
    steps.push({ label: "Finalize", status: "disabled" });
  }

  // Step 3: Create Product
  if (hasProduct || sessionStatus === "PRODUCT_CREATED") {
    steps.push({ label: "Create Product", status: "completed" });
  } else if (hasNormalized || sessionStatus === "NORMALIZED") {
    steps.push({
      label: "Create Product",
      status: "active",
      action: isCreatingProduct
        ? { label: "Creating...", onClick: () => {}, loading: true }
        : { label: "Create Product", onClick: onCreateProduct },
    });
  } else {
    steps.push({ label: "Create Product", status: "disabled" });
  }

  return steps;
}

export function WorkflowStepper(props: WorkflowStepperProps) {
  const steps = deriveSteps(props);

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1 last:flex-none">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors",
                  step.status === "completed" &&
                    "bg-primary text-primary-foreground",
                  step.status === "active" &&
                    "bg-primary/10 text-primary border-2 border-primary",
                  step.status === "disabled" &&
                    "bg-muted text-muted-foreground"
                )}
              >
                {step.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "text-sm whitespace-nowrap",
                  step.status === "active" && "font-medium",
                  step.status === "disabled" && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mx-3",
                  steps[i + 1].status !== "disabled"
                    ? "bg-primary/30"
                    : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Active step action button */}
      {steps.map(
        (step) =>
          step.action && (
            <div key={step.label} className="flex justify-center">
              <Button
                size="sm"
                onClick={step.action.onClick}
                disabled={step.action.loading}
              >
                {step.action.loading && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {step.action.label}
              </Button>
            </div>
          )
      )}
    </div>
  );
}
