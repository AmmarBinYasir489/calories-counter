import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { MEAL_IMAGE_ANALYSIS_PROMPT } from "@/lib/ai/meal-image-prompt";

const nutrient = z.number().finite().min(0);

export const MealAnalysisSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().trim().min(1).max(120),
      portion_estimate: z.string().trim().min(1).max(160),
      confidence: z.number().finite().min(0).max(100),
      calories: nutrient,
      protein_g: nutrient,
      carbs_g: nutrient,
      fat_g: nutrient,
      sugar_g: nutrient,
      fiber_g: nutrient,
      sodium_mg: nutrient,
    }),
  ).min(1).max(30),
  total_summary: z.object({
    calories: nutrient,
    protein_g: nutrient,
    carbs_g: nutrient,
    fat_g: nutrient,
    sugar_g: nutrient,
    fiber_g: nutrient,
    sodium_mg: nutrient,
  }),
  dietitian_tip: z.string().trim().max(500),
  confidence_overall: z.number().finite().min(0).max(100),
});

export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const RETIRED_GEMINI_MODELS = new Set(["gemini-3.1-flash-lite"]);

let geminiClient: GoogleGenAI | null = null;

export function getGeminiModel() {
  const configuredModel = process.env.GEMINI_MODEL?.trim();

  if (!configuredModel || RETIRED_GEMINI_MODELS.has(configuredModel)) {
    return DEFAULT_GEMINI_MODEL;
  }

  return configuredModel;
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  geminiClient ??= new GoogleGenAI({ apiKey });
  return geminiClient;
}

export async function analyzeMealImage(
  bytes: Uint8Array,
  mimeType: string,
): Promise<MealAnalysis> {
  const response = await getGeminiClient().models.generateContent({
    model: getGeminiModel(),
    contents: [
      {
        inlineData: {
          mimeType,
          data: Buffer.from(bytes).toString("base64"),
        },
      },
      { text: MEAL_IMAGE_ANALYSIS_PROMPT },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(MealAnalysisSchema),
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty response");
  }

  return MealAnalysisSchema.parse(JSON.parse(response.text));
}
