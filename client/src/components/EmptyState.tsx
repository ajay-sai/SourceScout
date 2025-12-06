import { Button } from "@/components/ui/button";
import { 
  Package, 
  Upload, 
  Search, 
  FileQuestion, 
  Inbox,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateVariant = "upload" | "no-results" | "error" | "empty" | "no-history";

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const variantConfig: Record<EmptyStateVariant, {
  icon: typeof Package;
  defaultTitle: string;
  defaultDescription: string;
  defaultActionLabel: string;
}> = {
  upload: {
    icon: Upload,
    defaultTitle: "Ready to source",
    defaultDescription: "Upload a product image, spec sheet, or paste a URL to get started",
    defaultActionLabel: "Upload Product",
  },
  "no-results": {
    icon: Search,
    defaultTitle: "No matches found",
    defaultDescription: "Try adjusting your constraints or making some specs flexible",
    defaultActionLabel: "Modify Search",
  },
  error: {
    icon: FileQuestion,
    defaultTitle: "Something went wrong",
    defaultDescription: "We couldn't process your request. Please try again.",
    defaultActionLabel: "Try Again",
  },
  empty: {
    icon: Package,
    defaultTitle: "Nothing here yet",
    defaultDescription: "Start by uploading a product to analyze",
    defaultActionLabel: "Get Started",
  },
  "no-history": {
    icon: Inbox,
    defaultTitle: "No previous sessions",
    defaultDescription: "Your sourcing history will appear here",
    defaultActionLabel: "Start New Search",
  },
};

export function EmptyState({ 
  variant, 
  title, 
  description, 
  actionLabel, 
  onAction,
  className 
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;
  
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center max-w-md mx-auto",
        className
      )}
      data-testid={`empty-state-${variant}`}
    >
      <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      
      <h3 className="text-xl font-semibold mb-2">
        {title || config.defaultTitle}
      </h3>
      
      <p className="text-muted-foreground mb-6">
        {description || config.defaultDescription}
      </p>
      
      {onAction && (
        <Button onClick={onAction} className="gap-2" data-testid={`button-empty-action-${variant}`}>
          {variant === "error" ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {actionLabel || config.defaultActionLabel}
        </Button>
      )}
    </div>
  );
}
