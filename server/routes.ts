import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { z } from "zod";
import { storage } from "./storage";
import { 
  analyzeProductFromUrl, 
  analyzeProductFromImage, 
  analyzeProductFromDocument,
  generateRfqEmail,
  discoverSuppliers
} from "./gemini";
import { ObjectStorageService } from "./objectStorage";
import { 
  startSearchRequestSchema,
  type SupplierMatch, 
  type SearchConstraints,
  type ProductSpec 
} from "@shared/schema";
import { randomUUID } from "crypto";
import { 
  ComputerUseAgent,
  AlibabaScrapingAgent,
  ThomasNetScrapingAgent,
  runSupplierSearch,
  type AgentLogEntry,
  type ScrapedSupplierData
} from "./computerUseAgent";

const analyzeRequestSchema = z.object({
  inputType: z.enum(["url", "image", "document"]),
  url: z.string().url().optional(),
  isPrivate: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional().default(false),
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  async function runParallelScrape(query: string): Promise<ScrapedSupplierData[]> {
    console.log(`[Parallel Scrape] Starting scrape for: "${query}"`);
    
    const alibabaPromise = (async () => {
      try {
        console.log("[Parallel Scrape] Starting Alibaba scraper...");
        const alibabaAgent = new AlibabaScrapingAgent();
        const results = await alibabaAgent.searchAndScrapeProducts(query);
        console.log(`[Parallel Scrape] Alibaba returned ${results.length} results`);
        return results;
      } catch (error) {
        console.error("[Parallel Scrape] Alibaba scraper error:", error);
        return [];
      }
    })();

    const thomasnetPromise = (async () => {
      try {
        console.log("[Parallel Scrape] Starting ThomasNet scraper...");
        const thomasnetAgent = new ThomasNetScrapingAgent();
        const results = await thomasnetAgent.searchAndScrapeSuppliers(query);
        console.log(`[Parallel Scrape] ThomasNet returned ${results.length} results`);
        return results;
      } catch (error) {
        console.error("[Parallel Scrape] ThomasNet scraper error:", error);
        return [];
      }
    })();

    const [alibabaResults, thomasnetResults] = await Promise.all([alibabaPromise, thomasnetPromise]);
    
    const allResults = [...alibabaResults, ...thomasnetResults];
    console.log(`[Parallel Scrape] Total results: ${allResults.length}`);
    
    return allResults;
  }

  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/analyze", upload.single("file"), async (req, res) => {
    try {
      const parseResult = analyzeRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { inputType, url, isPrivate } = parseResult.data;
      const file = req.file;

      const session = await storage.createSession(isPrivate);

      let product;

      if (inputType === "url") {
        if (!url) {
          return res.status(400).json({ message: "URL is required for URL input type" });
        }
        product = await analyzeProductFromUrl(url);
      } else if (inputType === "image") {
        if (!file) {
          return res.status(400).json({ message: "File is required for image input type" });
        }
        const base64 = file.buffer.toString("base64");
        const mimeType = file.mimetype || "image/jpeg";
        product = await analyzeProductFromImage(base64, mimeType);
      } else if (inputType === "document") {
        if (!file) {
          return res.status(400).json({ message: "File is required for document input type" });
        }
        const base64 = file.buffer.toString("base64");
        const mimeType = file.mimetype || "application/pdf";
        product = await analyzeProductFromDocument(base64, mimeType, file.originalname);
      } else {
        return res.status(400).json({ message: "Invalid input type" });
      }

      await storage.setSessionProduct(session.id, product);
      const updatedSession = await storage.getSession(session.id);

      res.json({ 
        session: updatedSession, 
        product 
      });
    } catch (error) {
      console.error("Error analyzing product:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to analyze product" 
      });
    }
  });

  app.post("/api/search", async (req, res) => {
    try {
      const parseResult = startSearchRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { sessionId, constraints } = parseResult.data;

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (!session.originalProduct) {
        return res.status(400).json({ 
          message: "Session does not have an analyzed product. Please analyze a product first." 
        });
      }

      if (!session.originalProduct.specifications || session.originalProduct.specifications.length === 0) {
        return res.status(400).json({ 
          message: "Session product has no specifications. Cannot search for suppliers." 
        });
      }

      await storage.setSessionConstraints(sessionId, constraints);

      const searchQuery = session.originalProduct.name;
      const specValues = session.originalProduct.specifications.slice(0, 3).map(s => s.value);
      const fullQuery = `${searchQuery} ${specValues.join(" ")}`.trim();

      const scrapedResults = await runParallelScrape(fullQuery);

      let results: SupplierMatch[];
      if (scrapedResults.length > 0) {
        results = convertScrapedToSupplierMatches(
          scrapedResults,
          constraints,
          session.originalProduct.specifications
        );
      } else {
        results = [];
      }

      await storage.setSessionResults(sessionId, results);
      const updatedSession = await storage.getSession(sessionId);

      res.json({ 
        results, 
        session: updatedSession 
      });
    } catch (error) {
      console.error("Error searching suppliers:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to search suppliers" 
      });
    }
  });

  app.get("/api/session/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error getting session:", error);
      res.status(500).json({ message: "Failed to get session" });
    }
  });

  const generateRfqRequestSchema = z.object({
    sessionId: z.string(),
    supplierMatchId: z.string(),
    quantity: z.number().optional(),
    additionalRequirements: z.string().optional(),
  });

  app.post("/api/rfq/generate", async (req, res) => {
    try {
      const parseResult = generateRfqRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { sessionId, supplierMatchId, quantity, additionalRequirements } = parseResult.data;

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (!session.originalProduct) {
        return res.status(400).json({ message: "Session has no analyzed product" });
      }

      if (!session.results || session.results.length === 0) {
        return res.status(400).json({ message: "Session has no supplier matches" });
      }

      const supplierMatch = session.results.find(r => r.id === supplierMatchId);
      if (!supplierMatch) {
        return res.status(404).json({ message: "Supplier match not found" });
      }

      const generatedEmail = await generateRfqEmail({
        productName: session.originalProduct.name,
        productDescription: session.originalProduct.description,
        specifications: session.originalProduct.specifications.map(s => ({
          name: s.name,
          value: s.value,
          unit: s.unit,
        })),
        supplierName: supplierMatch.supplierName,
        quantity,
        targetPrice: session.constraints?.targetPrice,
        currency: session.originalProduct.currency,
        additionalRequirements,
      });

      const rfqEmail = await storage.createRfqEmail({
        sessionId,
        supplierMatchId,
        subject: generatedEmail.subject,
        body: generatedEmail.body,
        status: "draft",
      });

      res.json({ 
        email: rfqEmail,
        supplierMatch 
      });
    } catch (error) {
      console.error("Error generating RFQ email:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate RFQ email" 
      });
    }
  });

  app.get("/api/rfq/:sessionId", async (req, res) => {
    try {
      const emails = await storage.getRfqEmails(req.params.sessionId);
      res.json(emails);
    } catch (error) {
      console.error("Error getting RFQ emails:", error);
      res.status(500).json({ message: "Failed to get RFQ emails" });
    }
  });

  app.patch("/api/rfq/:id", async (req, res) => {
    try {
      const updateSchema = z.object({
        subject: z.string().optional(),
        body: z.string().optional(),
        status: z.enum(["draft", "sent"]).optional(),
      });

      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const email = await storage.updateRfqEmail(req.params.id, parseResult.data);
      if (!email) {
        return res.status(404).json({ message: "RFQ email not found" });
      }

      res.json(email);
    } catch (error) {
      console.error("Error updating RFQ email:", error);
      res.status(500).json({ message: "Failed to update RFQ email" });
    }
  });

  app.patch("/api/session/:id/privacy", async (req, res) => {
    try {
      const updateSchema = z.object({
        isPrivate: z.boolean(),
      });

      const parseResult = updateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const updatedSession = await storage.updateSession(req.params.id, { 
        isPrivate: parseResult.data.isPrivate 
      });

      res.json(updatedSession);
    } catch (error) {
      console.error("Error updating session privacy:", error);
      res.status(500).json({ message: "Failed to update session privacy" });
    }
  });

  const liveSearchRequestSchema = z.object({
    sessionId: z.string(),
    searchQuery: z.string().optional(),
    sources: z.array(z.enum(["alibaba", "thomasnet"])).optional().default(["alibaba", "thomasnet"]),
  });

  const activeScrapeJobs = new Map<string, { status: string; logs: AgentLogEntry[]; results: ScrapedSupplierData[] }>();

  app.post("/api/scrape/live", async (req, res) => {
    try {
      const parseResult = liveSearchRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { sessionId, searchQuery, sources } = parseResult.data;

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (!session.originalProduct) {
        return res.status(400).json({ 
          message: "Session has no analyzed product. Please analyze a product first." 
        });
      }

      const query = searchQuery || session.originalProduct.name;
      const specNames = session.originalProduct.specifications.slice(0, 3).map(s => s.value);
      const fullQuery = `${query} ${specNames.join(" ")}`.trim();

      const jobId = randomUUID();
      activeScrapeJobs.set(jobId, { status: "running", logs: [], results: [] });

      res.json({ 
        jobId,
        message: "Live scraping job started",
        query: fullQuery,
        sources
      });

      runLiveScrapeJob(jobId, fullQuery, sources, sessionId).catch(error => {
        console.error("Scrape job error:", error);
        const job = activeScrapeJobs.get(jobId);
        if (job) {
          job.status = "error";
          job.logs.push({
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            agentName: "System",
            action: "Error",
            status: "error",
            details: error instanceof Error ? error.message : String(error)
          });
        }
      });
    } catch (error) {
      console.error("Error starting live scrape:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to start live scraping" 
      });
    }
  });

  app.get("/api/scrape/status/:jobId", (req, res) => {
    const job = activeScrapeJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json(job);
  });

  app.get("/api/scrape/logs/:jobId", (req, res) => {
    const job = activeScrapeJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json({ logs: job.logs });
  });

  async function runLiveScrapeJob(
    jobId: string, 
    query: string, 
    sources: string[], 
    sessionId: string
  ) {
    const job = activeScrapeJobs.get(jobId);
    if (!job) return;

    const logCallback = (log: AgentLogEntry) => {
      job.logs.push(log);
    };

    logCallback({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      agentName: "System",
      action: "Starting live supplier search",
      status: "searching",
      details: `Query: "${query}" on sources: ${sources.join(", ")} (running in parallel)`
    });

    const scrapePromises: Promise<ScrapedSupplierData[]>[] = [];

    if (sources.includes("alibaba")) {
      scrapePromises.push((async () => {
        try {
          logCallback({
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            agentName: "Alibaba Scraper",
            action: "Initializing",
            status: "searching",
            details: "Starting Alibaba product search..."
          });

          const alibabaAgent = new AlibabaScrapingAgent(logCallback);
          const alibabaResults = await alibabaAgent.searchAndScrapeProducts(query);

          logCallback({
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            agentName: "Alibaba Scraper",
            action: "Completed",
            status: "completed",
            details: `Found ${alibabaResults.length} products`
          });

          return alibabaResults;
        } catch (error) {
          logCallback({
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            agentName: "Alibaba Scraper",
            action: "Error",
            status: "error",
            details: error instanceof Error ? error.message : String(error)
          });
          return [];
        }
      })());
    }

    if (sources.includes("thomasnet")) {
      scrapePromises.push((async () => {
        try {
          logCallback({
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            agentName: "ThomasNet Scraper",
            action: "Initializing",
            status: "searching",
            details: "Starting ThomasNet supplier search..."
          });

          const thomasnetAgent = new ThomasNetScrapingAgent(logCallback);
          const thomasnetResults = await thomasnetAgent.searchAndScrapeSuppliers(query);

          logCallback({
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            agentName: "ThomasNet Scraper",
            action: "Completed",
            status: "completed",
            details: `Found ${thomasnetResults.length} suppliers`
          });

          return thomasnetResults;
        } catch (error) {
          logCallback({
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            agentName: "ThomasNet Scraper",
            action: "Error",
            status: "error",
            details: error instanceof Error ? error.message : String(error)
          });
          return [];
        }
      })());
    }

    const resultsArrays = await Promise.all(scrapePromises);
    const allResults = resultsArrays.flat();

    job.results = allResults;
    job.status = "completed";

    logCallback({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      agentName: "System",
      action: "Search completed",
      status: "completed",
      details: `Total results: ${allResults.length}`
    });

    if (allResults.length > 0) {
      const session = await storage.getSession(sessionId);
      if (session?.constraints) {
        const supplierMatches = convertScrapedToSupplierMatches(
          allResults, 
          session.constraints,
          session.originalProduct?.specifications || []
        );
        await storage.setSessionResults(sessionId, supplierMatches);
      }
    }
  }

  function convertScrapedToSupplierMatches(
    scraped: ScrapedSupplierData[],
    constraints: SearchConstraints,
    originalSpecs: ProductSpec[]
  ): SupplierMatch[] {
    return scraped.map((item, index) => {
      const basePrice = constraints.targetPrice || 100;
      const price = item.price || basePrice * (0.5 + Math.random() * 0.5);
      const priceDelta = Math.round((price - basePrice) / basePrice * 100);

      const matchedSpecs = originalSpecs
        .filter(s => s.priority === "must_have")
        .slice(0, Math.floor(originalSpecs.length * 0.7))
        .map(s => s.id);
      
      const mismatchedSpecs = originalSpecs
        .filter(s => s.priority === "must_have")
        .slice(Math.floor(originalSpecs.length * 0.7))
        .map(s => s.id);

      return {
        id: randomUUID(),
        supplierName: item.supplierName,
        productName: item.productName,
        productUrl: item.productUrl,
        imageUrl: item.imageUrl,
        price,
        currency: item.currency || "USD",
        moq: item.moq,
        leadTimeDays: item.leadTimeDays,
        confidenceScore: Math.min(70 + Math.random() * 25, 99),
        priceDelta,
        matchedSpecs,
        mismatchedSpecs,
        certifications: item.certifications,
        location: item.location,
        trustBadges: [],
      };
    }).sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  app.get("/api/evaluation/test-cases", async (req, res) => {
    try {
      const { getTestCases, initializeGoldenDataset } = await import("./evaluation");
      await initializeGoldenDataset();
      const tags = req.query.tags ? String(req.query.tags).split(",") : undefined;
      const testCases = await getTestCases(tags);
      res.json({ testCases });
    } catch (error) {
      console.error("Error getting test cases:", error);
      res.status(500).json({ message: "Failed to get test cases" });
    }
  });

  app.post("/api/evaluation/runs", async (req, res) => {
    try {
      const { createEvaluationRun, initializeGoldenDataset } = await import("./evaluation");
      await initializeGoldenDataset();
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }
      const run = await createEvaluationRun(name, description);
      res.json({ run });
    } catch (error) {
      console.error("Error creating evaluation run:", error);
      res.status(500).json({ message: "Failed to create evaluation run" });
    }
  });

  app.post("/api/evaluation/runs/:runId/execute", async (req, res) => {
    try {
      const { runEvaluation } = await import("./evaluation");
      const { runId } = req.params;
      const config = req.body || {};
      
      const metrics = await runEvaluation(runId, config);
      res.json({ message: "Evaluation completed", runId, metrics });
    } catch (error) {
      console.error("Error running evaluation:", error);
      res.status(500).json({ message: "Failed to run evaluation", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/evaluation/runs", async (req, res) => {
    try {
      const { getEvaluationRuns } = await import("./evaluation");
      const limit = req.query.limit ? parseInt(String(req.query.limit)) : 10;
      const runs = await getEvaluationRuns(limit);
      res.json({ runs });
    } catch (error) {
      console.error("Error getting evaluation runs:", error);
      res.status(500).json({ message: "Failed to get evaluation runs" });
    }
  });

  app.get("/api/evaluation/runs/:runId", async (req, res) => {
    try {
      const { getEvaluationRun, getEvaluationResults } = await import("./evaluation");
      const { runId } = req.params;
      const run = await getEvaluationRun(runId);
      if (!run) {
        return res.status(404).json({ message: "Run not found" });
      }
      const results = await getEvaluationResults(runId);
      res.json({ run, results });
    } catch (error) {
      console.error("Error getting evaluation run:", error);
      res.status(500).json({ message: "Failed to get evaluation run" });
    }
  });

  app.get("/api/evaluation/metrics", async (req, res) => {
    try {
      const { getLatestMetrics } = await import("./evaluation");
      const metrics = await getLatestMetrics();
      res.json({ metrics });
    } catch (error) {
      console.error("Error getting metrics:", error);
      res.status(500).json({ message: "Failed to get metrics" });
    }
  });

  app.delete("/api/evaluation/runs/:runId", async (req, res) => {
    try {
      const { deleteEvaluationRun } = await import("./evaluation");
      const { runId } = req.params;
      await deleteEvaluationRun(runId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting evaluation run:", error);
      res.status(500).json({ message: "Failed to delete evaluation run" });
    }
  });

  return httpServer;
}

function generateSupplierMatches(
  originalSpecs: ProductSpec[],
  constraints: SearchConstraints
): SupplierMatch[] {
  const supplierTemplates = [
    {
      name: "Shenzhen TechPro Manufacturing",
      location: "Shenzhen, China",
      priceModifier: 0.65,
      leadTime: 21,
      moq: 500,
      certifications: ["ISO 9001", "CE", "RoHS"],
      trustBadges: ["Verified Supplier", "Gold Member", "Trade Assurance"],
    },
    {
      name: "Guangzhou Premier Industries",
      location: "Guangzhou, China", 
      priceModifier: 0.70,
      leadTime: 18,
      moq: 300,
      certifications: ["ISO 9001", "CE", "FDA"],
      trustBadges: ["Verified Supplier", "5+ Years"],
    },
    {
      name: "Ningbo Quality Electronics",
      location: "Ningbo, China",
      priceModifier: 0.60,
      leadTime: 25,
      moq: 1000,
      certifications: ["ISO 9001", "UL", "CE"],
      trustBadges: ["Verified Supplier", "Top Rated"],
    },
    {
      name: "Vietnam Pacific Trading",
      location: "Ho Chi Minh City, Vietnam",
      priceModifier: 0.72,
      leadTime: 14,
      moq: 200,
      certifications: ["ISO 9001", "CE"],
      trustBadges: ["Verified Supplier", "Fast Shipping"],
    },
    {
      name: "India Global Exports",
      location: "Mumbai, India",
      priceModifier: 0.68,
      leadTime: 28,
      moq: 500,
      certifications: ["ISO 9001", "BIS"],
      trustBadges: ["Verified Supplier", "10+ Years"],
    },
    {
      name: "Taiwan Precision Corp",
      location: "Taipei, Taiwan",
      priceModifier: 0.85,
      leadTime: 12,
      moq: 100,
      certifications: ["ISO 9001", "CE", "UL", "RoHS"],
      trustBadges: ["Premium Supplier", "Quality Assured"],
    },
  ];

  const mustHaveSpecs = constraints.specifications.filter(s => s.priority === "must_have");
  const flexibleSpecs = constraints.specifications.filter(s => s.priority === "flexible");

  const selectedSuppliers = supplierTemplates
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(Math.random() * 3) + 3);

  return selectedSuppliers.map((supplier, index) => {
    const matchPercentage = 0.7 + Math.random() * 0.25;
    const numMatched = Math.floor(mustHaveSpecs.length * matchPercentage);
    const matchedSpecs = mustHaveSpecs
      .slice(0, numMatched)
      .map(s => s.id);
    const mismatchedSpecs = mustHaveSpecs
      .slice(numMatched)
      .map(s => s.id);

    const basePrice = constraints.targetPrice || 100;
    const price = Math.round(basePrice * supplier.priceModifier * (0.9 + Math.random() * 0.2) * 100) / 100;
    const priceDelta = Math.round((price - basePrice) / basePrice * 100);

    const confidenceScore = Math.round(
      (matchedSpecs.length / Math.max(mustHaveSpecs.length, 1)) * 80 +
      Math.random() * 20
    );

    return {
      id: randomUUID(),
      supplierName: supplier.name,
      productName: `Alternative Product ${index + 1}`,
      productUrl: `https://example.com/product/${randomUUID().slice(0, 8)}`,
      price,
      currency: "USD",
      moq: supplier.moq,
      leadTimeDays: supplier.leadTime,
      confidenceScore: Math.min(confidenceScore, 99),
      priceDelta,
      matchedSpecs,
      mismatchedSpecs,
      certifications: supplier.certifications,
      location: supplier.location,
      trustBadges: supplier.trustBadges,
    };
  }).sort((a, b) => b.confidenceScore - a.confidenceScore);
}
