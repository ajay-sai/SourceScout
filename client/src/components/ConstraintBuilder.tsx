import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Lock, Unlock, DollarSign, Package, Clock, ArrowRight, Ruler, Zap, Award, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductSpec, SearchConstraints, ConstraintPriorityType } from "@shared/schema";

interface ConstraintBuilderProps {
  specifications: ProductSpec[];
  onSubmit: (constraints: SearchConstraints) => void;
  isLoading?: boolean;
}

const categoryIcons: Record<string, typeof Ruler> = {
  dimensions: Ruler,
  material: Package,
  electrical: Zap,
  certification: Award,
  other: Tag,
};

export function ConstraintBuilder({ specifications, onSubmit, isLoading = false }: ConstraintBuilderProps) {
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [targetPrice, setTargetPrice] = useState<string>("");
  const [maxMoq, setMaxMoq] = useState<string>("");
  const [maxLeadTime, setMaxLeadTime] = useState<string>("");

  useEffect(() => {
    setSpecs(specifications.map(spec => ({ ...spec })));
  }, [specifications]);

  const togglePriority = (specId: string) => {
    setSpecs(prev =>
      prev.map(spec =>
        spec.id === specId
          ? { ...spec, priority: spec.priority === "must_have" ? "flexible" : "must_have" as ConstraintPriorityType }
          : spec
      )
    );
  };

  const mustHaveCount = specs.filter(s => s.priority === "must_have").length;
  const flexibleCount = specs.filter(s => s.priority === "flexible").length;

  const handleSubmit = () => {
    const constraints: SearchConstraints = {
      specifications: specs,
      targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
      maxMoq: maxMoq ? parseInt(maxMoq) : undefined,
      maxLeadTimeDays: maxLeadTime ? parseInt(maxLeadTime) : undefined,
    };
    onSubmit(constraints);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Configure Requirements</CardTitle>
          <CardDescription>
            Mark specifications as "Must Have" (non-negotiable) or "Flexible" (nice to have)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Must Have</p>
                <p className="text-xs text-muted-foreground">{mustHaveCount} specs locked</p>
              </div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Unlock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Flexible</p>
                <p className="text-xs text-muted-foreground">{flexibleCount} specs flexible</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {specs.map((spec) => {
              const Icon = categoryIcons[spec.category] || Tag;
              const isMustHave = spec.priority === "must_have";
              
              return (
                <div
                  key={spec.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                    isMustHave ? "border-primary/30 bg-primary/5" : "border-border"
                  )}
                  data-testid={`spec-row-${spec.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                      isMustHave ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        isMustHave ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{spec.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {spec.value}{spec.unit && ` ${spec.unit}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={isMustHave ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {isMustHave ? "Must Have" : "Flexible"}
                    </Badge>
                    <Switch
                      checked={isMustHave}
                      onCheckedChange={() => togglePriority(spec.id)}
                      data-testid={`switch-spec-${spec.id}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Target Parameters</CardTitle>
          <CardDescription>
            Set your desired pricing, quantity, and timeline constraints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="target-price" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Target Price
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="target-price"
                  type="number"
                  placeholder="0.00"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="pl-7"
                  data-testid="input-target-price"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-moq" className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Max MOQ
              </Label>
              <div className="relative">
                <Input
                  id="max-moq"
                  type="number"
                  placeholder="1000"
                  value={maxMoq}
                  onChange={(e) => setMaxMoq(e.target.value)}
                  data-testid="input-max-moq"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  units
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-lead-time" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Max Lead Time
              </Label>
              <div className="relative">
                <Input
                  id="max-lead-time"
                  type="number"
                  placeholder="30"
                  value={maxLeadTime}
                  onChange={(e) => setMaxLeadTime(e.target.value)}
                  data-testid="input-max-lead-time"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  days
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={isLoading}
          className="gap-2"
          data-testid="button-start-search"
        >
          Start Sourcing Search
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
