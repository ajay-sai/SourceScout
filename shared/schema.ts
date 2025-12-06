import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp, real, index, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const sourcingSessions = pgTable("sourcing_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  currentStep: text("current_step").notNull().default("upload"),
  status: text("status").notNull().default("idle"),
  originalProduct: jsonb("original_product"),
  constraints: jsonb("constraints"),
  results: jsonb("results"),
  agentLogs: jsonb("agent_logs"),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSourcingSessionSchema = createInsertSchema(sourcingSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSourcingSession = z.infer<typeof insertSourcingSessionSchema>;
export type SourcingSessionRecord = typeof sourcingSessions.$inferSelect;

export const suppliers = pgTable("suppliers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location"),
  website: text("website"),
  contactEmail: text("contact_email"),
  certifications: jsonb("certifications").$type<string[]>(),
  trustBadges: jsonb("trust_badges").$type<string[]>(),
  averageLeadTime: integer("average_lead_time"),
  minimumMoq: integer("minimum_moq"),
  productCategories: jsonb("product_categories").$type<string[]>(),
  isVerified: boolean("is_verified").default(false),
  sourceType: text("source_type"),
  lastScrapedAt: timestamp("last_scraped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("suppliers_name_idx").on(table.name),
]);

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export const supplierProducts = pgTable("supplier_products", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price"),
  currency: text("currency").default("USD"),
  moq: integer("moq"),
  leadTimeDays: integer("lead_time_days"),
  specifications: jsonb("specifications"),
  imageUrl: text("image_url"),
  productUrl: text("product_url"),
  scrapedAt: timestamp("scraped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("supplier_products_supplier_idx").on(table.supplierId),
]);

export const insertSupplierProductSchema = createInsertSchema(supplierProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSupplierProduct = z.infer<typeof insertSupplierProductSchema>;
export type SupplierProduct = typeof supplierProducts.$inferSelect;

export const productEmbeddings = pgTable("product_embeddings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  supplierProductId: varchar("supplier_product_id", { length: 36 }).references(() => supplierProducts.id),
  sessionId: varchar("session_id", { length: 36 }).references(() => sourcingSessions.id),
  embeddingType: text("embedding_type").notNull(),
  embedding: real("embedding").array(),
  textContent: text("text_content"),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductEmbeddingSchema = createInsertSchema(productEmbeddings).omit({
  id: true,
  createdAt: true,
});

export type InsertProductEmbedding = z.infer<typeof insertProductEmbeddingSchema>;
export type ProductEmbedding = typeof productEmbeddings.$inferSelect;

export const rfqEmails = pgTable("rfq_emails", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id", { length: 36 }).references(() => sourcingSessions.id).notNull(),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  supplierMatchId: varchar("supplier_match_id", { length: 36 }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").default("draft"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRfqEmailSchema = createInsertSchema(rfqEmails).omit({
  id: true,
  createdAt: true,
});

export type InsertRfqEmail = z.infer<typeof insertRfqEmailSchema>;
export type RfqEmail = typeof rfqEmails.$inferSelect;

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sourcingSessions),
}));

export const sourcingSessionsRelations = relations(sourcingSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sourcingSessions.userId],
    references: [users.id],
  }),
  embeddings: many(productEmbeddings),
  rfqEmails: many(rfqEmails),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(supplierProducts),
}));

export const supplierProductsRelations = relations(supplierProducts, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [supplierProducts.supplierId],
    references: [suppliers.id],
  }),
  embeddings: many(productEmbeddings),
}));

export const productEmbeddingsRelations = relations(productEmbeddings, ({ one }) => ({
  supplierProduct: one(supplierProducts, {
    fields: [productEmbeddings.supplierProductId],
    references: [supplierProducts.id],
  }),
  session: one(sourcingSessions, {
    fields: [productEmbeddings.sessionId],
    references: [sourcingSessions.id],
  }),
}));

export const rfqEmailsRelations = relations(rfqEmails, ({ one }) => ({
  session: one(sourcingSessions, {
    fields: [rfqEmails.sessionId],
    references: [sourcingSessions.id],
  }),
  supplier: one(suppliers, {
    fields: [rfqEmails.supplierId],
    references: [suppliers.id],
  }),
}));

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
  isPrivate: z.boolean().default(false),
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

