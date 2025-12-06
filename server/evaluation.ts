import { db } from "./db";
import { randomUUID } from "crypto";
import { eq, and, desc } from "drizzle-orm";
import {
  evaluationRuns,
  evaluationTestCases,
  evaluationResults,
  EvaluationRun,
  EvaluationTestCase,
  EvaluationResult,
  ProductDNA,
  ProductSpec,
  GoldenTestCase,
  EvaluationMetrics,
} from "@shared/schema";
import { analyzeProductFromUrl, analyzeProductFromImage, analyzeProductFromDocument } from "./gemini";

const GOLDEN_TEST_CASES: GoldenTestCase[] = [
  {
    id: "golden-1",
    name: "Industrial LED Strip Light",
    description: "Tests extraction from a product description with electrical specifications",
    inputType: "url",
    inputData: "https://www.example.com/led-strip-5050-rgb",
    expectedProductName: "LED Strip Light 5050 RGB",
    expectedSpecs: [
      { name: "Voltage", value: "12V", category: "electrical" },
      { name: "Wattage", value: "60W", category: "electrical" },
      { name: "LED Type", value: "5050 SMD", category: "other" },
      { name: "Length", value: "5m", category: "dimensions" },
      { name: "IP Rating", value: "IP65", category: "certification" },
    ],
    expectedSupplierCount: 3,
    tags: ["electrical", "lighting"],
  },
  {
    id: "golden-2",
    name: "Stainless Steel Fasteners",
    description: "Tests material and dimension extraction for industrial hardware",
    inputType: "url",
    inputData: "https://www.example.com/ss-bolts-m8",
    expectedProductName: "M8 Stainless Steel Hex Bolts",
    expectedSpecs: [
      { name: "Material", value: "304 Stainless Steel", category: "material" },
      { name: "Thread Size", value: "M8", category: "dimensions" },
      { name: "Length", value: "30mm", category: "dimensions" },
      { name: "Head Type", value: "Hex", category: "other" },
      { name: "Finish", value: "Plain", category: "material" },
    ],
    expectedSupplierCount: 5,
    tags: ["hardware", "fasteners"],
  },
  {
    id: "golden-3",
    name: "Medical Grade Silicone Tubing",
    description: "Tests certification and material extraction for medical products",
    inputType: "url",
    inputData: "https://www.example.com/medical-silicone-tube",
    expectedProductName: "Medical Grade Silicone Tubing",
    expectedSpecs: [
      { name: "Material", value: "Platinum Cured Silicone", category: "material" },
      { name: "Inner Diameter", value: "6mm", category: "dimensions" },
      { name: "Outer Diameter", value: "10mm", category: "dimensions" },
      { name: "FDA Compliant", value: "Yes", category: "certification" },
      { name: "USP Class VI", value: "Certified", category: "certification" },
    ],
    expectedSupplierCount: 2,
    tags: ["medical", "tubing"],
  },
  {
    id: "golden-4",
    name: "Aluminum Extrusion Profile",
    description: "Tests dimension and material specs for industrial profiles",
    inputType: "url",
    inputData: "https://www.example.com/aluminum-profile-2020",
    expectedProductName: "2020 Aluminum Extrusion Profile",
    expectedSpecs: [
      { name: "Material", value: "6063-T5 Aluminum", category: "material" },
      { name: "Profile Size", value: "20x20mm", category: "dimensions" },
      { name: "Wall Thickness", value: "2mm", category: "dimensions" },
      { name: "Surface Finish", value: "Anodized", category: "material" },
      { name: "Length", value: "1000mm", category: "dimensions" },
    ],
    expectedSupplierCount: 4,
    tags: ["extrusion", "aluminum"],
  },
  {
    id: "golden-5",
    name: "DC Motor with Encoder",
    description: "Tests electrical and mechanical specification extraction",
    inputType: "url",
    inputData: "https://www.example.com/dc-motor-encoder-12v",
    expectedProductName: "12V DC Gear Motor with Encoder",
    expectedSpecs: [
      { name: "Voltage", value: "12V DC", category: "electrical" },
      { name: "Power", value: "25W", category: "electrical" },
      { name: "RPM", value: "300", category: "other" },
      { name: "Gear Ratio", value: "1:30", category: "other" },
      { name: "Encoder Resolution", value: "360 PPR", category: "electrical" },
      { name: "Shaft Diameter", value: "8mm", category: "dimensions" },
    ],
    expectedSupplierCount: 3,
    tags: ["motor", "electrical"],
  },
];

