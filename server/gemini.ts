import { GoogleGenAI, Type } from "@google/genai";
import type { ProductDNA, ProductSpec } from "@shared/schema";
import { randomUUID } from "crypto";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

function extractJsonFromResponse(text: string | undefined): string {
  if (!text) return "{}";
  
  let cleaned = text.trim();
  
  const jsonCodeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonCodeBlockMatch) {
    cleaned = jsonCodeBlockMatch[1].trim();
  }
  
  return cleaned || "{}";
}

interface ExtractedProduct {
  name: string;
  description?: string;
  brand?: string;
  countryOfOrigin?: string;
  originalPrice?: number;
  currency?: string;
  specifications: Array<{
    name: string;
    value: string;
    unit?: string;
    category: "dimensions" | "material" | "electrical" | "certification" | "other";
  }>;
}

export async function analyzeProductFromUrl(url: string): Promise<ProductDNA> {
  const prompt = `Analyze this product URL and extract detailed product specifications.
URL: ${url}

Extract the following information:
1. Product name
2. Description
3. Brand (if available)
4. Country of origin (if available)
5. Price and currency (if available)
6. All technical specifications including:
   - Dimensions (width, height, depth, weight)
   - Materials used
   - Electrical specifications (voltage, wattage, etc.)
   - Certifications (CE, UL, FDA, etc.)
   - Any other relevant specifications

Return the data in a structured format.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          brand: { type: Type.STRING },
          countryOfOrigin: { type: Type.STRING },
          originalPrice: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          specifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.STRING },
                unit: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: ["name", "value", "category"]
            }
          }
        },
        required: ["name", "specifications"]
      }
    }
  });

  const extracted: ExtractedProduct = JSON.parse(extractJsonFromResponse(response.text));
  return convertToProductDNA(extracted, "url", url);
}

export async function analyzeProductFromImage(imageBase64: string, mimeType: string): Promise<ProductDNA> {
  const prompt = `Analyze this product image and extract detailed product specifications.

Look at the product carefully and extract:
1. Product name (identify what the product is)
2. Description of the product
3. Brand (if visible)
4. Visible specifications including:
   - Estimated dimensions
   - Materials (based on appearance)
   - Any visible certifications or labels
   - Color, finish, and other visual attributes
   - Any text or specifications visible on the product or packaging

Return the data in a structured format.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: imageBase64 } }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          brand: { type: Type.STRING },
          countryOfOrigin: { type: Type.STRING },
          originalPrice: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          specifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.STRING },
                unit: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: ["name", "value", "category"]
            }
          }
        },
        required: ["name", "specifications"]
      }
    }
  });

  const extracted: ExtractedProduct = JSON.parse(extractJsonFromResponse(response.text));
  return convertToProductDNA(extracted, "image");
}

