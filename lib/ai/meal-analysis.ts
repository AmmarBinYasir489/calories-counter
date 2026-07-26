import { GoogleGenAI } from "@google/genai";
import { MEAL_IMAGE_ANALYSIS_PROMPT } from "@/lib/ai/meal-image-prompt";
import {
  MEAL_ANALYSIS_RESPONSE_JSON_SCHEMA,
  parseMealAnalysis,
  type MealAnalysis,
} from "@/lib/ai/meal-analysis-schema";

export { NonFoodImageError } from "@/lib/ai/meal-analysis-schema";

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
      responseJsonSchema: MEAL_ANALYSIS_RESPONSE_JSON_SCHEMA,
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty response");
  }

  return parseMealAnalysis(JSON.parse(response.text));
}
