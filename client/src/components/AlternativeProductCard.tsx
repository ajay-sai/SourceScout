import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Package, 
  MapPin, 
  TrendingDown,
  Sparkles,
  Layers,
  Maximize2,
  Wrench,
  DollarSign,
  Crown,
  ArrowRight,
  AlertTriangle
} from "lucide-react";
import type { AlternativeProduct } from "@shared/schema";

interface AlternativeProductCardProps {
  alternative: AlternativeProduct;
}

function getAlternativeTypeConfig(type: AlternativeProduct["alternativeType"]) {
  switch (type) {
    case "budget":
      return {
        label: "Budget Option",
        icon: DollarSign,
        variant: "default" as const,
        className: "bg-green-600 text-white"
      };
    case "premium":
      return {
        label: "Premium",
        icon: Crown,
        variant: "default" as const,
        className: "bg-amber-500 text-white"
      };
    case "different_material":
      return {
        label: "Different Material",
        icon: Layers,
        variant: "secondary" as const,
        className: ""
      };
    case "different_size":
      return {
        label: "Different Size",
        icon: Maximize2,
        variant: "secondary" as const,
        className: ""
      };
    case "similar_function":
      return {
        label: "Similar Function",
        icon: Wrench,
        variant: "secondary" as const,
        className: ""
      };
    default:
      return {
        label: "Alternative",
        icon: Sparkles,
        variant: "secondary" as const,
        className: ""
      };
  }
}

export function AlternativeProductCard({ alternative }: AlternativeProductCardProps) {
  const typeConfig = getAlternativeTypeConfig(alternative.alternativeType);
  const TypeIcon = typeConfig.icon;

  return (
    <Card 
      className="relative overflow-visible transition-all duration-200 hover-elevate"
      data-testid={`card-alternative-${alternative.id}`}
    >
      {alternative.estimatedSavings && alternative.estimatedSavings > 0 && (
        <div className="absolute -top-3 -right-3 z-10">
          <Badge 
            className="bg-green-600 text-white gap-1 shadow-sm"
            data-testid={`badge-savings-${alternative.id}`}
          >
            <TrendingDown className="h-3 w-3" />
            Save {alternative.estimatedSavings}%
          </Badge>
        </div>
      )}
      
      <CardContent className="p-5">
        <div className="flex gap-4">
          <div className="h-20 w-20 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 
                  className="font-semibold text-base truncate" 
                  data-testid={`text-alt-product-name-${alternative.id}`}
                >
                  {alternative.productName}
                </h3>
                <p 
                  className="text-sm text-muted-foreground truncate"
                  data-testid={`text-alt-supplier-name-${alternative.id}`}
                >
                  {alternative.supplierName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p 
                  className="text-lg font-bold" 
                  data-testid={`text-alt-price-${alternative.id}`}
                >
                  {alternative.currency} {alternative.price.toFixed(2)}
                </p>
              </div>
            </div>

            {alternative.location && (
              <div 
                className="flex items-center gap-1 mt-2 text-xs text-muted-foreground"
                data-testid={`text-alt-location-${alternative.id}`}
              >
                <MapPin className="h-3 w-3" />
                {alternative.location}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Badge 
            variant={typeConfig.variant}
            className={`gap-1 ${typeConfig.className}`}
            data-testid={`badge-alt-type-${alternative.id}`}
          >
            <TypeIcon className="h-3 w-3" />
            {typeConfig.label}
          </Badge>
          {alternative.moq && (
            <Badge 
              variant="secondary" 
              className="gap-1"
              data-testid={`badge-alt-moq-${alternative.id}`}
            >
              <Package className="h-3 w-3" />
              MOQ: {alternative.moq.toLocaleString()}
            </Badge>
          )}
        </div>

        <div className="mt-4" data-testid={`section-match-score-${alternative.id}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Match Score</span>
            <span 
              className="text-xs font-medium"
              data-testid={`text-alt-match-score-${alternative.id}`}
            >
              {alternative.matchScore}%
            </span>
          </div>
          <Progress value={alternative.matchScore} className="h-1.5" />
        </div>

        {alternative.description && (
          <p 
            className="mt-3 text-sm text-muted-foreground line-clamp-2"
            data-testid={`text-alt-description-${alternative.id}`}
          >
            {alternative.description}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div data-testid={`section-why-alternative-${alternative.id}`}>
            <div className="flex items-center gap-1 text-xs font-medium mb-1">
              <ArrowRight className="h-3 w-3" />
              Why this alternative?
            </div>
            <p 
              className="text-xs text-muted-foreground"
              data-testid={`text-alt-why-${alternative.id}`}
            >
              {alternative.whyAlternative}
            </p>
          </div>

          {alternative.keyDifferences.length > 0 && (
            <div data-testid={`section-key-differences-${alternative.id}`}>
              <div className="flex items-center gap-1 text-xs font-medium mb-1">
                <Sparkles className="h-3 w-3" />
                Key Differences
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {alternative.keyDifferences.map((diff, index) => (
                  <li 
                    key={index} 
                    className="flex items-start gap-1"
                    data-testid={`text-alt-difference-${alternative.id}-${index}`}
                  >
                    <span className="text-muted-foreground/50">•</span>
                    {diff}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {alternative.tradeoffs.length > 0 && (
            <div data-testid={`section-tradeoffs-${alternative.id}`}>
              <div className="flex items-center gap-1 text-xs font-medium mb-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Trade-offs
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {alternative.tradeoffs.map((tradeoff, index) => (
                  <li 
                    key={index} 
                    className="flex items-start gap-1"
                    data-testid={`text-alt-tradeoff-${alternative.id}-${index}`}
                  >
                    <span className="text-amber-600/50">•</span>
                    {tradeoff}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
