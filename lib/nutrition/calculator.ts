import { z } from "zod";

export const SexForEquationSchema = z.enum(["male", "female"]);
export const ActivityLevelSchema = z.enum([
  "sedentary",
  "light",
  "moderate",
  "very_active",
  "extra_active",
]);
export const NutritionGoalSchema = z.enum([
  "lose_weight",
  "maintain_weight",
  "gain_weight",
  "muscle_gain",
  "body_recomposition",
]);
export const CalculationMethodSchema = z.enum([
  "balanced",
  "mifflin_st_jeor",
  "revised_harris_benedict",
  "katch_mcardle",
]);
export const MedicalConditionSchema = z.enum([
  "diabetes",
  "hypertension",
  "high_cholesterol",
  "kidney_disease",
  "thyroid",
]);

export const ProfileInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    age: z.number().int().min(18).max(100),
    sexForEquation: SexForEquationSchema,
    heightCm: z.number().min(120).max(230),
    weightKg: z.number().min(35).max(350),
    activityLevel: ActivityLevelSchema,
    goal: NutritionGoalSchema,
    calculationMethod: CalculationMethodSchema,
    bodyFatPercentage: z.number().min(3).max(70).nullable().optional(),
    targetWeightKg: z.number().min(35).max(350).nullable().optional(),
    medicalConditions: z.array(MedicalConditionSchema).max(5).default([]),
  })
  .superRefine((profile, context) => {
    if (
      profile.calculationMethod === "katch_mcardle" &&
      !profile.bodyFatPercentage
    ) {
      context.addIssue({
        code: "custom",
        path: ["bodyFatPercentage"],
        message: "Body-fat percentage is required for Katch–McArdle.",
      });
    }
    if (
      profile.goal === "lose_weight" &&
      profile.targetWeightKg &&
      profile.targetWeightKg >= profile.weightKg
    ) {
      context.addIssue({
        code: "custom",
        path: ["targetWeightKg"],
        message: "For fat loss, target weight should be below current weight.",
      });
    }
    if (
      ["gain_weight", "muscle_gain"].includes(profile.goal) &&
      profile.targetWeightKg &&
      profile.targetWeightKg <= profile.weightKg
    ) {
      context.addIssue({
        code: "custom",
        path: ["targetWeightKg"],
        message: "For weight or muscle gain, target weight should be higher.",
      });
    }
  });

export type ProfileInput = z.infer<typeof ProfileInputSchema>;
export type NutritionGoal = z.infer<typeof NutritionGoalSchema>;
export type ActivityLevel = z.infer<typeof ActivityLevelSchema>;
export type CalculationMethod = z.infer<typeof CalculationMethodSchema>;

export const CALCULATION_METHOD_OPTIONS: Array<{
  value: CalculationMethod;
  label: string;
  description: string;
}> = [
  {
    value: "balanced",
    label: "Balanced estimate",
    description: "Average of Mifflin–St Jeor and Revised Harris–Benedict",
  },
  {
    value: "mifflin_st_jeor",
    label: "Mifflin–St Jeor",
    description: "Uses age, height, weight, and physiological sex",
  },
  {
    value: "revised_harris_benedict",
    label: "Revised Harris–Benedict",
    description: "An alternative estimate using age, height, and weight",
  },
  {
    value: "katch_mcardle",
    label: "Katch–McArdle",
    description: "Uses lean body mass and requires body-fat percentage",
  },
];

export const ACTIVITY_OPTIONS: Array<{
  value: ActivityLevel;
  label: string;
  description: string;
}> = [
  {
    value: "sedentary",
    label: "Mostly seated",
    description: "Desk-based day with little structured exercise",
  },
  {
    value: "light",
    label: "Lightly active",
    description: "Exercise or active movement 1–3 days per week",
  },
  {
    value: "moderate",
    label: "Moderately active",
    description: "Training or sports 3–5 days per week",
  },
  {
    value: "very_active",
    label: "Very active",
    description: "Hard training 6–7 days per week",
  },
  {
    value: "extra_active",
    label: "Athlete / physical job",
    description: "Intense training plus a highly active day",
  },
];

export const GOAL_OPTIONS: Array<{
  value: NutritionGoal;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: "lose_weight",
    label: "Lose body fat",
    description: "A moderate calorie deficit while supporting lean mass",
    icon: "↘",
  },
  {
    value: "maintain_weight",
    label: "Maintain weight",
    description: "Support your current weight and daily performance",
    icon: "→",
  },
  {
    value: "gain_weight",
    label: "Gain weight",
    description: "A controlled surplus for gradual healthy weight gain",
    icon: "↗",
  },
  {
    value: "muscle_gain",
    label: "Build muscle",
    description: "A small surplus with a higher protein target",
    icon: "＋",
  },
  {
    value: "body_recomposition",
    label: "Body recomposition",
    description: "Build muscle while gradually reducing body fat",
    icon: "◈",
  },
];

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

const goalAdjustments: Record<NutritionGoal, number> = {
  lose_weight: 0.8,
  maintain_weight: 1,
  gain_weight: 1.12,
  muscle_gain: 1.08,
  body_recomposition: 0.95,
};

const proteinPerKg: Record<NutritionGoal, number> = {
  lose_weight: 1.8,
  maintain_weight: 1.6,
  gain_weight: 1.6,
  muscle_gain: 1.8,
  body_recomposition: 1.8,
};

function roundToTen(value: number) {
  return Math.round(value / 10) * 10;
}

export function calculateNutritionTargets(profile: ProfileInput) {
  const sexAdjustment = profile.sexForEquation === "male" ? 5 : -161;
  const mifflin =
    10 * profile.weightKg +
    6.25 * profile.heightCm -
    5 * profile.age +
    sexAdjustment;
  const revisedHarrisBenedict =
    profile.sexForEquation === "male"
      ? 88.362 +
        13.397 * profile.weightKg +
        4.799 * profile.heightCm -
        5.677 * profile.age
      : 447.593 +
        9.247 * profile.weightKg +
        3.098 * profile.heightCm -
        4.33 * profile.age;
  const leanBodyMass =
    profile.weightKg * (1 - (profile.bodyFatPercentage ?? 0) / 100);
  const katchMcArdle = 370 + 21.6 * leanBodyMass;
  const bmrByMethod: Record<CalculationMethod, number> = {
    balanced: (mifflin + revisedHarrisBenedict) / 2,
    mifflin_st_jeor: mifflin,
    revised_harris_benedict: revisedHarrisBenedict,
    katch_mcardle: katchMcArdle,
  };
  const bmr = bmrByMethod[profile.calculationMethod];
  const tdee = bmr * activityMultipliers[profile.activityLevel];
  const adjustedCalories = tdee * goalAdjustments[profile.goal];
  const calorieTarget = roundToTen(Math.max(bmr, adjustedCalories));
  const proteinTargetG = Math.round(
    profile.weightKg * proteinPerKg[profile.goal],
  );
  const fatTargetG = Math.round((calorieTarget * 0.25) / 9);
  const carbsTargetG = Math.max(
    0,
    Math.round(
      (calorieTarget - proteinTargetG * 4 - fatTargetG * 9) / 4,
    ),
  );
  const bmi = profile.weightKg / (profile.heightCm / 100) ** 2;

  return {
    bmi: Number(bmi.toFixed(1)),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorieTarget,
    proteinTargetG,
    carbsTargetG,
    fatTargetG,
  };
}

export function goalLabel(goal: NutritionGoal) {
  return GOAL_OPTIONS.find((option) => option.value === goal)?.label ?? goal;
}
