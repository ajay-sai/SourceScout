import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Target,
  Beaker,
  BarChart3,
  FileText,
  AlertCircle,
  Loader2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EvaluationRun, EvaluationTestCase, EvaluationResult, EvaluationMetrics } from "@shared/schema";

interface RunsResponse {
  runs: EvaluationRun[];
}

interface TestCasesResponse {
  testCases: EvaluationTestCase[];
}

interface RunDetailsResponse {
  run: EvaluationRun;
  results: EvaluationResult[];
}

interface MetricsResponse {
  metrics: EvaluationMetrics | null;
}

export default function Evaluation() {
  const { toast } = useToast();
  const [newRunName, setNewRunName] = useState("");
  const [newRunDescription, setNewRunDescription] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: runsData, isLoading: runsLoading, refetch: refetchRuns } = useQuery<RunsResponse>({
    queryKey: ["/api/evaluation/runs"],
  });

  const { data: testCasesData, isLoading: testCasesLoading } = useQuery<TestCasesResponse>({
    queryKey: ["/api/evaluation/test-cases"],
  });

  const { data: metricsData, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<MetricsResponse>({
    queryKey: ["/api/evaluation/metrics"],
  });

  const { data: runDetailsData, isLoading: runDetailsLoading } = useQuery<RunDetailsResponse>({
    queryKey: ["/api/evaluation/runs", selectedRunId],
    enabled: !!selectedRunId,
  });

  const createRunMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/evaluation/runs", { name: newRunName, description: newRunDescription });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Evaluation run created" });
      setNewRunName("");
      setNewRunDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation/runs"] });
      setSelectedRunId(data.run.id);
    },
    onError: (error) => {
      toast({ title: "Failed to create run", variant: "destructive" });
    },
  });

  const executeRunMutation = useMutation({
    mutationFn: async (runId: string) => {
      const res = await apiRequest("POST", `/api/evaluation/runs/${runId}/execute`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Evaluation completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation/metrics"] });
      if (selectedRunId) {
        queryClient.invalidateQueries({ queryKey: ["/api/evaluation/runs", selectedRunId] });
      }
    },
    onError: () => {
      toast({ title: "Failed to run evaluation", variant: "destructive" });
    },
  });

  const deleteRunMutation = useMutation({
    mutationFn: async (runId: string) => {
      const res = await apiRequest("DELETE", `/api/evaluation/runs/${runId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Run deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation/metrics"] });
      if (selectedRunId) {
        setSelectedRunId(null);
      }
    },
    onError: () => {
      toast({ title: "Failed to delete run", variant: "destructive" });
    },
  });

  const metrics = metricsData?.metrics;
  const runs = runsData?.runs || [];
  const testCases = testCasesData?.testCases || [];
  const selectedRun = runDetailsData?.run;
  const selectedResults = runDetailsData?.results || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "running":
        return <Badge className="bg-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
      case "failed":
      case "error":
        return <Badge className="bg-red-600"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8" data-testid="page-evaluation">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Evaluation Framework</h1>
        <p className="text-muted-foreground">
          Test and measure the accuracy of product extraction and supplier retrieval
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Score</p>
                <p className={`text-2xl font-bold ${metrics ? getScoreColor(metrics.overallScore) : ""}`}>
                  {metrics ? `${metrics.overallScore.toFixed(1)}%` : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Extraction Accuracy</p>
                <p className={`text-2xl font-bold ${metrics ? getScoreColor(metrics.extractionAccuracy) : ""}`}>
                  {metrics ? `${metrics.extractionAccuracy.toFixed(1)}%` : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Retrieval Accuracy</p>
                <p className={`text-2xl font-bold ${metrics ? getScoreColor(metrics.retrievalAccuracy) : ""}`}>
                  {metrics ? `${metrics.retrievalAccuracy.toFixed(1)}%` : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pass Rate</p>
                <p className={`text-2xl font-bold ${metrics ? getScoreColor(metrics.passRate) : ""}`}>
                  {metrics ? `${metrics.passRate.toFixed(1)}%` : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="runs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="runs" data-testid="tab-runs">
            <Beaker className="h-4 w-4 mr-2" />
            Evaluation Runs
          </TabsTrigger>
          <TabsTrigger value="test-cases" data-testid="tab-test-cases">
            <FileText className="h-4 w-4 mr-2" />
            Golden Test Cases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create New Evaluation Run</CardTitle>
              <CardDescription>Start a new evaluation to measure system accuracy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="run-name">Run Name</Label>
                  <Input
                    id="run-name"
                    placeholder="e.g., Weekly Regression Test"
                    value={newRunName}
                    onChange={(e) => setNewRunName(e.target.value)}
                    data-testid="input-run-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="run-description">Description (optional)</Label>
                  <Input
                    id="run-description"
                    placeholder="Description of this evaluation run"
                    value={newRunDescription}
                    onChange={(e) => setNewRunDescription(e.target.value)}
                    data-testid="input-run-description"
                  />
                </div>
              </div>
              <Button 
                onClick={() => createRunMutation.mutate()}
                disabled={!newRunName || createRunMutation.isPending}
                data-testid="button-create-run"
              >
                {createRunMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Create Evaluation Run
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                <CardTitle className="text-lg">Recent Runs</CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => refetchRuns()}
                  data-testid="button-refresh-runs"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {runsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : runs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Beaker className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No evaluation runs yet</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {runs.map((run) => (
                        <div
                          key={run.id}
                          className={`p-4 rounded-lg border cursor-pointer hover-elevate ${
                            selectedRunId === run.id ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => setSelectedRunId(run.id)}
                          data-testid={`card-run-${run.id}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <h4 className="font-medium truncate">{run.name}</h4>
                              {run.description && (
                                <p className="text-sm text-muted-foreground truncate">{run.description}</p>
                              )}
                            </div>
                            {getStatusBadge(run.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{run.totalTestCases} tests</span>
                            <span className="text-green-600">{run.passedTestCases} passed</span>
                            <span className="text-red-600">{run.failedTestCases} failed</span>
                          </div>
                          {run.overallScore !== null && (
                            <div className="mt-2">
                              <Progress value={run.overallScore} className="h-2" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Run Details</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedRunId ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a run to view details</p>
                  </div>
                ) : runDetailsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : selectedRun ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{selectedRun.name}</h3>
                        <p className="text-sm text-muted-foreground">{selectedRun.description}</p>
                      </div>
                      <div className="flex gap-2">
                        {selectedRun.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => executeRunMutation.mutate(selectedRun.id)}
                            disabled={executeRunMutation.isPending}
                            data-testid="button-execute-run"
                          >
                            {executeRunMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteRunMutation.mutate(selectedRun.id)}
                          disabled={deleteRunMutation.isPending}
                          data-testid="button-delete-run"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{selectedRun.totalTestCases}</p>
                        <p className="text-sm text-muted-foreground">Total Tests</p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-500/10">
                        <p className="text-2xl font-bold text-green-600">{selectedRun.passedTestCases}</p>
                        <p className="text-sm text-muted-foreground">Passed</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10">
                        <p className="text-2xl font-bold text-red-600">{selectedRun.failedTestCases}</p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                      </div>
                    </div>

                    {selectedResults.length > 0 && (
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {selectedResults.map((result) => (
                            <div
                              key={result.id}
                              className="p-3 rounded-lg border text-sm"
                              data-testid={`result-${result.id}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate">{result.testCaseId}</span>
                                {getStatusBadge(result.status)}
                              </div>
                              {result.extractionScore !== null && (
                                <div className="mt-1 text-muted-foreground">
                                  Extraction: {result.extractionScore?.toFixed(1)}% | 
                                  Specs: {result.specMatchCount}/{(result.specMatchCount || 0) + (result.specMismatchCount || 0)}
                                </div>
                              )}
                              {result.errorMessage && (
                                <p className="mt-1 text-red-600 text-xs">{result.errorMessage}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="test-cases">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Golden Dataset Test Cases</CardTitle>
              <CardDescription>
                Pre-defined test cases with expected product specifications for accuracy measurement
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testCasesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : testCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No test cases available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {testCases.map((testCase) => (
                    <div
                      key={testCase.id}
                      className="p-4 rounded-lg border"
                      data-testid={`test-case-${testCase.id}`}
                    >
                      <h4 className="font-medium mb-1">{testCase.name}</h4>
                      {testCase.description && (
                        <p className="text-sm text-muted-foreground mb-2">{testCase.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mb-2">
                        <Badge variant="outline">{testCase.inputType}</Badge>
                        {(testCase.tags as string[] | null)?.map((tag: string) => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                      {testCase.expectedProductName && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Expected: </span>
                          {testCase.expectedProductName}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {(testCase.expectedSpecs as any[] | null)?.length || 0} expected specs
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