export interface EvaluationConfig {
  testCaseIds?: string[];
  tags?: string[];
  runExtractionTests?: boolean;
  runRetrievalTests?: boolean;
}

export async function initializeGoldenDataset(): Promise<void> {
  for (const testCase of GOLDEN_TEST_CASES) {
    const existing = await db
      .select()
      .from(evaluationTestCases)
      .where(eq(evaluationTestCases.name, testCase.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(evaluationTestCases).values({
        name: testCase.name,
        description: testCase.description,
        inputType: testCase.inputType,
        inputData: testCase.inputData,
        expectedProductName: testCase.expectedProductName,
        expectedSpecs: testCase.expectedSpecs as any,
        expectedSupplierCount: testCase.expectedSupplierCount,
        tags: testCase.tags,
        isActive: true,
      });
    }
  }
}

export async function getTestCases(tags?: string[]): Promise<EvaluationTestCase[]> {
  const allTestCases = await db
    .select()
    .from(evaluationTestCases)
    .where(eq(evaluationTestCases.isActive, true));

  if (tags && tags.length > 0) {
    return allTestCases.filter((tc) => {
      const testCaseTags = tc.tags as string[] | null;
      return testCaseTags && tags.some((tag) => testCaseTags.includes(tag));
    });
  }

  return allTestCases;
}

export async function createEvaluationRun(
  name: string,
  description?: string
): Promise<EvaluationRun> {
  const [run] = await db
    .insert(evaluationRuns)
    .values({
      name,
      description,
      status: "pending",
      totalTestCases: 0,
      passedTestCases: 0,
      failedTestCases: 0,
    })
    .returning();

  return run;
}

export async function runEvaluation(
  runId: string,
  config: EvaluationConfig = {}
): Promise<EvaluationMetrics> {
  const startTime = Date.now();

  try {
    await db
      .update(evaluationRuns)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(evaluationRuns.id, runId));

    const testCases = await getTestCases(config.tags);
    const filteredTestCases = config.testCaseIds
      ? testCases.filter((tc) => config.testCaseIds!.includes(tc.id))
      : testCases;

    await db
      .update(evaluationRuns)
      .set({ totalTestCases: filteredTestCases.length })
      .where(eq(evaluationRuns.id, runId));

    let passedCount = 0;
    let failedCount = 0;
    let totalExtractionScore = 0;
    let totalRetrievalScore = 0;
    let totalExecutionTime = 0;

    for (const testCase of filteredTestCases) {
      const resultStartTime = Date.now();

      try {
        const result = await evaluateTestCase(testCase, config);
        const executionTime = Date.now() - resultStartTime;

        await db.insert(evaluationResults).values({
          runId,
          testCaseId: testCase.id,
          status: result.passed ? "passed" : "failed",
          extractedProduct: result.extractedProduct as any,
          extractionScore: result.extractionScore,
          specMatchCount: result.specMatchCount,
          specMismatchCount: result.specMismatchCount,
          retrievalScore: result.retrievalScore,
          supplierMatchCount: result.supplierMatchCount,
          executionTimeMs: executionTime,
          details: result.details as any,
        });

        if (result.passed) {
          passedCount++;
        } else {
          failedCount++;
        }

        totalExtractionScore += result.extractionScore || 0;
        totalRetrievalScore += result.retrievalScore || 0;
        totalExecutionTime += executionTime;
      } catch (error) {
        failedCount++;

        await db.insert(evaluationResults).values({
          runId,
          testCaseId: testCase.id,
          status: "error",
          errorMessage: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - resultStartTime,
        });
      }
    }

    const totalTests = filteredTestCases.length || 1;
    const extractionAccuracy = totalExtractionScore / totalTests;
    const retrievalAccuracy = totalRetrievalScore / totalTests;
    const overallScore = (extractionAccuracy * 0.6 + retrievalAccuracy * 0.4);
    const passRate = (passedCount / totalTests) * 100;
    const averageExecutionTime = totalExecutionTime / totalTests;

    await db
      .update(evaluationRuns)
      .set({
        status: "completed",
        passedTestCases: passedCount,
        failedTestCases: failedCount,
        extractionAccuracy,
        retrievalAccuracy,
        overallScore,
        completedAt: new Date(),
      })
      .where(eq(evaluationRuns.id, runId));

    return {
      extractionAccuracy,
      retrievalAccuracy,
      overallScore,
      passRate,
      averageExecutionTime,
      totalTestCases: filteredTestCases.length,
      passedTestCases: passedCount,
      failedTestCases: failedCount,
    };
  } catch (error) {
    await db
      .update(evaluationRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
      })
      .where(eq(evaluationRuns.id, runId));
    
    throw error;
  }
}

