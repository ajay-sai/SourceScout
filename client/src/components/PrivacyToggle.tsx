import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PrivacyToggleProps {
  isPrivate: boolean;
  onToggle: (isPrivate: boolean) => void;
  disabled?: boolean;
  showLabel?: boolean;
}

export function PrivacyToggle({ 
  isPrivate, 
  onToggle, 
  disabled = false,
  showLabel = true 
}: PrivacyToggleProps) {
  return (
    <div className="flex items-center gap-3">
      {showLabel && (
        <Label 
          htmlFor="privacy-toggle" 
          className="text-sm text-muted-foreground cursor-pointer"
        >
          {isPrivate ? "Private" : "Public"}
        </Label>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Switch
              id="privacy-toggle"
              checked={isPrivate}
              onCheckedChange={onToggle}
              disabled={disabled}
              data-testid="switch-privacy-toggle"
            />
            {isPrivate ? (
              <Lock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Globe className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>
            {isPrivate 
              ? "Private mode: Data won't be stored in shared knowledge base" 
              : "Public mode: Data contributes to shared knowledge base"}
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

interface PrivacyIndicatorProps {
  isPrivate: boolean;
  className?: string;
}

export function PrivacyIndicator({ isPrivate, className = "" }: PrivacyIndicatorProps) {
  if (!isPrivate) return null;
  
  return (
    <Badge 
      variant="secondary" 
      className={`gap-1 ${className}`}
      data-testid="badge-private-session"
    >
      <Lock className="h-3 w-3" />
      Private Session
    </Badge>
  );
}
