import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Grid3X3, LayoutList, RefreshCw } from "lucide-react";

import { StepProgress } from "@/components/StepProgress";
import { DropZone } from "@/components/DropZone";
import { ProductDnaDisplay } from "@/components/ProductDnaDisplay";
import { ConstraintBuilder } from "@/components/ConstraintBuilder";
import { AgentActivityPanel } from "@/components/AgentActivityPanel";
import { SupplierMatchCard, SupplierMatchCardSkeleton } from "@/components/SupplierMatchCard";
import { ComparisonMatrix, ComparisonMatrixSkeleton } from "@/components/ComparisonMatrix";
import { EmptyState } from "@/components/EmptyState";

import type { 
  WorkflowStepType, 
  ProductDNA, 
  SearchConstraints, 
  SupplierMatch,
  AgentLogEntry,
  AgentStatusType,
  SourcingSession,
  InputTypeValue
} from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WorkflowStepType>("upload");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductDNA | null>(null);
  const [results, setResults] = useState<SupplierMatch[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatusType>("idle");
  const [resultsView, setResultsView] = useState<"cards" | "matrix">("cards");

  const addAgentLog = useCallback((log: Omit<AgentLogEntry, "id" | "timestamp">) => {
    const newLog: AgentLogEntry = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setAgentLogs((prev) => [...prev, newLog]);
  }, []);

  const analyzeProductMutation = useMutation({
    mutationFn: async (data: { inputType: InputTypeValue; url?: string; file?: File }) => {
      const formData = new FormData();
      formData.append("inputType", data.inputType);
      
      if (data.url) {
        formData.append("url", data.url);
      }
      if (data.file) {
        formData.append("file", data.file);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to analyze product");
      }

      return response.json() as Promise<{ session: SourcingSession; product: ProductDNA }>;
    },
    onMutate: () => {
      setCurrentStep("analyze");
      setAgentStatus("analyzing");
      addAgentLog({
        agentName: "Orchestrator",
        action: "Starting product analysis...",
        status: "analyzing",
      });
    },
    onSuccess: (data) => {
      setSessionId(data.session.id);
      setProduct(data.product);
      setAgentStatus("completed");
      addAgentLog({
        agentName: "Analyzer",
        action: `Extracted ${data.product.specifications.length} specifications from product`,
        status: "completed",
        details: data.product.name,
      });
      setCurrentStep("configure");
      toast({
        title: "Analysis complete",
        description: `Found ${data.product.specifications.length} specifications`,
      });
    },
    onError: (error: Error) => {
      setAgentStatus("error");
      addAgentLog({
        agentName: "Analyzer",
        action: "Analysis failed",
        status: "error",
        details: error.message,
      });
      setCurrentStep("upload");
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (constraints: SearchConstraints) => {
      const response = await apiRequest("POST", "/api/search", {
        sessionId,
        constraints,
      });
      return response.json() as Promise<{ results: SupplierMatch[]; session: SourcingSession }>;
    },
    onMutate: () => {
      setCurrentStep("search");
      setAgentStatus("searching");
      setResults([]);
      addAgentLog({
        agentName: "Orchestrator",
        action: "Initiating supplier search...",
        status: "searching",
      });
    },
    onSuccess: (data) => {
      addAgentLog({
        agentName: "Search",
        action: "Querying global supplier databases...",
        status: "searching",
      });
      
      setTimeout(() => {
        addAgentLog({
          agentName: "Analyzer",
          action: `Analyzing ${data.results.length} potential matches...`,
          status: "analyzing",
        });
      }, 500);
      
      setTimeout(() => {
        setResults(data.results);
        setAgentStatus("completed");
        addAgentLog({
          agentName: "Orchestrator",
          action: `Search complete! Found ${data.results.length} matching suppliers`,
          status: "completed",
        });
        setCurrentStep("results");
        toast({
          title: "Search complete",
          description: `Found ${data.results.length} matching suppliers`,
        });
      }, 1000);
    },
    onError: (error: Error) => {
      setAgentStatus("error");
      addAgentLog({
        agentName: "Search",
        action: "Search failed",
        status: "error",
        details: error.message,
      });
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((file: File, type: InputTypeValue) => {
    analyzeProductMutation.mutate({ inputType: type, file });
  }, [analyzeProductMutation]);

  const handleUrlSubmit = useCallback((url: string) => {
    analyzeProductMutation.mutate({ inputType: "url", url });
  }, [analyzeProductMutation]);

  const handleConstraintsSubmit = useCallback((constraints: SearchConstraints) => {
    searchMutation.mutate(constraints);
  }, [searchMutation]);

  const handleSupplierSelect = useCallback((match: SupplierMatch) => {
    toast({
      title: "Contact initiated",
      description: `Preparing to contact ${match.supplierName}`,
    });
  }, [toast]);

  const handleReset = useCallback(() => {
    setCurrentStep("upload");
    setSessionId(null);
    setProduct(null);
    setResults([]);
    setAgentLogs([]);
    setAgentStatus("idle");
  }, []);

  const handleBackToConstraints = useCallback(() => {
    setCurrentStep("configure");
    setResults([]);
  }, []);

  const isAnalyzing = analyzeProductMutation.isPending;
  const isSearching = searchMutation.isPending;
  const isProcessing = isAnalyzing || isSearching;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                SourceScout
              </h1>
              <p className="text-muted-foreground mt-1">
                AI-powered supplier discovery and comparison
              </p>
            </div>
            {currentStep !== "upload" && (
              <Button 
                variant="outline" 
                onClick={handleReset}
                className="gap-2"
                data-testid="button-new-search"
              >
                <RefreshCw className="h-4 w-4" />
                New Search
              </Button>
            )}
          </div>

          <div className="max-w-3xl mx-auto">
            <StepProgress currentStep={currentStep} isProcessing={isProcessing} />
          </div>
        </div>

        {currentStep === "upload" && (
          <div className="max-w-3xl mx-auto">
            <DropZone
              onFileSelect={handleFileSelect}
              onUrlSubmit={handleUrlSubmit}
              isLoading={isAnalyzing}
            />
          </div>
        )}

        {(currentStep === "analyze" || currentStep === "configure") && product && (
          <div className="grid gap-6 lg:grid-cols-2">
            <ProductDnaDisplay product={product} isLoading={isAnalyzing} />
            
            {currentStep === "configure" && (
              <div>
                <ConstraintBuilder
                  specifications={product.specifications}
                  onSubmit={handleConstraintsSubmit}
                  isLoading={isSearching}
                />
              </div>
            )}
            
            {currentStep === "analyze" && (
              <AgentActivityPanel
                logs={agentLogs}
                status={agentStatus}
              />
            )}
          </div>
        )}

        {currentStep === "search" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {product && (
                <ProductDnaDisplay product={product} />
              )}
              
              <div className="mt-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <SupplierMatchCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
            
            <div>
              <AgentActivityPanel
                logs={agentLogs}
                status={agentStatus}
              />
            </div>
          </div>
        )}

        {currentStep === "results" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={handleBackToConstraints}
                  className="gap-2"
                  data-testid="button-back-configure"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Modify Search
                </Button>
                <p className="text-muted-foreground">
                  Found <span className="font-medium text-foreground">{results.length}</span> matching suppliers
                </p>
              </div>

              <Tabs value={resultsView} onValueChange={(v) => setResultsView(v as "cards" | "matrix")}>
                <TabsList>
                  <TabsTrigger value="cards" className="gap-2" data-testid="tab-cards-view">
                    <LayoutList className="h-4 w-4" />
                    Cards
                  </TabsTrigger>
                  <TabsTrigger value="matrix" className="gap-2" data-testid="tab-matrix-view">
                    <Grid3X3 className="h-4 w-4" />
                    Compare
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {results.length === 0 ? (
              <EmptyState
                variant="no-results"
                onAction={handleBackToConstraints}
              />
            ) : resultsView === "cards" ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {results.map((match) => (
                  <SupplierMatchCard
                    key={match.id}
                    match={match}
                    onSelect={handleSupplierSelect}
                  />
                ))}
              </div>
            ) : (
              product && (
                <ComparisonMatrix
                  originalSpecs={product.specifications}
                  suppliers={results}
                  onSelectSupplier={handleSupplierSelect}
                />
              )
            )}

            <div className="mt-8">
              <AgentActivityPanel
                logs={agentLogs}
                status={agentStatus}
                isExpanded={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
