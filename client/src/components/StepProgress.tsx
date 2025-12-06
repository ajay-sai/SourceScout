import { Check, Upload, Search, Settings, BarChart3, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowStepType } from "@shared/schema";

const steps: { id: WorkflowStepType; label: string; icon: typeof Upload }[] = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "analyze", label: "Analyze", icon: Sparkles },
  { id: "configure", label: "Configure", icon: Settings },
  { id: "search", label: "Search", icon: Search },
  { id: "results", label: "Results", icon: BarChart3 },
];

const stepOrder: WorkflowStepType[] = ["upload", "analyze", "configure", "search", "results"];

interface StepProgressProps {
  currentStep: WorkflowStepType;
  isProcessing?: boolean;
}

export function StepProgress({ currentStep, isProcessing = false }: StepProgressProps) {
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;
          const Icon = step.icon;

          return (
            <li key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="flex items-center w-full">
                  {index > 0 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1 transition-colors duration-300",
                        isCompleted || isCurrent ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                      isCompleted && "border-primary bg-primary text-primary-foreground",
                      isCurrent && "border-primary bg-background text-primary",
                      isUpcoming && "border-muted bg-background text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : isCurrent && isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1 transition-colors duration-300",
                        isCompleted ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium uppercase tracking-wide transition-colors duration-300",
                    isCurrent && "text-foreground",
                    isCompleted && "text-primary",
                    isUpcoming && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
