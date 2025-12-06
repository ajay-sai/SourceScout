import { 
  type User, 
  type InsertUser, 
  type SourcingSession, 
  type ProductDNA,
  type SupplierMatch,
  type AgentLogEntry,
  type SearchConstraints,
  type Supplier,
  type InsertSupplier,
  type SupplierProduct,
  type InsertSupplierProduct,
  type ProductEmbedding,
  type InsertProductEmbedding,
  type RfqEmail,
  type InsertRfqEmail,
  users,
  sourcingSessions,
  suppliers,
  supplierProducts,
  productEmbeddings,
  rfqEmails,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createSession(isPrivate?: boolean): Promise<SourcingSession>;
  getSession(id: string): Promise<SourcingSession | undefined>;
  updateSession(id: string, updates: Partial<SourcingSession>): Promise<SourcingSession | undefined>;
  setSessionProduct(id: string, product: ProductDNA): Promise<SourcingSession | undefined>;
  setSessionConstraints(id: string, constraints: SearchConstraints): Promise<SourcingSession | undefined>;
  setSessionResults(id: string, results: SupplierMatch[]): Promise<SourcingSession | undefined>;
  addAgentLog(sessionId: string, log: AgentLogEntry): Promise<SourcingSession | undefined>;
  
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  getSupplierByName(name: string): Promise<Supplier | undefined>;
  getAllSuppliers(): Promise<Supplier[]>;
  updateSupplier(id: string, updates: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  
  createSupplierProduct(product: InsertSupplierProduct): Promise<SupplierProduct>;
  getSupplierProducts(supplierId: string): Promise<SupplierProduct[]>;
  getSupplierProduct(id: string): Promise<SupplierProduct | undefined>;
  
  createEmbedding(embedding: InsertProductEmbedding): Promise<ProductEmbedding>;
  getPublicEmbeddings(): Promise<ProductEmbedding[]>;
  
  createRfqEmail(email: InsertRfqEmail): Promise<RfqEmail>;
  getRfqEmails(sessionId: string): Promise<RfqEmail[]>;
  getRfqEmail(id: string): Promise<RfqEmail | undefined>;
  updateRfqEmail(id: string, updates: Partial<InsertRfqEmail>): Promise<RfqEmail | undefined>;
}

function dbRecordToSession(record: any): SourcingSession {
  return {
    id: record.id,
    currentStep: record.currentStep as "upload" | "analyze" | "configure" | "search" | "results",
    status: record.status as "idle" | "searching" | "analyzing" | "completed" | "error",
    originalProduct: record.originalProduct as ProductDNA | undefined,
    constraints: record.constraints as SearchConstraints | undefined,
    results: record.results as SupplierMatch[] | undefined,
    agentLogs: record.agentLogs as AgentLogEntry[] | undefined,
    isPrivate: record.isPrivate,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createSession(isPrivate: boolean = false): Promise<SourcingSession> {
    const [record] = await db.insert(sourcingSessions).values({
      currentStep: "upload",
      status: "idle",
      agentLogs: [],
      isPrivate,
    }).returning();
    
    return dbRecordToSession(record);
  }

  async getSession(id: string): Promise<SourcingSession | undefined> {
    const [record] = await db.select().from(sourcingSessions).where(eq(sourcingSessions.id, id));
    if (!record) return undefined;
    return dbRecordToSession(record);
  }

  async updateSession(id: string, updates: Partial<SourcingSession>): Promise<SourcingSession | undefined> {
    const dbUpdates: any = { updatedAt: new Date() };
    
    if (updates.currentStep !== undefined) dbUpdates.currentStep = updates.currentStep;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.originalProduct !== undefined) dbUpdates.originalProduct = updates.originalProduct;
    if (updates.constraints !== undefined) dbUpdates.constraints = updates.constraints;
    if (updates.results !== undefined) dbUpdates.results = updates.results;
    if (updates.agentLogs !== undefined) dbUpdates.agentLogs = updates.agentLogs;
    if (updates.isPrivate !== undefined) dbUpdates.isPrivate = updates.isPrivate;

    const [record] = await db
      .update(sourcingSessions)
      .set(dbUpdates)
      .where(eq(sourcingSessions.id, id))
      .returning();
    
    if (!record) return undefined;
    return dbRecordToSession(record);
  }

  async setSessionProduct(id: string, product: ProductDNA): Promise<SourcingSession | undefined> {
    return this.updateSession(id, { 
      originalProduct: product,
      currentStep: "configure",
      status: "idle"
    });
  }

  async setSessionConstraints(id: string, constraints: SearchConstraints): Promise<SourcingSession | undefined> {
    return this.updateSession(id, { 
      constraints,
      currentStep: "search",
      status: "searching"
    });
  }

  async setSessionResults(id: string, results: SupplierMatch[]): Promise<SourcingSession | undefined> {
    return this.updateSession(id, { 
      results,
      currentStep: "results",
      status: "completed"
    });
  }

  async addAgentLog(sessionId: string, log: AgentLogEntry): Promise<SourcingSession | undefined> {
    const session = await this.getSession(sessionId);
    if (!session) return undefined;
    
    const agentLogs = [...(session.agentLogs || []), log];
    return this.updateSession(sessionId, { agentLogs });
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const insertData = {
      name: supplier.name,
      location: supplier.location,
      website: supplier.website,
      contactEmail: supplier.contactEmail,
      certifications: supplier.certifications,
      trustBadges: supplier.trustBadges,
      averageLeadTime: supplier.averageLeadTime,
      minimumMoq: supplier.minimumMoq,
      productCategories: supplier.productCategories,
      isVerified: supplier.isVerified,
      sourceType: supplier.sourceType,
      lastScrapedAt: supplier.lastScrapedAt,
    };
    const [record] = await db.insert(suppliers).values(insertData as any).returning();
    return record;
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [record] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return record || undefined;
  }

  async getSupplierByName(name: string): Promise<Supplier | undefined> {
    const [record] = await db.select().from(suppliers).where(eq(suppliers.name, name));
    return record || undefined;
  }

  async getAllSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
  }

  async updateSupplier(id: string, updates: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.website !== undefined) updateData.website = updates.website;
    if (updates.contactEmail !== undefined) updateData.contactEmail = updates.contactEmail;
    if (updates.certifications !== undefined) updateData.certifications = updates.certifications;
    if (updates.trustBadges !== undefined) updateData.trustBadges = updates.trustBadges;
    if (updates.averageLeadTime !== undefined) updateData.averageLeadTime = updates.averageLeadTime;
    if (updates.minimumMoq !== undefined) updateData.minimumMoq = updates.minimumMoq;
    if (updates.productCategories !== undefined) updateData.productCategories = updates.productCategories;
    if (updates.isVerified !== undefined) updateData.isVerified = updates.isVerified;
    if (updates.sourceType !== undefined) updateData.sourceType = updates.sourceType;
    if (updates.lastScrapedAt !== undefined) updateData.lastScrapedAt = updates.lastScrapedAt;

    const [record] = await db
      .update(suppliers)
      .set(updateData as any)
      .where(eq(suppliers.id, id))
      .returning();
    return record || undefined;
  }

  async createSupplierProduct(product: InsertSupplierProduct): Promise<SupplierProduct> {
    const [record] = await db.insert(supplierProducts).values(product).returning();
    return record;
  }

  async getSupplierProducts(supplierId: string): Promise<SupplierProduct[]> {
    return db.select().from(supplierProducts).where(eq(supplierProducts.supplierId, supplierId));
  }

  async getSupplierProduct(id: string): Promise<SupplierProduct | undefined> {
    const [record] = await db.select().from(supplierProducts).where(eq(supplierProducts.id, id));
    return record || undefined;
  }

  async createEmbedding(embedding: InsertProductEmbedding): Promise<ProductEmbedding> {
    const [record] = await db.insert(productEmbeddings).values(embedding).returning();
    return record;
  }

  async getPublicEmbeddings(): Promise<ProductEmbedding[]> {
    return db.select().from(productEmbeddings).where(eq(productEmbeddings.isPublic, true));
  }

  async createRfqEmail(email: InsertRfqEmail): Promise<RfqEmail> {
    const [record] = await db.insert(rfqEmails).values(email).returning();
    return record;
  }

  async getRfqEmails(sessionId: string): Promise<RfqEmail[]> {
    return db.select().from(rfqEmails).where(eq(rfqEmails.sessionId, sessionId));
  }

  async getRfqEmail(id: string): Promise<RfqEmail | undefined> {
    const [record] = await db.select().from(rfqEmails).where(eq(rfqEmails.id, id));
    return record || undefined;
  }

  async updateRfqEmail(id: string, updates: Partial<InsertRfqEmail>): Promise<RfqEmail | undefined> {
    const [record] = await db
      .update(rfqEmails)
      .set(updates)
      .where(eq(rfqEmails.id, id))
      .returning();
    return record || undefined;
  }
}

export const storage = new DatabaseStorage();