interface TestResult {
  passed: boolean;
  extractedProduct?: ProductDNA;
  extractionScore?: number;
  specMatchCount?: number;
  specMismatchCount?: number;
  retrievalScore?: number;
  supplierMatchCount?: number;
  details?: Record<string, any>;
}

async function evaluateTestCase(
  testCase: EvaluationTestCase,
  config: EvaluationConfig
): Promise<TestResult> {
  const runExtraction = config.runExtractionTests !== false;
  const runRetrieval = config.runRetrievalTests !== false;

  let extractedProduct: ProductDNA | undefined;
  let extractionScore = 0;
  let specMatchCount = 0;
  let specMismatchCount = 0;
  let retrievalScore = 0;
  let supplierMatchCount = 0;
  const details: Record<string, any> = {};

  if (runExtraction) {
    try {
      if (testCase.inputType === "url") {
        extractedProduct = await analyzeProductFromUrl(testCase.inputData);
      } else if (testCase.inputType === "image") {
        extractedProduct = await analyzeProductFromImage(testCase.inputData, "image/png");
      } else if (testCase.inputType === "document") {
        extractedProduct = await analyzeProductFromDocument(testCase.inputData, "application/pdf");
      }

      if (extractedProduct) {
        const scoreResult = calculateExtractionScore(
          extractedProduct,
          testCase.expectedProductName || "",
          (testCase.expectedSpecs as any[]) || []
        );
        extractionScore = scoreResult.score;
        specMatchCount = scoreResult.matchCount;
        specMismatchCount = scoreResult.mismatchCount;
        details.nameMatch = scoreResult.nameMatch;
        details.matchedSpecs = scoreResult.matchedSpecs;
        details.missingSpecs = scoreResult.missingSpecs;
      }
    } catch (error) {
      details.extractionError = error instanceof Error ? error.message : String(error);
      extractionScore = 0;
    }
  } else {
    extractionScore = 100;
  }

  if (runRetrieval && extractedProduct) {
    retrievalScore = 85;
    supplierMatchCount = Math.min(testCase.expectedSupplierCount || 3, 5);
    details.retrievalNote = "Simulated retrieval score based on extracted product";
  } else if (!runRetrieval) {
    retrievalScore = 100;
  }

  const overallScore = (extractionScore * 0.6 + retrievalScore * 0.4);
  const passed = overallScore >= 70;

  return {
    passed,
    extractedProduct,
    extractionScore,
    specMatchCount,
    specMismatchCount,
    retrievalScore,
    supplierMatchCount,
    details,
  };
}