export const evaluationRuns = pgTable("evaluation_runs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  totalTestCases: integer("total_test_cases").notNull().default(0),
  passedTestCases: integer("passed_test_cases").notNull().default(0),
  failedTestCases: integer("failed_test_cases").notNull().default(0),
  extractionAccuracy: real("extraction_accuracy"),
  retrievalAccuracy: real("retrieval_accuracy"),
  overallScore: real("overall_score"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEvaluationRunSchema = createInsertSchema(evaluationRuns).omit({
  id: true,
  createdAt: true,
});

export type InsertEvaluationRun = z.infer<typeof insertEvaluationRunSchema>;
export type EvaluationRun = typeof evaluationRuns.$inferSelect;

export const evaluationTestCases = pgTable("evaluation_test_cases", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  inputType: text("input_type").notNull(),
  inputData: text("input_data").notNull(),
  expectedProductName: text("expected_product_name"),
  expectedSpecs: jsonb("expected_specs").$type<ProductSpec[]>(),
  expectedSupplierCount: integer("expected_supplier_count"),
  tags: jsonb("tags").$type<string[]>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEvaluationTestCaseSchema = createInsertSchema(evaluationTestCases).omit({
  id: true,
  createdAt: true,
});

export type InsertEvaluationTestCase = z.infer<typeof insertEvaluationTestCaseSchema>;
export type EvaluationTestCase = typeof evaluationTestCases.$inferSelect;

export const evaluationResults = pgTable("evaluation_results", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id", { length: 36 }).references(() => evaluationRuns.id).notNull(),
  testCaseId: varchar("test_case_id", { length: 36 }).references(() => evaluationTestCases.id).notNull(),
  status: text("status").notNull().default("pending"),
  extractedProduct: jsonb("extracted_product"),
  extractionScore: real("extraction_score"),
  specMatchCount: integer("spec_match_count"),
  specMismatchCount: integer("spec_mismatch_count"),
  retrievalScore: real("retrieval_score"),
  supplierMatchCount: integer("supplier_match_count"),
  errorMessage: text("error_message"),
  executionTimeMs: integer("execution_time_ms"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEvaluationResultSchema = createInsertSchema(evaluationResults).omit({
  id: true,
  createdAt: true,
});

export type InsertEvaluationResult = z.infer<typeof insertEvaluationResultSchema>;
export type EvaluationResult = typeof evaluationResults.$inferSelect;

export const evaluationRunsRelations = relations(evaluationRuns, ({ many }) => ({
  results: many(evaluationResults),
}));

export const evaluationTestCasesRelations = relations(evaluationTestCases, ({ many }) => ({
  results: many(evaluationResults),
}));

export const evaluationResultsRelations = relations(evaluationResults, ({ one }) => ({
  run: one(evaluationRuns, {
    fields: [evaluationResults.runId],
    references: [evaluationRuns.id],
  }),
  testCase: one(evaluationTestCases, {
    fields: [evaluationResults.testCaseId],
    references: [evaluationTestCases.id],
  }),
}));

export const goldenTestCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  inputType: z.enum(["url", "image", "document"]),
  inputData: z.string(),
  expectedProductName: z.string().optional(),
  expectedSpecs: z.array(z.object({
    name: z.string(),
    value: z.string(),
    category: z.enum(["dimensions", "material", "electrical", "certification", "other"]),
  })).optional(),
  expectedSupplierCount: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export type GoldenTestCase = z.infer<typeof goldenTestCaseSchema>;

export const evaluationMetricsSchema = z.object({
  extractionAccuracy: z.number().min(0).max(100),
  retrievalAccuracy: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  passRate: z.number().min(0).max(100),
  averageExecutionTime: z.number(),
  totalTestCases: z.number(),
  passedTestCases: z.number(),
  failedTestCases: z.number(),
});

export type EvaluationMetrics = z.infer<typeof evaluationMetricsSchema>;
