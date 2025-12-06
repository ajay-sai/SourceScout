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
