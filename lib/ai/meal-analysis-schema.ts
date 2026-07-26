import { z } from "zod";

const nutrient = z.number().finite().min(0);

const MealItemSchema = z.object({
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
});

const NutritionSummarySchema = z.object({
  calories: nutrient,
  protein_g: nutrient,
  carbs_g: nutrient,
  fat_g: nutrient,
  sugar_g: nutrient,
  fiber_g: nutrient,
  sodium_mg: nutrient,
});

const GeminiMealResponseSchema = z.object({
  is_food_image: z.boolean(),
  rejection_reason: z.string().trim().max(240),
  items: z.array(MealItemSchema).max(30),
  total_summary: NutritionSummarySchema,
  dietitian_tip: z.string().trim().max(500),
  confidence_overall: z.number().finite().min(0).max(100),
});

export const MealAnalysisSchema = GeminiMealResponseSchema.extend({
  is_food_image: z.literal(true),
  items: z.array(MealItemSchema).min(1).max(30),
});

export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

const unsupportedProviderConstraints = new Set([
  "$schema",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
]);

function simplifyProviderSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(simplifyProviderSchema);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !unsupportedProviderConstraints.has(key))
      .map(([key, nestedValue]) => [
        key,
        simplifyProviderSchema(nestedValue),
      ]),
  );
}

export const MEAL_ANALYSIS_RESPONSE_JSON_SCHEMA = simplifyProviderSchema(
  z.toJSONSchema(GeminiMealResponseSchema),
);

export class NonFoodImageError extends Error {
  constructor() {
    super(
      "This photo does not appear to contain food or a drink. Upload a clear meal photo.",
    );
    this.name = "NonFoodImageError";
  }
}

export function parseMealAnalysis(value: unknown): MealAnalysis {
  const response = GeminiMealResponseSchema.parse(value);

  if (!response.is_food_image) {
    throw new NonFoodImageError();
  }

  return MealAnalysisSchema.parse(response);
}
