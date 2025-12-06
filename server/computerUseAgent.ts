import { chromium, Browser, Page, BrowserContext } from "playwright";
import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "crypto";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const COMPUTER_USE_MODEL = "gemini-2.5-computer-use-preview-10-2025";
const SCREEN_WIDTH = 1440;
const SCREEN_HEIGHT = 900;

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  agentName: string;
  action: string;
  status: "idle" | "searching" | "analyzing" | "completed" | "error";
  details?: string;
  screenshot?: string;
}

export interface ScrapedSupplierData {
  supplierName: string;
  productName: string;
  productUrl?: string;
  imageUrl?: string;
  price?: number;
  currency: string;
  moq?: number;
  leadTimeDays?: number;
  certifications?: string[];
  location?: string;
  description?: string;
  specifications?: Record<string, string>;
}

export type LogCallback = (log: AgentLogEntry) => void;

function denormalizeX(x: number, screenWidth: number): number {
  return Math.round((x / 1000) * screenWidth);
}

function denormalizeY(y: number, screenHeight: number): number {
  return Math.round((y / 1000) * screenHeight);
}

export class ComputerUseAgent {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private agentName: string;
  private logs: AgentLogEntry[] = [];
  private logCallback?: LogCallback;
  private maxTurns: number = 15;
  private isRunning: boolean = false;

  constructor(agentName: string, options?: { maxTurns?: number; logCallback?: LogCallback }) {
    this.agentName = agentName;
    if (options?.maxTurns) this.maxTurns = options.maxTurns;
    if (options?.logCallback) this.logCallback = options.logCallback;
  }

