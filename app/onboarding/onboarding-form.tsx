"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ACTIVITY_OPTIONS,
  CALCULATION_METHOD_OPTIONS,
  calculateNutritionTargets,
  GOAL_OPTIONS,
  type ProfileInput,
} from "@/lib/nutrition/calculator";

const conditions = [
  { value: "diabetes", label: "Diabetes" },
  { value: "hypertension", label: "Hypertension" },
  { value: "high_cholesterol", label: "High cholesterol" },
  { value: "kidney_disease", label: "Kidney disease" },
  { value: "thyroid", label: "Thyroid condition" },
] as const;

export function OnboardingForm({
  initialProfile,
  editing,
}: {
  initialProfile: ProfileInput;
  editing: boolean;
}) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<ProfileInput>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const targets = useMemo(
    () => calculateNutritionTargets(profile),
    [profile],
  );

  function update<K extends keyof ProfileInput>(
    key: K,
    value: ProfileInput[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function toggleCondition(value: ProfileInput["medicalConditions"][number]) {
    update(
      "medicalConditions",
      profile.medicalConditions.includes(value)
        ? profile.medicalConditions.filter((item) => item !== value)
        : [...profile.medicalConditions, value],
    );
  }

  function nextStep() {
    setError("");
    if (
      step === 1 &&
      (!profile.name.trim() ||
        profile.age < 18 ||
        profile.heightCm < 120 ||
        profile.weightKg < 35)
    ) {
      setError("Please complete all body details with valid values.");
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) {
      nextStep();
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Your nutrition plan could not be saved.");
      }
      window.location.assign("/");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your nutrition plan could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="onboarding-shell" data-theme="dark">
      <div className="onboarding-glow" aria-hidden="true" />
      <section className="onboarding-card">
        <div className="onboarding-form-panel">
          <header className="onboarding-header">
            <Link className="onboarding-brand" href="/" aria-label="Nourish home">
              <span>N</span>
              nourish
            </Link>
            <div className="step-copy">Step {step} of 3</div>
            <div className="step-track" aria-label={`Step ${step} of 3`}>
              {[1, 2, 3].map((item) => (
                <span key={item} className={item <= step ? "active" : ""} />
              ))}
            </div>
          </header>

          <form onSubmit={submit}>
            {step === 1 && (
              <div className="onboarding-step">
                <div>
                  <p className="eyebrow">About you</p>
                  <h1>Let&apos;s calculate your baseline.</h1>
                  <p className="onboarding-intro">
                    These details help estimate your resting energy needs and
                    daily calorie target.
                  </p>
                </div>
                <div className="onboarding-fields two-column">
                  <label className="onboarding-field wide">
                    <span>Name</span>
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      value={profile.name}
                      onChange={(event) => update("name", event.target.value)}
                    />
                  </label>
                  <label className="onboarding-field">
                    <span>Age</span>
                    <div className="unit-input">
                      <input
                        required
                        type="number"
                        min={18}
                        max={100}
                        value={profile.age}
                        onChange={(event) =>
                          update("age", Number(event.target.value))
                        }
                      />
                      <span>years</span>
                    </div>
                  </label>
                  <fieldset className="onboarding-field">
                    <legend>Sex used for the equation</legend>
                    <div className="segmented">
                      {(["male", "female"] as const).map((sex) => (
                        <button
                          key={sex}
                          type="button"
                          aria-pressed={profile.sexForEquation === sex}
                          className={
                            profile.sexForEquation === sex ? "selected" : ""
                          }
                          onClick={() => update("sexForEquation", sex)}
                        >
                          {sex === "male" ? "Male" : "Female"}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="onboarding-field">
                    <span>Height</span>
                    <div className="unit-input">
                      <input
                        required
                        type="number"
                        min={120}
                        max={230}
                        step="0.1"
                        value={profile.heightCm}
                        onChange={(event) =>
                          update("heightCm", Number(event.target.value))
                        }
                      />
                      <span>cm</span>
                    </div>
                  </label>
                  <label className="onboarding-field">
                    <span>Current weight</span>
                    <div className="unit-input">
                      <input
                        required
                        type="number"
                        min={35}
                        max={350}
                        step="0.1"
                        value={profile.weightKg}
                        onChange={(event) =>
                          update("weightKg", Number(event.target.value))
                        }
                      />
                      <span>kg</span>
                    </div>
                  </label>
                </div>
                <fieldset className="method-fieldset">
                  <legend>Calculation method</legend>
                  <div className="method-grid">
                    {CALCULATION_METHOD_OPTIONS.map((method) => (
                      <button
                        key={method.value}
                        type="button"
                        aria-pressed={
                          profile.calculationMethod === method.value
                        }
                        className={
                          profile.calculationMethod === method.value
                            ? "selected"
                            : ""
                        }
                        onClick={() => {
                          update("calculationMethod", method.value);
                          if (
                            method.value === "katch_mcardle" &&
                            !profile.bodyFatPercentage
                          ) {
                            update("bodyFatPercentage", 20);
                          }
                        }}
                      >
                        <strong>{method.label}</strong>
                        <small>{method.description}</small>
                      </button>
                    ))}
                  </div>
                </fieldset>
                {profile.calculationMethod === "katch_mcardle" && (
                  <label className="onboarding-field body-fat-field">
                    <span>Body-fat percentage</span>
                    <div className="unit-input">
                      <input
                        required
                        type="number"
                        min={3}
                        max={70}
                        step="0.1"
                        value={profile.bodyFatPercentage ?? ""}
                        onChange={(event) =>
                          update(
                            "bodyFatPercentage",
                            event.target.value
                              ? Number(event.target.value)
                              : null,
                          )
                        }
                      />
                      <span>%</span>
                    </div>
                  </label>
                )}
                <p className="equation-note">
                  Predictive equations can differ by person. Balanced estimate
                  compares two general adult formulas; Katch–McArdle is
                  available when body composition is known.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="onboarding-step">
                <div>
                  <p className="eyebrow">Your direction</p>
                  <h1>What would you like to achieve?</h1>
                  <p className="onboarding-intro">
                    Choose the goal that best matches your current priority.
                    You can change it later.
                  </p>
                </div>
                <div className="goal-grid">
                  {GOAL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={profile.goal === option.value}
                      className={`goal-option ${
                        profile.goal === option.value ? "selected" : ""
                      }`}
                      onClick={() => update("goal", option.value)}
                    >
                      <span className="goal-icon" aria-hidden="true">
                        {option.icon}
                      </span>
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                      <span className="goal-check" aria-hidden="true">✓</span>
                    </button>
                  ))}
                </div>
                <label className="onboarding-field target-weight">
                  <span>Target weight <small>Optional</small></span>
                  <div className="unit-input">
                    <input
                      type="number"
                      min={35}
                      max={350}
                      step="0.1"
                      value={profile.targetWeightKg ?? ""}
                      placeholder="e.g. 65"
                      onChange={(event) =>
                        update(
                          "targetWeightKg",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                    />
                    <span>kg</span>
                  </div>
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="onboarding-step">
                <div>
                  <p className="eyebrow">Your lifestyle</p>
                  <h1>How active is a typical week?</h1>
                  <p className="onboarding-intro">
                    Pick the closest match. Avoid counting an unusually active
                    or quiet week.
                  </p>
                </div>
                <div className="activity-list">
                  {ACTIVITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={profile.activityLevel === option.value}
                      className={`activity-option ${
                        profile.activityLevel === option.value ? "selected" : ""
                      }`}
                      onClick={() => update("activityLevel", option.value)}
                    >
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                      <span className="radio-mark" aria-hidden="true" />
                    </button>
                  ))}
                </div>

                <fieldset className="condition-fieldset">
                  <legend>Health conditions <small>Optional</small></legend>
                  <p>Select any that apply so future guidance can be safer.</p>
                  <div className="condition-grid">
                    {conditions.map((condition) => (
                      <label key={condition.value}>
                        <input
                          type="checkbox"
                          checked={profile.medicalConditions.includes(
                            condition.value,
                          )}
                          onChange={() => toggleCondition(condition.value)}
                        />
                        <span>{condition.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {profile.medicalConditions.length > 0 && (
                  <div className="medical-note">
                    These are general estimates and are not adjusted as medical
                    treatment. Discuss nutrition targets with your clinician,
                    especially for kidney disease or diabetes.
                  </div>
                )}
              </div>
            )}

            {error && <p className="onboarding-error" role="alert">{error}</p>}
            <div className="onboarding-actions">
              {step > 1 ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                >
                  Back
                </button>
              ) : editing ? (
                <Link className="secondary-button" href="/">Cancel</Link>
              ) : (
                <span />
              )}
              <button className="primary-button" disabled={saving}>
                {saving
                  ? "Saving your plan…"
                  : step === 3
                    ? editing
                      ? "Update my plan"
                      : "Create my plan"
                    : "Continue"}
              </button>
            </div>
          </form>
        </div>

        <aside className="plan-preview" aria-label="Estimated nutrition plan">
          <div>
            <p className="eyebrow">Live estimate</p>
            <h2>Your daily plan</h2>
            <p>
              This preview updates as you answer. Your final plan is calculated
              again securely when you save.
            </p>
          </div>
          <div className="calorie-preview">
            <span>Daily calories</span>
            <strong>{targets.calorieTarget.toLocaleString()}</strong>
            <small>kcal per day</small>
          </div>
          <div className="preview-macros">
            <div><span>Protein</span><strong>{targets.proteinTargetG}g</strong></div>
            <div><span>Carbs</span><strong>{targets.carbsTargetG}g</strong></div>
            <div><span>Fat</span><strong>{targets.fatTargetG}g</strong></div>
          </div>
          <div className="preview-details">
            <div><span>BMI</span><strong>{targets.bmi}</strong></div>
            <div><span>Resting energy</span><strong>{targets.bmr.toLocaleString()} kcal</strong></div>
            <div><span>Estimated TDEE</span><strong>{targets.tdee.toLocaleString()} kcal</strong></div>
          </div>
          <p className="preview-disclaimer">
            Estimates are a practical starting point, not a diagnosis. Review
            progress over several weeks and adjust with qualified guidance.
          </p>
        </aside>
      </section>
    </main>
  );
}
