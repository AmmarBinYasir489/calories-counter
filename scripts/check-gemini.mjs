import { GoogleGenAI } from "@google/genai";
import { MEAL_IMAGE_ANALYSIS_PROMPT } from "../lib/ai/meal-image-prompt.ts";
import {
  MEAL_ANALYSIS_RESPONSE_JSON_SCHEMA,
  NonFoodImageError,
  parseMealAnalysis,
} from "../lib/ai/meal-analysis-schema.ts";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

if (!apiKey) {
  console.error("Gemini check failed: GEMINI_API_KEY is not set.");
  process.exitCode = 1;
} else {
  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          inlineData: {
            mimeType: "image/png",
            data:
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          },
        },
        { text: MEAL_IMAGE_ANALYSIS_PROMPT },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: MEAL_ANALYSIS_RESPONSE_JSON_SCHEMA,
      },
    });

    try {
      parseMealAnalysis(JSON.parse(response.text || "{}"));
      throw new Error("Gemini incorrectly accepted a blank non-food image.");
    } catch (error) {
      if (!(error instanceof NonFoodImageError)) {
        throw error;
      }
    }

    console.log(
      `Gemini check passed: ${model} accepted image input, returned structured JSON, and rejected a non-food image.`,
    );
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? error.status
        : undefined;
    const message =
      error instanceof Error
        ? error.message.replaceAll(apiKey, "<redacted>")
        : "Unknown provider error";

    console.error(
      `Gemini check failed${status ? ` (${status})` : ""}: ${message}`,
    );
    process.exitCode = 1;
  }
}