  private log(action: string, status: AgentLogEntry["status"], details?: string, screenshot?: string) {
    const entry: AgentLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      agentName: this.agentName,
      action,
      status,
      details,
      screenshot,
    };
    this.logs.push(entry);
    this.logCallback?.(entry);
    console.log(`[${this.agentName}] ${action}: ${details || ""}`);
  }

  getLogs(): AgentLogEntry[] {
    return [...this.logs];
  }

  async initialize(): Promise<void> {
    this.log("Initializing browser", "searching", "Starting Chromium browser...");
    
    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    this.page = await this.context.newPage();
    this.log("Browser initialized", "idle", "Ready to navigate");
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.log("Browser closed", "completed");
    }
  }

  async takeScreenshot(): Promise<Buffer> {
    if (!this.page) throw new Error("Browser not initialized");
    return await this.page.screenshot({ type: "png" });
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");
    this.log("Navigating", "searching", url);
    await this.page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await this.page.waitForTimeout(1000);
  }

  getCurrentUrl(): string {
    return this.page?.url() || "";
  }

  private async executeAction(functionCall: any): Promise<{ success: boolean; error?: string }> {
    if (!this.page) throw new Error("Browser not initialized");

    const fname = functionCall.name;
    const args = functionCall.args || {};

    this.log(`Executing action: ${fname}`, "analyzing", JSON.stringify(args));

    try {
      switch (fname) {
        case "open_web_browser":
          break;

        case "navigate":
          await this.page.goto(args.url, { waitUntil: "networkidle", timeout: 30000 });
          break;

        case "click_at": {
          const actualX = denormalizeX(args.x, SCREEN_WIDTH);
          const actualY = denormalizeY(args.y, SCREEN_HEIGHT);
          await this.page.mouse.click(actualX, actualY);
          break;
        }

        case "type_text_at": {
          const actualX = denormalizeX(args.x, SCREEN_WIDTH);
          const actualY = denormalizeY(args.y, SCREEN_HEIGHT);
          const text = args.text;
          const pressEnter = args.press_enter !== false;
          const clearFirst = args.clear_before_typing !== false;

          await this.page.mouse.click(actualX, actualY);
          
          if (clearFirst) {
            await this.page.keyboard.press("Control+A");
            await this.page.keyboard.press("Backspace");
          }
          
          await this.page.keyboard.type(text, { delay: 50 });
          
          if (pressEnter) {
            await this.page.keyboard.press("Enter");
          }
          break;
        }

        case "hover_at": {
          const actualX = denormalizeX(args.x, SCREEN_WIDTH);
          const actualY = denormalizeY(args.y, SCREEN_HEIGHT);
          await this.page.mouse.move(actualX, actualY);
          break;
        }

        case "scroll_document":
          const direction = args.direction;
          if (direction === "down") {
            await this.page.evaluate(() => window.scrollBy(0, 500));
          } else if (direction === "up") {
            await this.page.evaluate(() => window.scrollBy(0, -500));
          } else if (direction === "left") {
            await this.page.evaluate(() => window.scrollBy(-500, 0));
          } else if (direction === "right") {
            await this.page.evaluate(() => window.scrollBy(500, 0));
          }
          break;

        case "scroll_at": {
          const actualX = denormalizeX(args.x, SCREEN_WIDTH);
          const actualY = denormalizeY(args.y, SCREEN_HEIGHT);
          const scrollDirection = args.direction;
          const magnitude = args.magnitude || 800;
          const scrollAmount = (magnitude / 1000) * SCREEN_HEIGHT;

          await this.page.mouse.move(actualX, actualY);
          
          if (scrollDirection === "down") {
            await this.page.mouse.wheel(0, scrollAmount);
          } else if (scrollDirection === "up") {
            await this.page.mouse.wheel(0, -scrollAmount);
          }
          break;
        }

        case "key_combination":
          const keys = args.keys;
          await this.page.keyboard.press(keys);
          break;

        case "go_back":
          await this.page.goBack();
          break;

        case "go_forward":
          await this.page.goForward();
          break;

        case "wait_5_seconds":
          await this.page.waitForTimeout(5000);
          break;

        case "search":
          await this.page.goto("https://www.google.com", { waitUntil: "networkidle" });
          break;

        case "drag_and_drop": {
          const startX = denormalizeX(args.x, SCREEN_WIDTH);
          const startY = denormalizeY(args.y, SCREEN_HEIGHT);
          const endX = denormalizeX(args.destination_x, SCREEN_WIDTH);
          const endY = denormalizeY(args.destination_y, SCREEN_HEIGHT);
          
          await this.page.mouse.move(startX, startY);
          await this.page.mouse.down();
          await this.page.mouse.move(endX, endY);
          await this.page.mouse.up();
          break;
        }

        default:
          this.log(`Unknown action: ${fname}`, "error", "Action not implemented");
          return { success: false, error: `Unknown action: ${fname}` };
      }

      await this.page.waitForLoadState("networkidle").catch(() => {});
      await this.page.waitForTimeout(1000);

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Action error: ${fname}`, "error", errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async runTask(goal: string, initialUrl?: string): Promise<{ success: boolean; result?: string; logs: AgentLogEntry[] }> {
    if (this.isRunning) {
      throw new Error("Agent is already running a task");
    }

    this.isRunning = true;
    this.logs = [];

    try {
      await this.initialize();

      if (initialUrl) {
        await this.navigate(initialUrl);
      }

      this.log("Starting task", "searching", goal);

      const initialScreenshot = await this.takeScreenshot();
      const initialScreenshotBase64 = initialScreenshot.toString("base64");

      const contents: any[] = [
        {
          role: "user",
          parts: [
            { text: goal },
            { inlineData: { mimeType: "image/png", data: initialScreenshotBase64 } },
          ],
        },
      ];

      const config: any = {
        tools: [
          {
            computerUse: {
              environment: "ENVIRONMENT_BROWSER",
            },
          },
        ],
      };

      let finalResult: string | undefined;

      for (let turn = 0; turn < this.maxTurns; turn++) {
        this.log(`Turn ${turn + 1}/${this.maxTurns}`, "analyzing", "Sending to Gemini Computer Use model...");

        const response = await ai.models.generateContent({
          model: COMPUTER_USE_MODEL,
          contents,
          config,
        });

        if (!response.candidates || response.candidates.length === 0) {
          this.log("No response from model", "error");
          break;
        }

        const candidate = response.candidates[0];
        const parts = candidate.content?.parts || [];

        contents.push(candidate.content);

        const functionCalls = parts.filter((p: any) => p.functionCall);
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);

        if (textParts.length > 0) {
          this.log("Model thinking", "analyzing", textParts.join(" ").substring(0, 200));
        }

        if (functionCalls.length === 0) {
          finalResult = textParts.join(" ");
          this.log("Task completed", "completed", finalResult?.substring(0, 500));
          break;
        }

        const functionResponses: any[] = [];

        for (const part of functionCalls) {
          const functionCall = (part as any).functionCall;
          if (!functionCall) continue;
          
          const safetyDecision = functionCall.args?.safety_decision as { decision?: string; explanation?: string } | undefined;
          if (safetyDecision?.decision === "require_confirmation") {
            this.log("Safety confirmation required", "error", safetyDecision.explanation || "Unknown reason");
            functionResponses.push({
              name: functionCall.name,
              response: { 
                error: "Action blocked - requires human confirmation",
                url: this.getCurrentUrl(),
              },
            });
            continue;
          }

          const result = await this.executeAction(functionCall);
          
          await this.page!.waitForTimeout(500);
          const screenshot = await this.takeScreenshot();
          const screenshotBase64 = screenshot.toString("base64");

          functionResponses.push({
            name: functionCall.name,
            response: { 
              url: this.getCurrentUrl(),
              ...(result.error && { error: result.error }),
            },
            parts: [
              { inlineData: { mimeType: "image/png", data: screenshotBase64 } },
            ],
          });
        }

        contents.push({
          role: "user",
          parts: functionResponses.map((fr) => ({
            functionResponse: fr,
          })),
        });
      }

      return { success: true, result: finalResult, logs: this.logs };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log("Task failed", "error", errorMsg);
      return { success: false, logs: this.logs };
    } finally {
      await this.close();
      this.isRunning = false;
    }
  }

  protected async callModel(contents: any[], config: any): Promise<{ functionCalls: any[]; textParts: string[]; content: any } | null> {
    const response = await ai.models.generateContent({
      model: COMPUTER_USE_MODEL,
      contents,
      config,
    });

    if (!response.candidates || response.candidates.length === 0) {
      return null;
    }

    const candidate = response.candidates[0];
    const parts = candidate.content?.parts || [];
    const functionCalls = parts.filter((p: any) => p.functionCall);
    const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);

    return { functionCalls, textParts, content: candidate.content };
  }

  protected async executeFunctionCalls(functionCalls: any[]): Promise<any[]> {
    const functionResponses: any[] = [];

    for (const part of functionCalls) {
      const functionCall = (part as any).functionCall;
      if (!functionCall) continue;

      const safetyDecision = functionCall.args?.safety_decision as { decision?: string; explanation?: string } | undefined;
      if (safetyDecision?.decision === "require_confirmation") {
        functionResponses.push({
          name: functionCall.name,
          response: { 
            error: "Action blocked - requires human confirmation",
            url: this.getCurrentUrl(),
          },
        });
        continue;
      }

      const result = await this.executeAction(functionCall);
      
      await this.page!.waitForTimeout(500);
      const screenshot = await this.takeScreenshot();
      const screenshotBase64 = screenshot.toString("base64");

      functionResponses.push({
        name: functionCall.name,
        response: { 
          url: this.getCurrentUrl(),
          ...(result.error && { error: result.error }),
        },
        parts: [
          { inlineData: { mimeType: "image/png", data: screenshotBase64 } },
        ],
      });
    }

    return functionResponses;
  }

  async extractPageData<T>(extractionPrompt: string): Promise<T | null> {
    if (!this.page) throw new Error("Browser not initialized");

    const screenshot = await this.takeScreenshot();
    const screenshotBase64 = screenshot.toString("base64");
    const pageHtml = await this.page.content();
    const pageUrl = this.page.url();

    const prompt = `You are analyzing a webpage screenshot and extracting structured data.

Current URL: ${pageUrl}

${extractionPrompt}

Analyze the screenshot and extract the requested information. Return valid JSON only.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: screenshotBase64 } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    try {
      const text = response.text || "{}";
      let cleaned = text.trim();
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
      }
      return JSON.parse(cleaned) as T;
    } catch (error) {
      this.log("Data extraction failed", "error", String(error));
      return null;
    }
  }
}

