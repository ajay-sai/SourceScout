import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  MapPin, 
  TrendingDown, 
  TrendingUp, 
  Package, 
  Clock, 
  ExternalLink, 
  CheckCircle2, 
  XCircle,
  Star,
  ShieldCheck,
  Mail
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RfqEmailModal } from "./RfqEmailModal";
import type { SupplierMatch } from "@shared/schema";

interface SupplierMatchCardProps {
  match: SupplierMatch;
  onSelect?: (match: SupplierMatch) => void;
  isSelected?: boolean;
  sessionId?: string;
}

function getTrustBadgeIcon(badge: string) {
  const badgeLower = badge.toLowerCase();
  if (badgeLower.includes("verified")) return ShieldCheck;
  if (badgeLower.includes("star") || badgeLower.includes("gold")) return Star;
  return ShieldCheck;
}

export function SupplierMatchCard({ match, onSelect, isSelected = false, sessionId }: SupplierMatchCardProps) {
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const hasSavings = match.priceDelta < 0;
  const savingsPercent = Math.abs(match.priceDelta).toFixed(0);

  return (
    <>
      {sessionId && (
        <RfqEmailModal
          isOpen={isRfqModalOpen}
          onClose={() => setIsRfqModalOpen(false)}
          supplierMatch={match}
          sessionId={sessionId}
        />
      )}
    <Card 
      className={cn(
        "relative overflow-visible transition-all duration-200 hover-elevate",
        isSelected && "ring-2 ring-primary"
      )}
      data-testid={`card-supplier-${match.id}`}
    >
      {hasSavings && (
        <div className="absolute -top-3 -right-3 z-10">
          <Badge className="bg-green-600 text-white gap-1 shadow-sm">
            <TrendingDown className="h-3 w-3" />
            -{savingsPercent}%
          </Badge>
        </div>
      )}
      
      <CardContent className="p-5">
        <div className="flex gap-4">
          {match.imageUrl ? (
            <div className="h-20 w-20 rounded-lg bg-muted border border-border overflow-hidden shrink-0">
              <img
                src={match.imageUrl}
                alt={match.productName}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-20 w-20 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate" data-testid={`text-supplier-name-${match.id}`}>
                  {match.supplierName}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {match.productName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold" data-testid={`text-price-${match.id}`}>
                  {match.currency} {match.price.toFixed(2)}
                </p>
                {!hasSavings && match.priceDelta > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <TrendingUp className="h-3 w-3" />
                    +{match.priceDelta.toFixed(0)}%
                  </p>
                )}
              </div>
            </div>

            {match.location && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {match.location}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Badge variant="outline" className="gap-1">
            <Star className="h-3 w-3" />
            {match.confidenceScore}% Match
          </Badge>
          {match.moq && (
            <Badge variant="secondary" className="gap-1">
              <Package className="h-3 w-3" />
              MOQ: {match.moq.toLocaleString()}
            </Badge>
          )}
          {match.leadTimeDays && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {match.leadTimeDays} days
            </Badge>
          )}
        </div>

        {match.trustBadges && match.trustBadges.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-3">
            {match.trustBadges.map((badge, index) => {
              const BadgeIcon = getTrustBadgeIcon(badge);
              return (
                <Badge key={index} variant="secondary" className="text-xs gap-1">
                  <BadgeIcon className="h-3 w-3" />
                  {badge}
                </Badge>
              );
            })}
          </div>
        )}

        {match.certifications && match.certifications.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {match.certifications.map((cert, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {cert}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{match.matchedSpecs.length} matched</span>
            </div>
            {match.mismatchedSpecs.length > 0 && (
              <div className="flex items-center gap-1 text-amber-600">
                <XCircle className="h-3.5 w-3.5" />
                <span>{match.mismatchedSpecs.length} different</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          {sessionId && (
            <Button 
              variant="outline"
              className="flex-1 gap-2" 
              onClick={() => setIsRfqModalOpen(true)}
              data-testid={`button-generate-rfq-${match.id}`}
            >
              <Mail className="h-4 w-4" />
              Generate RFQ
            </Button>
          )}
          <Button 
            className="flex-1 gap-2" 
            onClick={() => onSelect?.(match)}
            data-testid={`button-select-supplier-${match.id}`}
          >
            <Building2 className="h-4 w-4" />
            Contact Supplier
          </Button>
          {match.productUrl && (
            <Button 
              variant="outline" 
              size="icon"
              asChild
              data-testid={`button-view-details-${match.id}`}
            >
              <a href={match.productUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
    </>
  );
}

export function SupplierMatchCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex gap-4">
          <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-9" />
        </div>
      </CardContent>
    </Card>
  );
}
