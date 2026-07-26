import assert from "node:assert/strict";
import test from "node:test";
import {
  NonFoodImageError,
  parseMealAnalysis,
} from "../lib/ai/meal-analysis-schema.ts";

const emptySummary = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  sugar_g: 0,
  fiber_g: 0,
  sodium_mg: 0,
};

test("rejects images that Gemini classifies as non-food", () => {
  assert.throws(
    () =>
      parseMealAnalysis({
        is_food_image: false,
        rejection_reason: "The image shows a laptop.",
        items: [],
        total_summary: emptySummary,
        dietitian_tip: "",
        confidence_overall: 0,
      }),
    NonFoodImageError,
  );
});

test("accepts a food image only when it contains identified meal items", () => {
  const analysis = parseMealAnalysis({
    is_food_image: true,
    rejection_reason: "",
    items: [
      {
        name: "Aloo paratha",
        portion_estimate: "1 medium paratha",
        confidence: 88,
        calories: 320,
        protein_g: 8,
        carbs_g: 46,
        fat_g: 12,
        sugar_g: 2,
        fiber_g: 5,
        sodium_mg: 410,
      },
    ],
    total_summary: {
      ...emptySummary,
      calories: 320,
      protein_g: 8,
      carbs_g: 46,
      fat_g: 12,
      sugar_g: 2,
      fiber_g: 5,
      sodium_mg: 410,
    },
    dietitian_tip: "Pair it with yogurt for more protein.",
    confidence_overall: 88,
  });

  assert.equal(analysis.items[0].name, "Aloo paratha");
});

test("rejects a food verdict without any identified food", () => {
  assert.throws(() =>
    parseMealAnalysis({
      is_food_image: true,
      rejection_reason: "",
      items: [],
      total_summary: emptySummary,
      dietitian_tip: "",
      confidence_overall: 0,
    }),
  );
});
