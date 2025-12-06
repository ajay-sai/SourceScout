import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Grid3X3, LayoutList, RefreshCw, Zap } from "lucide-react";

import { StepProgress } from "@/components/StepProgress";
import { DropZone } from "@/components/DropZone";
import { ProductDnaDisplay } from "@/components/ProductDnaDisplay";
import { ConstraintBuilder } from "@/components/ConstraintBuilder";
import { AgentActivityPanel } from "@/components/AgentActivityPanel";
import { SupplierMatchCard, SupplierMatchCardSkeleton } from "@/components/SupplierMatchCard";
import { ComparisonMatrix, ComparisonMatrixSkeleton } from "@/components/ComparisonMatrix";
import { EmptyState } from "@/components/EmptyState";
import { PrivacyToggle, PrivacyIndicator } from "@/components/PrivacyToggle";
import { AlternativeProductCard } from "@/components/AlternativeProductCard";

import type { 
  WorkflowStepType, 
  ProductDNA, 
  SearchConstraints, 
  SupplierMatch,
  AgentLogEntry,
  AgentStatusType,
  SourcingSession,
  InputTypeValue,
  AlternativeProduct
} from "@shared/schema";

interface ScrapeJobStatus {
  status: string;
  logs: AgentLogEntry[];
  results: Array<{
    supplierName: string;
    productName: string;
    price?: number;
    currency: string;
    moq?: number;
    location?: string;
  }>;
}

