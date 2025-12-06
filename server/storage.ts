import { 
  type User, 
  type InsertUser, 
  type SourcingSession, 
  type ProductDNA,
  type SupplierMatch,
  type AgentLogEntry,
  type SearchConstraints
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createSession(): Promise<SourcingSession>;
  getSession(id: string): Promise<SourcingSession | undefined>;
  updateSession(id: string, updates: Partial<SourcingSession>): Promise<SourcingSession | undefined>;
  setSessionProduct(id: string, product: ProductDNA): Promise<SourcingSession | undefined>;
  setSessionConstraints(id: string, constraints: SearchConstraints): Promise<SourcingSession | undefined>;
  setSessionResults(id: string, results: SupplierMatch[]): Promise<SourcingSession | undefined>;
  addAgentLog(sessionId: string, log: AgentLogEntry): Promise<SourcingSession | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private sessions: Map<string, SourcingSession>;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createSession(): Promise<SourcingSession> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const session: SourcingSession = {
      id,
      currentStep: "upload",
      status: "idle",
      agentLogs: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<SourcingSession | undefined> {
    return this.sessions.get(id);
  }

  async updateSession(id: string, updates: Partial<SourcingSession>): Promise<SourcingSession | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    
    const updatedSession: SourcingSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(id, updatedSession);
    return updatedSession;
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
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    
    const agentLogs = [...(session.agentLogs || []), log];
    return this.updateSession(sessionId, { agentLogs });
  }
}

export const storage = new MemStorage();
