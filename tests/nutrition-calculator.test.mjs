import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateNutritionTargets,
  ProfileInputSchema,
} from "../lib/nutrition/calculator.ts";

const baseProfile = {
  name: "Test User",
  age: 30,
  sexForEquation: "male",
  heightCm: 170,
  weightKg: 70,
  activityLevel: "moderate",
  goal: "maintain_weight",
  calculationMethod: "balanced",
  bodyFatPercentage: null,
  targetWeightKg: null,
  medicalConditions: [],
};

test("calculates a balanced target from two resting-energy equations", () => {
  const targets = calculateNutritionTargets(baseProfile);
  assert.equal(targets.bmr, 1645);
  assert.equal(targets.tdee, 2549);
  assert.equal(targets.calorieTarget, 2550);
  assert.equal(targets.proteinTargetG, 112);
  assert.equal(targets.fatTargetG, 71);
  assert.equal(targets.carbsTargetG, 366);
});

test("supports independent Mifflin, Harris-Benedict, and Katch-McArdle methods", () => {
  assert.equal(
    calculateNutritionTargets({
      ...baseProfile,
      calculationMethod: "mifflin_st_jeor",
    }).bmr,
    1618,
  );
  assert.equal(
    calculateNutritionTargets({
      ...baseProfile,
      calculationMethod: "revised_harris_benedict",
    }).bmr,
    1672,
  );
  assert.equal(
    calculateNutritionTargets({
      ...baseProfile,
      calculationMethod: "katch_mcardle",
      bodyFatPercentage: 20,
    }).bmr,
    1580,
  );
});

test("requires body-fat percentage for Katch-McArdle", () => {
  const parsed = ProfileInputSchema.safeParse({
    ...baseProfile,
    calculationMethod: "katch_mcardle",
  });
  assert.equal(parsed.success, false);
});