export default function Home() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WorkflowStepType>("upload");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductDNA | null>(null);
  const [results, setResults] = useState<SupplierMatch[]>([]);
  const [alternatives, setAlternatives] = useState<AlternativeProduct[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatusType>("idle");
  const [resultsView, setResultsView] = useState<"cards" | "matrix" | "alternatives">("cards");
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [scrapeJobId, setScrapeJobId] = useState<string | null>(null);
  const [isLiveScraping, setIsLiveScraping] = useState<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addAgentLog = useCallback((log: Omit<AgentLogEntry, "id" | "timestamp">) => {
    const newLog: AgentLogEntry = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setAgentLogs((prev) => [...prev, newLog]);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/scrape/status/${jobId}`);
      if (!response.ok) {
        throw new Error("Failed to get job status");
      }
      const data: ScrapeJobStatus = await response.json();
      
      if (data.logs && data.logs.length > 0) {
        setAgentLogs(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const newLogs = data.logs.filter((l: AgentLogEntry) => !existingIds.has(l.id));
          return [...prev, ...newLogs];
        });
      }
      
      if (data.status === "completed" || data.status === "error") {
        stopPolling();
        setIsLiveScraping(false);
        setScrapeJobId(null);
        
        if (data.status === "completed") {
          setAgentStatus("completed");
          
          if (!sessionId) {
            toast({
              title: "Scraping complete",
              description: "Results processed but session was lost",
              variant: "destructive",
            });
            setCurrentStep("configure");
            return;
          }
          
          const sessionResponse = await fetch(`/api/session/${sessionId}`);
          if (sessionResponse.ok) {
            const sessionData: SourcingSession = await sessionResponse.json();
            if (sessionData.results && sessionData.results.length > 0) {
              setResults(sessionData.results);
              queryClient.invalidateQueries({ queryKey: ['/api/session', sessionId] });
              setCurrentStep("results");
              toast({
                title: "Live scraping complete",
                description: `Found ${sessionData.results.length} suppliers from live sources`,
              });
            } else if (data.results && data.results.length > 0) {
              const convertedResults: SupplierMatch[] = data.results.map((r, index) => ({
                id: `scraped-${index}-${Date.now()}`,
                supplierName: r.supplierName,
                productName: r.productName,
                price: r.price || 0,
                currency: r.currency || "USD",
                moq: r.moq,
                location: r.location,
                confidenceScore: 75,
                priceDelta: 0,
                matchedSpecs: [],
                mismatchedSpecs: [],
              }));
              setResults(convertedResults);
              queryClient.invalidateQueries({ queryKey: ['/api/session', sessionId] });
              setCurrentStep("results");
              toast({
                title: "Live scraping complete",
                description: `Found ${data.results.length} suppliers from live sources`,
              });
            } else {
              toast({
                title: "Scraping complete",
                description: "No suppliers found matching your criteria",
                variant: "destructive",
              });
              setCurrentStep("configure");
            }
          } else {
            toast({
              title: "Session error",
              description: "Failed to retrieve session data",
              variant: "destructive",
            });
            setCurrentStep("configure");
          }
        } else {
          setAgentStatus("error");
          toast({
            title: "Live scraping failed",
            description: "An error occurred during supplier search",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, [sessionId, stopPolling, toast]);

  const analyzeProductMutation = useMutation({
    mutationFn: async (data: { inputType: InputTypeValue; url?: string; file?: File; isPrivate?: boolean }) => {
      const formData = new FormData();
      formData.append("inputType", data.inputType);
      formData.append("isPrivate", String(data.isPrivate ?? false));
      
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
      setIsPrivate(data.session.isPrivate);
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

  const updatePrivacyMutation = useMutation({
    mutationFn: async (newIsPrivate: boolean) => {
      if (!sessionId) throw new Error("No session to update");
      const response = await apiRequest("PATCH", `/api/session/${sessionId}/privacy`, {
        isPrivate: newIsPrivate,
      });
      return response.json() as Promise<SourcingSession>;
    },
    onSuccess: (session) => {
      setIsPrivate(session.isPrivate);
      toast({
        title: session.isPrivate ? "Private mode enabled" : "Public mode enabled",
        description: session.isPrivate 
          ? "Session data won't be stored in shared knowledge base" 
          : "Session data will contribute to shared knowledge base",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update privacy setting",
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
      return response.json() as Promise<{ 
        results: SupplierMatch[]; 
        alternatives: AlternativeProduct[];
        searchTermsUsed: string[];
        session: SourcingSession;
      }>;
    },
    onMutate: () => {
      setCurrentStep("search");
      setAgentStatus("searching");
      setResults([]);
      setAlternatives([]);
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
        setAlternatives(data.alternatives || []);
        setAgentStatus("completed");
        
        const altText = data.alternatives?.length ? ` + ${data.alternatives.length} alternatives` : "";
        addAgentLog({
          agentName: "Orchestrator",
          action: `Search complete! Found ${data.results.length} matching suppliers${altText}`,
          status: "completed",
        });
        setCurrentStep("results");
        toast({
          title: "Search complete",
          description: `Found ${data.results.length} suppliers${altText}`,
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

  const liveScrapeSearchMutation = useMutation({
    mutationFn: async (constraints: SearchConstraints) => {
      await apiRequest("POST", "/api/search", {
        sessionId,
        constraints,
      });
      
      const response = await apiRequest("POST", "/api/scrape/live", {
        sessionId,
        sources: ["alibaba", "thomasnet"],
      });
      return response.json() as Promise<{ jobId: string; message: string; query: string }>;
    },
    onMutate: () => {
      setCurrentStep("search");
      setAgentStatus("searching");
      setResults([]);
      setAgentLogs([]);
      addAgentLog({
        agentName: "Orchestrator",
        action: "Starting live supplier search...",
        status: "searching",
      });
    },
    onSuccess: (data) => {
      setScrapeJobId(data.jobId);
      setIsLiveScraping(true);
      
      addAgentLog({
        agentName: "System",
        action: `Searching for: "${data.query}"`,
        status: "searching",
        details: "Launching AI agents to scrape Alibaba and ThomasNet...",
      });
      
      pollingIntervalRef.current = setInterval(() => {
        pollJobStatus(data.jobId);
      }, 2000);
    },
    onError: (error: Error) => {
      setAgentStatus("error");
      addAgentLog({
        agentName: "System",
        action: "Live scraping failed to start",
        status: "error",
        details: error.message,
      });
      toast({
        title: "Failed to start live search",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((file: File, type: InputTypeValue) => {
    analyzeProductMutation.mutate({ inputType: type, file, isPrivate });
  }, [analyzeProductMutation, isPrivate]);

  const handleUrlSubmit = useCallback((url: string) => {
    analyzeProductMutation.mutate({ inputType: "url", url, isPrivate });
  }, [analyzeProductMutation, isPrivate]);

  const handleConstraintsSubmit = useCallback((constraints: SearchConstraints) => {
    searchMutation.mutate(constraints);
  }, [searchMutation]);

  const handleLiveScrapeSubmit = useCallback((constraints: SearchConstraints) => {
    if (!sessionId) {
      toast({
        title: "No session available",
        description: "Please analyze a product first",
        variant: "destructive",
      });
      return;
    }
    liveScrapeSearchMutation.mutate(constraints);
  }, [liveScrapeSearchMutation, sessionId, toast]);

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
    setIsPrivate(false);
  }, []);

  const handleBackToConstraints = useCallback(() => {
    setCurrentStep("configure");
    setResults([]);
  }, []);

  const handlePrivacyToggle = useCallback((newIsPrivate: boolean) => {
    if (sessionId) {
      updatePrivacyMutation.mutate(newIsPrivate);
    } else {
      setIsPrivate(newIsPrivate);
    }
  }, [sessionId, updatePrivacyMutation]);

  const isAnalyzing = analyzeProductMutation.isPending;
  const isSearching = searchMutation.isPending || liveScrapeSearchMutation.isPending || isLiveScraping;
  const isUpdatingPrivacy = updatePrivacyMutation.isPending;
  const isProcessing = isAnalyzing || isSearching;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                  SourceScout
                </h1>
                <p className="text-muted-foreground mt-1">
                  AI-powered supplier discovery and comparison
                </p>
              </div>
              {sessionId && <PrivacyIndicator isPrivate={isPrivate} />}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <PrivacyToggle
                isPrivate={isPrivate}
                onToggle={handlePrivacyToggle}
                disabled={isAnalyzing || isUpdatingPrivacy}
              />
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
                  onLiveScrape={handleLiveScrapeSubmit}
                  isLoading={searchMutation.isPending}
                  isLiveScraping={isLiveScraping}
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
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="ghost"
                  onClick={handleBackToConstraints}
                  className="gap-2"
                  data-testid="button-back-configure"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Modify Search
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="gap-2"
                  data-testid="button-search-new-product"
                >
                  <RefreshCw className="h-4 w-4" />
                  Search New Product
                </Button>
                <p className="text-muted-foreground text-sm">
                  Found <span className="font-medium text-foreground">{results.length}</span> matching suppliers
                </p>
              </div>

              <Tabs value={resultsView} onValueChange={(v) => setResultsView(v as "cards" | "matrix" | "alternatives")}>
                <TabsList>
                  <TabsTrigger value="cards" className="gap-2" data-testid="tab-cards-view">
                    <LayoutList className="h-4 w-4" />
                    Cards
                  </TabsTrigger>
                  <TabsTrigger value="matrix" className="gap-2" data-testid="tab-matrix-view">
                    <Grid3X3 className="h-4 w-4" />
                    Compare
                  </TabsTrigger>
                  {alternatives.length > 0 && (
                    <TabsTrigger value="alternatives" className="gap-2" data-testid="tab-alternatives-view">
                      <Zap className="h-4 w-4" />
                      Alternatives ({alternatives.length})
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </div>

            {results.length === 0 && alternatives.length === 0 ? (
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
                    sessionId={sessionId || undefined}
                  />
                ))}
              </div>
            ) : resultsView === "matrix" ? (
              product && (
                <ComparisonMatrix
                  originalSpecs={product.specifications}
                  suppliers={results}
                  onSelectSupplier={handleSupplierSelect}
                />
              )
            ) : resultsView === "alternatives" ? (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  These are alternative products that could serve a similar function with different trade-offs.
                </p>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {alternatives.map((alt) => (
                    <AlternativeProductCard key={alt.id} alternative={alt} />
                  ))}
                </div>
              </div>
            ) : null}

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
