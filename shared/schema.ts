import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const ConstraintPriority = {
  MUST_HAVE: "must_have",
  FLEXIBLE: "flexible",
} as const;

export type ConstraintPriorityType = typeof ConstraintPriority[keyof typeof ConstraintPriority];

export const WorkflowStep = {
  UPLOAD: "upload",
  ANALYZE: "analyze",
  CONFIGURE: "configure",
  SEARCH: "search",
  RESULTS: "results",
} as const;

export type WorkflowStepType = typeof WorkflowStep[keyof typeof WorkflowStep];

export const AgentStatus = {
  IDLE: "idle",
  SEARCHING: "searching",
  ANALYZING: "analyzing",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

export type AgentStatusType = typeof AgentStatus[keyof typeof AgentStatus];

export const InputType = {
  URL: "url",
  IMAGE: "image",
  DOCUMENT: "document",
} as const;

export type InputTypeValue = typeof InputType[keyof typeof InputType];

export const productSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.string(),
  unit: z.string().optional(),
  category: z.enum(["dimensions", "material", "electrical", "certification", "other"]),
  priority: z.enum(["must_have", "flexible"]),
  icon: z.string().optional(),
});

export type ProductSpec = z.infer<typeof productSpecSchema>;

export const productDnaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
  inputType: z.enum(["url", "image", "document"]),
  specifications: z.array(productSpecSchema),
  brand: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  originalPrice: z.number().optional(),
  currency: z.string().default("USD"),
});

export type ProductDNA = z.infer<typeof productDnaSchema>;

export const searchConstraintsSchema = z.object({
  targetPrice: z.number().optional(),
  maxMoq: z.number().optional(),
  maxLeadTimeDays: z.number().optional(),
  specifications: z.array(productSpecSchema),
});

export type SearchConstraints = z.infer<typeof searchConstraintsSchema>;

export const supplierMatchSchema = z.object({
  id: z.string(),
  supplierName: z.string(),
  productName: z.string(),
  productUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z.number(),
  currency: z.string().default("USD"),
  moq: z.number().optional(),
  leadTimeDays: z.number().optional(),
  confidenceScore: z.number().min(0).max(100),
  priceDelta: z.number(),
  matchedSpecs: z.array(z.string()),
  mismatchedSpecs: z.array(z.string()),
  certifications: z.array(z.string()).optional(),
  location: z.string().optional(),
  trustBadges: z.array(z.string()).optional(),
});

export type SupplierMatch = z.infer<typeof supplierMatchSchema>;

export const agentLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  agentName: z.string(),
  action: z.string(),
  status: z.enum(["idle", "searching", "analyzing", "completed", "error"]),
  details: z.string().optional(),
});

export type AgentLogEntry = z.infer<typeof agentLogEntrySchema>;

export const sourcingSessionSchema = z.object({
  id: z.string(),
  currentStep: z.enum(["upload", "analyze", "configure", "search", "results"]),
  originalProduct: productDnaSchema.optional(),
  constraints: searchConstraintsSchema.optional(),
  results: z.array(supplierMatchSchema).optional(),
  agentLogs: z.array(agentLogEntrySchema).optional(),
  status: z.enum(["idle", "searching", "analyzing", "completed", "error"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SourcingSession = z.infer<typeof sourcingSessionSchema>;

export const analyzeProductRequestSchema = z.object({
  inputType: z.enum(["url", "image", "document"]),
  url: z.string().optional(),
  imageData: z.string().optional(),
  documentData: z.string().optional(),
  fileName: z.string().optional(),
});

export type AnalyzeProductRequest = z.infer<typeof analyzeProductRequestSchema>;

export const startSearchRequestSchema = z.object({
  sessionId: z.string(),
  constraints: searchConstraintsSchema,
});

export type StartSearchRequest = z.infer<typeof startSearchRequestSchema>;

export const uploadResponseSchema = z.object({
  success: z.boolean(),
  uploadUrl: z.string().optional(),
  objectPath: z.string().optional(),
  error: z.string().optional(),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;
