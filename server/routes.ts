import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { z } from "zod";
import { storage } from "./storage";
import { 
  analyzeProductFromUrl, 
  analyzeProductFromImage, 
  analyzeProductFromDocument 
} from "./gemini";
import { ObjectStorageService } from "./objectStorage";
import { 
  startSearchRequestSchema,
  type SupplierMatch, 
  type SearchConstraints,
  type ProductSpec 
} from "@shared/schema";
import { randomUUID } from "crypto";

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

      const results = generateSupplierMatches(
        session.originalProduct.specifications,
        constraints
      );

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