export class AlibabaScrapingAgent extends ComputerUseAgent {
  private extractionCallback?: LogCallback;
  
  constructor(logCallback?: LogCallback) {
    super("Alibaba Scraper", { maxTurns: 15, logCallback });
    this.extractionCallback = logCallback;
  }

  async searchAndScrapeProducts(searchQuery: string, maxProducts: number = 5): Promise<ScrapedSupplierData[]> {
    const goal = `Search for "${searchQuery}" on Alibaba.com and browse the search results.

Your task:
1. Find the search box on the page
2. Type and search for: "${searchQuery}"
3. Wait for search results to load
4. Scroll down once to see more products
5. Once you see product listings with prices and supplier names visible, say "DONE - search results are visible"

Focus on making sure you can see:
- Product listings with images
- Prices and price ranges
- Supplier names
- MOQ (minimum order quantity) information

Do NOT click on individual products. Just make sure the search results are visible.`;

    try {
      const result = await this.runTaskAndExtract(goal, "https://www.alibaba.com", maxProducts);
      return result;
    } catch (error) {
      console.error("Alibaba scraping error:", error);
      return [];
    }
  }

  private async runTaskAndExtract(goal: string, initialUrl: string, maxProducts: number): Promise<ScrapedSupplierData[]> {
    await this.initialize();
    
    try {
      await this.navigate(initialUrl);

      const initialScreenshot = await this.takeScreenshot();
      const initialScreenshotBase64 = initialScreenshot.toString("base64");

      const contents: any[] = [
        {
          role: "user",
          parts: [
            { text: goal },
            { inlineData: { mimeType: "image/png", data: initialScreenshotBase64 } },
          ],
        },
      ];

      const config: any = {
        tools: [
          {
            computerUse: {
              environment: "ENVIRONMENT_BROWSER",
            },
          },
        ],
      };

      for (let turn = 0; turn < 15; turn++) {
        this.extractionCallback?.({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          agentName: "Alibaba Scraper",
          action: `Turn ${turn + 1}`,
          status: "analyzing",
          details: "Interacting with page..."
        });

        const response = await this.callModel(contents, config);
        if (!response) break;

        const { functionCalls, textParts, content } = response;
        contents.push(content);

        if (textParts.some((t: string) => t.includes("DONE") || t.includes("visible") || t.includes("results"))) {
          break;
        }

        if (functionCalls.length === 0) {
          break;
        }

        const functionResponses = await this.executeFunctionCalls(functionCalls);
        contents.push({
          role: "user",
          parts: functionResponses.map((fr) => ({
            functionResponse: fr,
          })),
        });
      }

      this.extractionCallback?.({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        agentName: "Alibaba Scraper",
        action: "Extracting data",
        status: "analyzing",
        details: "Using AI to extract product information..."
      });

      const extracted = await this.extractPageData<{ products: ScrapedSupplierData[] }>(`
Extract product and supplier information from this Alibaba search results page.

For each product listing visible, extract:
- supplierName: The company/supplier name
- productName: The product title/name  
- price: The price (number only, use lower value if range)
- currency: "USD"
- moq: Minimum order quantity (number only)
- location: Supplier location
- certifications: Any certifications shown (array)
- description: Brief product description

Return JSON: {"products": [{...}, {...}]}
Extract up to ${maxProducts} products. If no products visible, return {"products": []}.`);

      if (extracted?.products && Array.isArray(extracted.products)) {
        this.extractionCallback?.({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          agentName: "Alibaba Scraper",
          action: "Extraction complete",
          status: "completed",
          details: `Found ${extracted.products.length} products`
        });
        return extracted.products.slice(0, maxProducts);
      }

      return [];
    } finally {
      await this.close();
    }
  }
}

