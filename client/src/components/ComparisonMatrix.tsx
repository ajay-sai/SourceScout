import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle2, 
  XCircle, 
  ArrowUp, 
  Minus, 
  Building2,
  Package,
  TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupplierMatch, ProductSpec } from "@shared/schema";

interface ComparisonMatrixProps {
  originalSpecs: ProductSpec[];
  suppliers: SupplierMatch[];
  onSelectSupplier?: (match: SupplierMatch) => void;
}

function CellValue({ 
  isMatch, 
  isBetter, 
  value 
}: { 
  isMatch: boolean; 
  isBetter?: boolean; 
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {isMatch ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
      ) : isBetter ? (
        <ArrowUp className="h-4 w-4 text-blue-600 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
      )}
      <span className={cn(
        "text-sm",
        isMatch && "text-foreground",
        !isMatch && !isBetter && "text-amber-600",
        isBetter && "text-blue-600 font-medium"
      )}>
        {value || <Minus className="h-4 w-4 text-muted-foreground" />}
      </span>
    </div>
  );
}

export function ComparisonMatrix({ originalSpecs, suppliers, onSelectSupplier }: ComparisonMatrixProps) {
  if (suppliers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No suppliers to compare</p>
        </CardContent>
      </Card>
    );
  }

  const topSpecs = originalSpecs.filter(s => s.priority === "must_have").slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Comparison Matrix</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[640px]">
            <table className="w-full" data-testid="table-comparison">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 text-left p-4 font-medium text-sm text-muted-foreground w-48">
                    Specification
                  </th>
                  {suppliers.map((supplier) => (
                    <th 
                      key={supplier.id} 
                      className="text-left p-4 min-w-[200px]"
                      data-testid={`th-supplier-${supplier.id}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {supplier.imageUrl ? (
                            <img 
                              src={supplier.imageUrl} 
                              alt={supplier.supplierName}
                              className="h-10 w-10 rounded-md object-cover border border-border"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-muted border border-border flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{supplier.supplierName}</p>
                            <p className="text-xs text-muted-foreground truncate">{supplier.productName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base">
                            {supplier.currency} {supplier.price.toFixed(2)}
                          </span>
                          {supplier.priceDelta < 0 && (
                            <Badge className="bg-green-600 text-white text-xs gap-1">
                              <TrendingDown className="h-3 w-3" />
                              {Math.abs(supplier.priceDelta).toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topSpecs.map((spec, index) => (
                  <tr 
                    key={spec.id} 
                    className={cn(
                      "border-b border-border",
                      index % 2 === 0 && "bg-muted/20"
                    )}
                    data-testid={`row-spec-${spec.id}`}
                  >
                    <td className="sticky left-0 z-10 p-4 bg-inherit">
                      <div>
                        <p className="text-sm font-medium">{spec.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {spec.value}{spec.unit && ` ${spec.unit}`}
                        </p>
                      </div>
                    </td>
                    {suppliers.map((supplier) => {
                      const isMatch = supplier.matchedSpecs.includes(spec.id);
                      const isMismatch = supplier.mismatchedSpecs.includes(spec.id);
                      
                      return (
                        <td key={supplier.id} className="p-4">
                          <CellValue 
                            isMatch={isMatch}
                            isBetter={false}
                            value={isMatch ? "Matches" : isMismatch ? "Different" : "N/A"}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr className="border-b border-border bg-muted/30">
                  <td className="sticky left-0 z-10 p-4 bg-muted/30 font-medium text-sm">
                    Confidence Score
                  </td>
                  {suppliers.map((supplier) => (
                    <td key={supplier.id} className="p-4">
                      <Badge 
                        variant={supplier.confidenceScore >= 80 ? "default" : "secondary"}
                        className="gap-1"
                      >
                        {supplier.confidenceScore}%
                      </Badge>
                    </td>
                  ))}
                </tr>

                <tr className="border-b border-border">
                  <td className="sticky left-0 z-10 p-4 bg-background font-medium text-sm">
                    MOQ
                  </td>
                  {suppliers.map((supplier) => (
                    <td key={supplier.id} className="p-4 text-sm">
                      {supplier.moq ? supplier.moq.toLocaleString() + " units" : "—"}
                    </td>
                  ))}
                </tr>

                <tr className="border-b border-border bg-muted/20">
                  <td className="sticky left-0 z-10 p-4 bg-muted/20 font-medium text-sm">
                    Lead Time
                  </td>
                  {suppliers.map((supplier) => (
                    <td key={supplier.id} className="p-4 text-sm">
                      {supplier.leadTimeDays ? supplier.leadTimeDays + " days" : "—"}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="sticky left-0 z-10 p-4 bg-background font-medium text-sm">
                    Action
                  </td>
                  {suppliers.map((supplier) => (
                    <td key={supplier.id} className="p-4">
                      <Button 
                        size="sm"
                        onClick={() => onSelectSupplier?.(supplier)}
                        className="gap-2"
                        data-testid={`button-matrix-select-${supplier.id}`}
                      >
                        <Building2 className="h-4 w-4" />
                        Contact
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function ComparisonMatrixSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-48 shrink-0" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-8 w-48 shrink-0" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