export async function analyzeProductFromDocument(documentBase64: string, mimeType: string, fileName?: string): Promise<ProductDNA> {
  const prompt = `Analyze this product document/specification sheet and extract detailed product specifications.

Extract:
1. Product name
2. Description
3. Brand
4. Country of origin
5. Price information
6. All technical specifications including:
   - Dimensions
   - Materials
   - Electrical specifications
   - Certifications
   - Performance metrics
   - Any other specifications

Return the data in a structured format.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: documentBase64 } }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          brand: { type: Type.STRING },
          countryOfOrigin: { type: Type.STRING },
          originalPrice: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          specifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.STRING },
                unit: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: ["name", "value", "category"]
            }
          }
        },
        required: ["name", "specifications"]
      }
    }
  });

  const extracted: ExtractedProduct = JSON.parse(extractJsonFromResponse(response.text));
  return convertToProductDNA(extracted, "document");
}

function convertToProductDNA(
  extracted: ExtractedProduct, 
  inputType: "url" | "image" | "document",
  sourceUrl?: string
): ProductDNA {
  const specifications: ProductSpec[] = (extracted.specifications || []).map((spec, index) => ({
    id: randomUUID(),
    name: spec.name,
    value: spec.value,
    unit: spec.unit,
    category: validateCategory(spec.category),
    priority: "must_have" as const,
    icon: getCategoryIcon(spec.category),
  }));

  if (specifications.length === 0) {
    specifications.push({
      id: randomUUID(),
      name: "Product Type",
      value: extracted.name || "Unknown Product",
      category: "other",
      priority: "must_have",
    });
  }

  return {
    id: randomUUID(),
    name: extracted.name || "Analyzed Product",
    description: extracted.description,
    sourceUrl,
    inputType,
    specifications,
    brand: extracted.brand,
    countryOfOrigin: extracted.countryOfOrigin,
    originalPrice: extracted.originalPrice,
    currency: extracted.currency || "USD",
  };
}

function validateCategory(category: string): "dimensions" | "material" | "electrical" | "certification" | "other" {
  const validCategories = ["dimensions", "material", "electrical", "certification", "other"];
  const lowerCategory = category?.toLowerCase() || "other";
  
  if (validCategories.includes(lowerCategory)) {
    return lowerCategory as any;
  }
  
  if (lowerCategory.includes("dimension") || lowerCategory.includes("size") || lowerCategory.includes("weight")) {
    return "dimensions";
  }
  if (lowerCategory.includes("material") || lowerCategory.includes("composition")) {
    return "material";
  }
  if (lowerCategory.includes("electric") || lowerCategory.includes("power") || lowerCategory.includes("voltage")) {
    return "electrical";
  }
  if (lowerCategory.includes("cert") || lowerCategory.includes("compliance") || lowerCategory.includes("standard")) {
    return "certification";
  }
  
  return "other";
}

function getCategoryIcon(category: string): string | undefined {
  const icons: Record<string, string> = {
    dimensions: "ruler",
    material: "layers",
    electrical: "zap",
    certification: "shield-check",
    other: "info",
  };
  return icons[validateCategory(category)];
}

interface SupplierDiscoveryInput {
  productName: string;
  productDescription?: string;
  specifications: Array<{ name: string; value: string; unit?: string; category: string }>;
  targetPrice?: number;
  maxMoq?: number;
  maxLeadTimeDays?: number;
  currency?: string;
}

interface DiscoveredSupplier {
  supplierName: string;
  productName: string;
  description: string;
  estimatedPrice: number;
  currency: string;
  estimatedMoq: number;
  estimatedLeadTimeDays: number;
  location: string;
  certifications: string[];
  matchScore: number;
  matchedSpecs: string[];
  mismatchedSpecs: string[];
  specDifferences: Array<{ specName: string; originalValue: string; supplierValue: string; difference: string }>;
  supplierType: "manufacturer" | "distributor" | "trading_company";
  marketplaceSource: string;
  confidenceLevel: "high" | "medium" | "low";
}

interface AlternativeProduct {
  productName: string;
  supplierName: string;
  description: string;
  estimatedPrice: number;
  currency: string;
  estimatedMoq: number;
  location: string;
  alternativeType: "budget" | "premium" | "different_material" | "different_size" | "similar_function";
  whyAlternative: string;
  keyDifferences: string[];
  estimatedSavings?: number;
  tradeoffs: string[];
  matchScore: number;
}

export async function discoverSuppliers(input: SupplierDiscoveryInput): Promise<{
  suppliers: DiscoveredSupplier[];
  alternatives: AlternativeProduct[];
  searchTermsUsed: string[];
}> {
  const specsText = input.specifications
    .map(s => `- ${s.name}: ${s.value}${s.unit ? ` ${s.unit}` : ""} (${s.category})`)
    .join("\n");

  const prompt = `You are an expert industrial sourcing specialist with deep knowledge of global manufacturing, supplier networks, and product sourcing across major B2B platforms like Alibaba, ThomasNet, Global Sources, Made-in-China, and IndiaMART.

PRODUCT TO SOURCE:
Name: ${input.productName}
${input.productDescription ? `Description: ${input.productDescription}` : ""}

SPECIFICATIONS:
${specsText}

CONSTRAINTS:
${input.targetPrice ? `Target Price: ${input.currency || "USD"} ${input.targetPrice}` : "No specific target price"}
${input.maxMoq ? `Maximum MOQ: ${input.maxMoq} units` : "No MOQ constraint"}
${input.maxLeadTimeDays ? `Maximum Lead Time: ${input.maxLeadTimeDays} days` : "No lead time constraint"}

YOUR TASK:
Based on your extensive knowledge of the global manufacturing and supplier landscape, identify:

1. PRIMARY SUPPLIERS (5-8): Real-world typical suppliers who would manufacture or distribute this exact product or very close matches. Consider:
   - Chinese manufacturers on Alibaba/Made-in-China (typically offer lowest prices, higher MOQs)
   - US/European distributors on ThomasNet (premium pricing, lower MOQs, faster shipping)
   - Indian manufacturers on IndiaMART (competitive pricing, medium MOQs)
   - Specialized manufacturers based on the product category
   - Trading companies that aggregate from multiple factories

2. ALTERNATIVE PRODUCTS (3-5): Similar products that could serve the same function but differ in:
   - Budget alternatives (cheaper materials, simplified design)
   - Premium alternatives (higher quality, better features)
   - Different materials (e.g., plastic vs metal, different grades)
   - Different sizes or configurations
   - Products with similar function but different approach

For each supplier/alternative, provide realistic estimates based on typical market conditions for this product category.

Generate diverse results from different regions and supplier types. Be specific about location (city/region, country), realistic about pricing based on product complexity and materials, and accurate about typical MOQs and lead times for each supplier type.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suppliers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                supplierName: { type: Type.STRING },
                productName: { type: Type.STRING },
                description: { type: Type.STRING },
                estimatedPrice: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                estimatedMoq: { type: Type.NUMBER },
                estimatedLeadTimeDays: { type: Type.NUMBER },
                location: { type: Type.STRING },
                certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
                matchScore: { type: Type.NUMBER },
                matchedSpecs: { type: Type.ARRAY, items: { type: Type.STRING } },
                mismatchedSpecs: { type: Type.ARRAY, items: { type: Type.STRING } },
                specDifferences: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT,
                    properties: {
                      specName: { type: Type.STRING },
                      originalValue: { type: Type.STRING },
                      supplierValue: { type: Type.STRING },
                      difference: { type: Type.STRING }
                    }
                  } 
                },
                supplierType: { type: Type.STRING },
                marketplaceSource: { type: Type.STRING },
                confidenceLevel: { type: Type.STRING }
              },
              required: ["supplierName", "productName", "estimatedPrice", "location", "matchScore"]
            }
          },
          alternatives: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productName: { type: Type.STRING },
                supplierName: { type: Type.STRING },
                description: { type: Type.STRING },
                estimatedPrice: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                estimatedMoq: { type: Type.NUMBER },
                location: { type: Type.STRING },
                alternativeType: { type: Type.STRING },
                whyAlternative: { type: Type.STRING },
                keyDifferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                estimatedSavings: { type: Type.NUMBER },
                tradeoffs: { type: Type.ARRAY, items: { type: Type.STRING } },
                matchScore: { type: Type.NUMBER }
              },
              required: ["productName", "supplierName", "estimatedPrice", "alternativeType", "whyAlternative"]
            }
          },
          searchTermsUsed: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["suppliers", "alternatives", "searchTermsUsed"]
      }
    }
  });

  const result = JSON.parse(extractJsonFromResponse(response.text));
  
  return {
    suppliers: result.suppliers || [],
    alternatives: result.alternatives || [],
    searchTermsUsed: result.searchTermsUsed || [input.productName]
  };
}

