import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Ruler, Zap, Award, Globe, Tag, Building2 } from "lucide-react";
import type { ProductDNA, ProductSpec } from "@shared/schema";

interface ProductDnaDisplayProps {
  product: ProductDNA | null;
  isLoading?: boolean;
}

const categoryIcons: Record<string, typeof Package> = {
  dimensions: Ruler,
  material: Package,
  electrical: Zap,
  certification: Award,
  other: Tag,
};

const categoryLabels: Record<string, string> = {
  dimensions: "Dimensions",
  material: "Materials",
  electrical: "Electrical",
  certification: "Certifications",
  other: "Other Specs",
};

function SpecRow({ spec }: { spec: ProductSpec }) {
  const Icon = categoryIcons[spec.category] || Tag;
  
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium">{spec.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {spec.value}
          {spec.unit && ` ${spec.unit}`}
        </span>
      </div>
    </div>
  );
}

function SpecCategoryGroup({ category, specs }: { category: string; specs: ProductSpec[] }) {
  if (specs.length === 0) return null;
  
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
        {categoryLabels[category] || category}
      </h4>
      <div className="rounded-lg border border-border bg-card">
        {specs.map((spec) => (
          <SpecRow key={spec.id} spec={spec} />
        ))}
      </div>
    </div>
  );
}

export function ProductDnaDisplay({ product, isLoading }: ProductDnaDisplayProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-32 w-32 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!product) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No product data available</p>
        </CardContent>
      </Card>
    );
  }

  const groupedSpecs = product.specifications.reduce((acc, spec) => {
    const category = spec.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(spec);
    return acc;
  }, {} as Record<string, ProductSpec[]>);

  const categoryOrder = ["dimensions", "material", "electrical", "certification", "other"];

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Original Product
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          {product.imageUrl ? (
            <div className="h-28 w-28 rounded-lg bg-muted border border-border overflow-hidden shrink-0">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-28 w-28 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
              <Package className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate" data-testid="text-product-name">
              {product.name}
            </h3>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {product.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {product.brand && (
                <Badge variant="secondary" className="gap-1">
                  <Building2 className="h-3 w-3" />
                  {product.brand}
                </Badge>
              )}
              {product.countryOfOrigin && (
                <Badge variant="secondary" className="gap-1">
                  <Globe className="h-3 w-3" />
                  {product.countryOfOrigin}
                </Badge>
              )}
              {product.originalPrice && (
                <Badge variant="outline" className="gap-1">
                  <Tag className="h-3 w-3" />
                  {product.currency} {product.originalPrice.toFixed(2)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {categoryOrder.map((category) => (
            <SpecCategoryGroup
              key={category}
              category={category}
              specs={groupedSpecs[category] || []}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