export class ThomasNetScrapingAgent extends ComputerUseAgent {
  private extractionCallback?: LogCallback;
  
  constructor(logCallback?: LogCallback) {
    super("ThomasNet Scraper", { maxTurns: 15, logCallback });
    this.extractionCallback = logCallback;
  }

  async searchAndScrapeSuppliers(searchQuery: string, maxSuppliers: number = 5): Promise<ScrapedSupplierData[]> {
    const goal = `Search for "${searchQuery}" suppliers on ThomasNet.com.

Your task:
1. Find the search box on the page
2. Type and search for: "${searchQuery}"
3. Wait for search results to load
4. Scroll down once to see more suppliers
5. Once you see supplier listings visible, say "DONE - supplier results are visible"

Focus on making sure you can see:
- Company/supplier names
- Location information
- Product categories or capabilities

Do NOT click on individual supplier profiles. Just make sure the search results are visible.`;

    try {
      const result = await this.runTaskAndExtract(goal, "https://www.thomasnet.com", maxSuppliers);
      return result;
    } catch (error) {
      console.error("ThomasNet scraping error:", error);
      return [];
    }
  }

  private async runTaskAndExtract(goal: string, initialUrl: string, maxSuppliers: number): Promise<ScrapedSupplierData[]> {
    await this.initialize();
    
    try {
      await this.navigate(initialUrl);

      const initialScreenshot = await this.takeScreenshot();
      const initialScreenshotBase64 = initialScreenshot.toString("base64");

      const contents: any[] = [
        {
          role: "user",
          parts: [
            { text: goal },
            { inlineData: { mimeType: "image/png", data: initialScreenshotBase64 } },
          ],
        },
      ];

      const config: any = {
        tools: [
          {
            computerUse: {
              environment: "ENVIRONMENT_BROWSER",
            },
          },
        ],
      };

      for (let turn = 0; turn < 15; turn++) {
        this.extractionCallback?.({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          agentName: "ThomasNet Scraper",
          action: `Turn ${turn + 1}`,
          status: "analyzing",
          details: "Interacting with page..."
        });

        const response = await this.callModel(contents, config);
        if (!response) break;

        const { functionCalls, textParts, content } = response;
        contents.push(content);

        if (textParts.some((t: string) => t.includes("DONE") || t.includes("visible") || t.includes("results"))) {
          break;
        }

        if (functionCalls.length === 0) {
          break;
        }

        const functionResponses = await this.executeFunctionCalls(functionCalls);
        contents.push({
          role: "user",
          parts: functionResponses.map((fr) => ({
            functionResponse: fr,
          })),
        });
      }

      this.extractionCallback?.({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        agentName: "ThomasNet Scraper",
        action: "Extracting data",
        status: "analyzing",
        details: "Using AI to extract supplier information..."
      });

      const extracted = await this.extractPageData<{ suppliers: ScrapedSupplierData[] }>(`
Extract supplier/company information from this ThomasNet search results page.

For each supplier listing visible, extract:
- supplierName: The company name
- productName: Their main product category or capability
- location: Company location (city, state)
- certifications: Any certifications shown (array)
- description: Brief company description

Return JSON: {"suppliers": [{...}, {...}]}
Extract up to ${maxSuppliers} suppliers. If no suppliers visible, return {"suppliers": []}.`);

      if (extracted?.suppliers && Array.isArray(extracted.suppliers)) {
        this.extractionCallback?.({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          agentName: "ThomasNet Scraper",
          action: "Extraction complete",
          status: "completed",
          details: `Found ${extracted.suppliers.length} suppliers`
        });
        return extracted.suppliers.slice(0, maxSuppliers).map(s => ({
          ...s,
          currency: "USD"
        }));
      }

      return [];
    } finally {
      await this.close();
    }
  }
}

export async function runSupplierSearch(
  productName: string,
  specifications: string[],
  logCallback?: LogCallback
): Promise<{ alibaba: ScrapedSupplierData[]; thomasnet: ScrapedSupplierData[]; logs: AgentLogEntry[] }> {
  const searchQuery = `${productName} ${specifications.slice(0, 3).join(" ")}`.trim();
  const allLogs: AgentLogEntry[] = [];

  const wrappedCallback = (log: AgentLogEntry) => {
    allLogs.push(log);
    logCallback?.(log);
  };

  const alibabaAgent = new AlibabaScrapingAgent(wrappedCallback);
  const thomasnetAgent = new ThomasNetScrapingAgent(wrappedCallback);

  const [alibabaResults, thomasnetResults] = await Promise.all([
    alibabaAgent.searchAndScrapeProducts(searchQuery).catch(() => []),
    thomasnetAgent.searchAndScrapeSuppliers(searchQuery).catch(() => []),
  ]);

  return {
    alibaba: alibabaResults,
    thomasnet: thomasnetResults,
    logs: allLogs,
  };
}