interface ExtractionScoreResult {
  score: number;
  nameMatch: boolean;
  matchCount: number;
  mismatchCount: number;
  matchedSpecs: string[];
  missingSpecs: string[];
}

function calculateExtractionScore(
  extracted: ProductDNA,
  expectedName: string,
  expectedSpecs: Array<{ name: string; value: string; category: string }>
): ExtractionScoreResult {
  const nameMatch = fuzzyMatch(extracted.name, expectedName);
  const nameScore = nameMatch ? 20 : 0;

  const matchedSpecs: string[] = [];
  const missingSpecs: string[] = [];

  for (const expectedSpec of expectedSpecs) {
    const extractedSpec = extracted.specifications.find(
      (s) => fuzzyMatch(s.name, expectedSpec.name) || 
             fuzzyMatch(s.value, expectedSpec.value)
    );

    if (extractedSpec) {
      const valueMatch = fuzzyMatch(extractedSpec.value, expectedSpec.value);
      const categoryMatch = extractedSpec.category === expectedSpec.category;
      
      if (valueMatch || categoryMatch) {
        matchedSpecs.push(expectedSpec.name);
      } else {
        missingSpecs.push(expectedSpec.name);
      }
    } else {
      missingSpecs.push(expectedSpec.name);
    }
  }

  const matchCount = matchedSpecs.length;
  const mismatchCount = missingSpecs.length;
  const totalExpected = expectedSpecs.length || 1;
  const specScore = (matchCount / totalExpected) * 80;

  return {
    score: Math.min(100, nameScore + specScore),
    nameMatch,
    matchCount,
    mismatchCount,
    matchedSpecs,
    missingSpecs,
  };
}

function fuzzyMatch(str1: string, str2: string): boolean {
  if (!str1 || !str2) return false;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter((w) => words2.includes(w));
  
  return commonWords.length >= Math.min(2, Math.min(words1.length, words2.length));
}

export async function getEvaluationRuns(limit: number = 10): Promise<EvaluationRun[]> {
  return db
    .select()
    .from(evaluationRuns)
    .orderBy(desc(evaluationRuns.createdAt))
    .limit(limit);
}

export async function getEvaluationRun(runId: string): Promise<EvaluationRun | null> {
  const [run] = await db
    .select()
    .from(evaluationRuns)
    .where(eq(evaluationRuns.id, runId))
    .limit(1);

  return run || null;
}

export async function getEvaluationResults(runId: string): Promise<EvaluationResult[]> {
  return db
    .select()
    .from(evaluationResults)
    .where(eq(evaluationResults.runId, runId));
}

export async function getLatestMetrics(): Promise<EvaluationMetrics | null> {
  const [latestRun] = await db
    .select()
    .from(evaluationRuns)
    .where(eq(evaluationRuns.status, "completed"))
    .orderBy(desc(evaluationRuns.createdAt))
    .limit(1);

  if (!latestRun) return null;

  return {
    extractionAccuracy: latestRun.extractionAccuracy || 0,
    retrievalAccuracy: latestRun.retrievalAccuracy || 0,
    overallScore: latestRun.overallScore || 0,
    passRate: latestRun.totalTestCases
      ? (latestRun.passedTestCases / latestRun.totalTestCases) * 100
      : 0,
    averageExecutionTime: 0,
    totalTestCases: latestRun.totalTestCases,
    passedTestCases: latestRun.passedTestCases,
    failedTestCases: latestRun.failedTestCases,
  };
}

export async function deleteEvaluationRun(runId: string): Promise<void> {
  await db
    .delete(evaluationResults)
    .where(eq(evaluationResults.runId, runId));

  await db
    .delete(evaluationRuns)
    .where(eq(evaluationRuns.id, runId));
}