export async function expandSearchQuery(productName: string, specifications: Array<{ name: string; value: string; category: string }>): Promise<{
  expandedQueries: string[];
  categoryKeywords: string[];
  synonyms: string[];
}> {
  const specsText = specifications.slice(0, 5).map(s => `${s.name}: ${s.value}`).join(", ");
  
  const prompt = `Generate expanded search queries for sourcing this product:

Product: ${productName}
Key Specs: ${specsText}

Generate:
1. 5 different search query variations (including synonyms, industry terms, alternative names)
2. Relevant category keywords for B2B marketplaces
3. Common synonyms or alternative names for this product type

Focus on terms that would work well on Alibaba, ThomasNet, Global Sources, and other B2B platforms.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          expandedQueries: { type: Type.ARRAY, items: { type: Type.STRING } },
          categoryKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          synonyms: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["expandedQueries", "categoryKeywords", "synonyms"]
      }
    }
  });

  return JSON.parse(extractJsonFromResponse(response.text));
}

interface RfqEmailInput {
  productName: string;
  productDescription?: string;
  specifications: Array<{ name: string; value: string; unit?: string }>;
  supplierName: string;
  quantity?: number;
  targetPrice?: number;
  currency?: string;
  additionalRequirements?: string;
}

interface GeneratedRfqEmail {
  subject: string;
  body: string;
}

export async function generateRfqEmail(input: RfqEmailInput): Promise<GeneratedRfqEmail> {
  const specsText = input.specifications
    .map(s => `- ${s.name}: ${s.value}${s.unit ? ` ${s.unit}` : ""}`)
    .join("\n");

  const prompt = `Generate a professional Request for Quotation (RFQ) email to send to a supplier.

SUPPLIER: ${input.supplierName}

PRODUCT DETAILS:
Name: ${input.productName}
${input.productDescription ? `Description: ${input.productDescription}` : ""}

KEY SPECIFICATIONS:
${specsText}

${input.quantity ? `QUANTITY NEEDED: ${input.quantity} units` : ""}
${input.targetPrice ? `TARGET PRICE: ${input.currency || "USD"} ${input.targetPrice} per unit` : ""}
${input.additionalRequirements ? `ADDITIONAL REQUIREMENTS: ${input.additionalRequirements}` : ""}

Generate a professional, concise RFQ email with:
1. A clear subject line
2. A professional greeting
3. Brief introduction stating the purpose
4. Product specifications in a clear format
5. Request for pricing, lead time, and MOQ
6. Request for certifications if applicable
7. Professional closing

Keep the tone professional but friendly. The email should be ready to send.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          body: { type: Type.STRING },
        },
        required: ["subject", "body"]
      }
    }
  });

  const result: GeneratedRfqEmail = JSON.parse(extractJsonFromResponse(response.text));
  
  if (!result.subject || !result.body) {
    throw new Error("Failed to generate RFQ email - invalid response from AI");
  }

  return result;
}
