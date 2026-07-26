"use client";

import {
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type FoodTemplate = {
  id: string;
  name: string;
  portion: string;
  emoji: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  fiberG: number;
  sodiumMg: number;
  usageCount: number;
  lastUsedAt: string;
};

type MealLog = {
  id: string;
  templateId: string | null;
  name: string;
  portion: string;
  emoji: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  fiberG: number;
  sodiumMg: number;
  loggedOn: string;
  loggedAt: string;
};

type MealAnalysis = {
  items: Array<{
    name: string;
    portion_estimate: string;
    confidence: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    sugar_g: number;
    fiber_g: number;
    sodium_mg: number;
  }>;
  total_summary: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    sugar_g: number;
    fiber_g: number;
    sodium_mg: number;
  };
  dietitian_tip: string;
  confidence_overall: number;
};

const MEAL_IMAGE_BUCKET = "meal-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const DAILY_CALORIE_TARGET = 2_100;
const DAILY_PROTEIN_TARGET = 135;
const DAILY_CARB_TARGET = 235;
const EMPTY_DRAFT: FoodTemplate = {
  id: "",
  name: "",
  portion: "",
  emoji: "🍽️",
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  sugarG: 0,
  fiberG: 0,
  sodiumMg: 0,
  usageCount: 0,
  lastUsedAt: "",
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return {
      key: localDateKey(date),
      label:
        index === 6
          ? "Today"
          : new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(date),
    };
  });
}

function mealPayload(template: FoodTemplate, templateId?: string | null) {
  return {
    ...templatePayload(template),
    templateId: templateId ?? null,
    loggedOn: localDateKey(),
  };
}

function templatePayload(template: FoodTemplate) {
  return {
    name: template.name,
    portion: template.portion,
    emoji: template.emoji,
    calories: template.calories,
    proteinG: template.proteinG,
    carbsG: template.carbsG,
    fatG: template.fatG,
    sugarG: template.sugarG,
    fiberG: template.fiberG,
    sodiumMg: template.sodiumMg,
  };
}

export function NutritionDashboard({ userName }: { userName: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<"today" | "library">("today");
  const [templates, setTemplates] = useState<FoodTemplate[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [mealLoadError, setMealLoadError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deletingMealId, setDeletingMealId] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [dietitianTip, setDietitianTip] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageName, setImageName] = useState("");
  const [toast, setToast] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);
  const [draft, setDraft] = useState<FoodTemplate>({ ...EMPTY_DRAFT });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    const days = lastSevenDays();
    void fetch("/api/food-templates")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load Personal Foods");
        return response.json() as Promise<{ templates: FoodTemplate[] }>;
      })
      .then((data) => setTemplates(data.templates))
      .catch(() => setTemplates([]));

    void fetch(`/api/meals?from=${days[0].key}&to=${days[6].key}`)
      .then(async (response) => {
          const result = (await response.json()) as {
            meals?: MealLog[];
            error?: string;
          };
          if (!response.ok || !result.meals) {
            throw new Error(result.error ?? "Unable to load meals");
          }
          return result.meals;
        })
      .then((meals) => {
        setMealLogs(meals);
        setMealLoadError("");
      })
      .catch((error) => {
        setMealLoadError(
          error instanceof Error ? error.message : "Unable to load today's meals",
        );
      });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(
    () => () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  const filteredTemplates = useMemo(
    () => templates.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [query, templates],
  );
  const weekDays = useMemo(() => lastSevenDays(), []);
  const todayKey = weekDays[6].key;
  const todayMeals = useMemo(
    () => mealLogs.filter((meal) => meal.loggedOn === todayKey),
    [mealLogs, todayKey],
  );
  const totals = useMemo(
    () =>
      todayMeals.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.calories,
          proteinG: sum.proteinG + meal.proteinG,
          carbsG: sum.carbsG + meal.carbsG,
          fatG: sum.fatG + meal.fatG,
          sodiumMg: sum.sodiumMg + meal.sodiumMg,
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0 },
      ),
    [todayMeals],
  );
  const weeklyCalories = useMemo(
    () =>
      weekDays.map((day) =>
        mealLogs
          .filter((meal) => meal.loggedOn === day.key)
          .reduce((sum, meal) => sum + meal.calories, 0),
      ),
    [mealLogs, weekDays],
  );
  const caloriePercentage = Math.min(
    100,
    Math.round((totals.calories / DAILY_CALORIE_TARGET) * 100),
  );
  const caloriesRemaining = Math.max(0, DAILY_CALORIE_TARGET - totals.calories);
  const weeklyAverage = Math.round(
    weeklyCalories.reduce((sum, calories) => sum + calories, 0) / 7,
  );

  function navigate(next: "today" | "library") {
    setView(next);
    setMenuOpen(false);
  }

  function openMealEditor() {
    setDraft({ ...EMPTY_DRAFT });
    setAnalysisError("");
    setConfidence(null);
    setDietitianTip("");
    setImageName("");
    setImagePreview("");
    setSaveAsTemplate(true);
    setEditorOpen(true);
  }

  function updateDraft(field: keyof FoodTemplate, value: string) {
    const numericFields: (keyof FoodTemplate)[] = [
      "calories", "proteinG", "carbsG", "fatG", "sugarG", "fiberG", "sodiumMg",
    ];
    setDraft((current) => ({
      ...current,
      [field]: numericFields.includes(field) ? Number(value) : value,
    }));
  }

  async function analyzeMealPhoto(file: File) {
    const extension = IMAGE_EXTENSIONS[file.type];
    if (!extension) {
      setAnalysisError("Choose a JPEG, PNG, or WebP meal photo.");
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      setAnalysisError("The meal photo must be smaller than 8 MB.");
      return;
    }

    setAnalyzing(true);
    setAnalysisError("");
    setConfidence(null);
    setDietitianTip("");
    setImageName(file.name);
    setImagePreview(URL.createObjectURL(file));

    let imagePath = "";
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please sign in again.");

      imagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(MEAL_IMAGE_BUCKET)
        .upload(imagePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) {
        throw new Error(
          uploadError.message.includes("Bucket not found")
            ? "The meal-images bucket has not been created in Supabase yet."
            : "The image could not be uploaded.",
        );
      }

      const response = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: imagePath }),
      });
      const result = (await response.json()) as {
        analysis?: MealAnalysis;
        error?: string;
      };
      if (!response.ok || !result.analysis) {
        await supabase.storage.from(MEAL_IMAGE_BUCKET).remove([imagePath]);
        throw new Error(result.error ?? "The meal could not be analyzed.");
      }

      const analysis = result.analysis;
      const total = analysis.total_summary;
      setDraft((current) => ({
        ...current,
        name: analysis.items.map((item) => item.name).slice(0, 3).join(" + "),
        portion: analysis.items
          .map((item) => item.portion_estimate)
          .slice(0, 3)
          .join(", "),
        calories: Math.round(total.calories),
        proteinG: total.protein_g,
        carbsG: total.carbs_g,
        fatG: total.fat_g,
        sugarG: total.sugar_g,
        fiberG: total.fiber_g,
        sodiumMg: total.sodium_mg,
      }));
      setConfidence(Math.round(analysis.confidence_overall));
      setDietitianTip(analysis.dietitian_tip);
      setToast("Meal analyzed—review the estimate before saving");
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "The meal could not be analyzed.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function selectMealPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void analyzeMealPhoto(file);
    event.target.value = "";
  }

  function dropMealPhoto(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void analyzeMealPhoto(file);
  }

  async function saveMeal() {
    setSaving(true);
    setAnalysisError("");
    try {
      let templateId: string | null = null;
      if (saveAsTemplate) {
        const response = await fetch("/api/food-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templatePayload(draft)),
        });
        const result = (await response.json()) as {
          template?: FoodTemplate;
          error?: string;
        };
        if (!response.ok || !result.template) {
          throw new Error(result.error ?? "The personal food could not be saved.");
        }
        templateId = result.template.id;
        setTemplates((current) => {
          const withoutMatch = current.filter(
            (item) => item.name.toLowerCase() !== result.template!.name.toLowerCase(),
          );
          return [result.template!, ...withoutMatch];
        });
      }

      const mealResponse = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mealPayload(draft, templateId)),
      });
      const mealResult = (await mealResponse.json()) as {
        meal?: MealLog;
        error?: string;
      };
      if (!mealResponse.ok || !mealResult.meal) {
        throw new Error(mealResult.error ?? "The meal could not be logged.");
      }
      setMealLogs((current) => [mealResult.meal!, ...current]);
      setEditorOpen(false);
      setDraft({ ...EMPTY_DRAFT });
      setToast(
        saveAsTemplate
          ? `${draft.name} logged and saved to Personal Foods`
          : `${draft.name} added to today`,
      );
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "The meal could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function quickLog(template: FoodTemplate) {
    try {
      const mealResponse = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mealPayload(template, template.id)),
      });
      const mealResult = (await mealResponse.json()) as {
        meal?: MealLog;
        error?: string;
      };
      if (!mealResponse.ok || !mealResult.meal) {
        throw new Error(mealResult.error ?? "The meal could not be logged.");
      }
      setMealLogs((current) => [mealResult.meal!, ...current]);

      const templateResponse = await fetch("/api/food-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: template.id, action: "log" }),
      });
      if (templateResponse.ok) {
        const result = (await templateResponse.json()) as {
          template: FoodTemplate;
        };
        setTemplates((current) =>
          current.map((item) =>
            item.id === result.template.id ? result.template : item,
          ),
        );
      }
      setToast(`${template.name} added to today`);
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "The meal could not be logged.",
      );
    }
  }

  async function deleteMeal(meal: MealLog) {
    if (!window.confirm(`Delete "${meal.name}" from today's meals?`)) return;

    setDeletingMealId(meal.id);
    try {
      const response = await fetch("/api/meals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meal.id }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "The meal could not be deleted.");
      }
      setMealLogs((current) => current.filter((item) => item.id !== meal.id));
      setToast(`${meal.name} deleted from today`);
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "The meal could not be deleted.",
      );
    } finally {
      setDeletingMealId("");
    }
  }

  async function deleteTemplate(template: FoodTemplate) {
    if (!window.confirm(`Delete "${template.name}" from Personal Foods?`)) return;

    setDeletingId(template.id);
    try {
      const response = await fetch("/api/food-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: template.id }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "The personal food could not be deleted.");
      }
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      setToast(`${template.name} deleted`);
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "The personal food could not be deleted.",
      );
    } finally {
      setDeletingId("");
    }
  }

  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">N</div>
          <span className="brand-name">nourish</span>
        </div>
        <div className="nav-label">Workspace</div>
        <nav className="nav">
          <button className={`nav-item ${view === "today" ? "active" : ""}`} onClick={() => navigate("today")}>
            <span className="nav-icon" aria-hidden="true">◫</span><span>Today</span>
          </button>
          <button className="nav-item" onClick={() => setToast("Meal history is ready for your next build")}>
            <span className="nav-icon" aria-hidden="true">◷</span><span>Meal history</span>
          </button>
          <button className={`nav-item ${view === "library" ? "active" : ""}`} onClick={() => navigate("library")}>
            <span className="nav-icon" aria-hidden="true">♡</span><span>Personal foods</span>
          </button>
          <button className="nav-item" onClick={() => setToast("Insights update after your next meal")}>
            <span className="nav-icon" aria-hidden="true">↗</span><span>Insights</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <nav className="nav" aria-label="Account navigation">
            <button className="nav-item"><span className="nav-icon" aria-hidden="true">⚙</span><span>Settings</span></button>
            <form action="/auth/signout" method="post">
              <button className="nav-item" type="submit"><span className="nav-icon" aria-hidden="true">↪</span><span>Sign out</span></button>
            </form>
          </nav>
          <div className="profile-card">
            <div className="avatar">{initials}</div>
            <div className="profile-copy">
              <div className="profile-name">{userName}</div>
              <div className="profile-goal">Fat loss · 2,100 kcal</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="top-actions">
            <button className="icon-button mobile-menu" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation">☰</button>
            <div className="top-date">
              {new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(new Date())}
            </div>
          </div>
          <div className="top-actions">
            <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label="Toggle color theme">{dark ? "☀" : "◐"}</button>
            <button className="icon-button" aria-label="Notifications">♢</button>
          </div>
        </header>

        <div className="content">
          {view === "today" ? (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">Daily overview</p>
                  <h1>Good afternoon, {userName.split(" ")[0]}.</h1>
                  <p className="heading-copy">You&apos;re on track. A protein-rich dinner will close the day well.</p>
                </div>
                <button className="primary-button" onClick={openMealEditor}>＋ Log a meal</button>
              </div>

              <section className="summary-grid" aria-label="Daily nutrition summary">
                <article className="card calorie-card">
                  <div>
                    <div className="card-kicker">Calories remaining</div>
                    <div className="calorie-value">{caloriesRemaining.toLocaleString()}</div>
                    <div className="calorie-unit">kcal left today</div>
                    <div className="mini-stats">
                      <div className="mini-stat"><strong>{totals.calories.toLocaleString()}</strong><span>Consumed</span></div>
                      <div className="mini-stat"><strong>{DAILY_CALORIE_TARGET.toLocaleString()}</strong><span>Daily goal</span></div>
                    </div>
                  </div>
                  <div
                    className="ring"
                    style={{ "--calorie-progress": `${caloriePercentage}%` } as CSSProperties}
                    aria-label={`${caloriePercentage} percent of calorie target consumed`}
                  >
                    <div className="ring-content"><strong>{caloriePercentage}%</strong><span>of your goal</span></div>
                  </div>
                </article>
                <MacroCard label="Protein" value={Math.round(totals.proteinG)} target={DAILY_PROTEIN_TARGET} unit="g" color="#3f8f65" />
                <MacroCard label="Carbohydrates" value={Math.round(totals.carbsG)} target={DAILY_CARB_TARGET} unit="g" color="#e19a4d" />
              </section>

              <section className="dashboard-grid">
                <article className="card section-card">
                  <div className="card-header">
                    <div><h2 className="card-title">Today&apos;s meals</h2><div className="card-subtitle">{todayMeals.length} {todayMeals.length === 1 ? "meal" : "meals"} · {totals.calories.toLocaleString()} kcal</div></div>
                    <button className="text-button" onClick={openMealEditor}>Add meal ＋</button>
                  </div>
                  <div className="meal-list">
                    {mealLoadError ? (
                      <div className="meal-empty error" role="alert">{mealLoadError}</div>
                    ) : todayMeals.length ? todayMeals.map((meal) => (
                      <div className="meal-row" key={meal.id}>
                        <div className="food-thumb" aria-hidden="true">{meal.emoji}</div>
                        <div><div className="meal-name">{meal.name}</div><div className="meal-meta">{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(meal.loggedAt))} · {meal.portion}</div></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div className="meal-calories">{meal.calories}<span>kcal</span></div>
                          <button
                            className="meal-delete"
                            onClick={() => void deleteMeal(meal)}
                            disabled={deletingMealId === meal.id}
                            aria-label={`Delete ${meal.name} from today`}
                          >
                            {deletingMealId === meal.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="meal-empty"><strong>No meals logged today</strong><span>Add a meal or use a Personal Food shortcut.</span></div>
                    )}
                  </div>
                </article>

                <article className="card section-card">
                  <div className="card-header">
                    <div><h2 className="card-title">Personal foods</h2><div className="card-subtitle">Meals that get smarter with you</div></div>
                    <button className="text-button" onClick={() => navigate("library")}>View all</button>
                  </div>
                  <div className="library-list">
                    {templates.slice(0, 3).map((item) => (
                      <div className="library-item" key={item.id}>
                        <div className="library-icon" aria-hidden="true">{item.emoji}</div>
                        <div style={{ minWidth: 0 }}><div className="library-name">{item.name}</div><div className="library-meta">{item.calories} kcal · used {item.usageCount}×</div></div>
                        <button className="quick-add" onClick={() => void quickLog(item)} aria-label={`Quick log ${item.name}`}>＋</button>
                      </div>
                    ))}
                  </div>
                  <div className="learn-callout">
                    <div className="learn-icon" aria-hidden="true">✦</div>
                    <div><div className="learn-title">Nourish learns what you eat</div><div className="learn-copy">Confirm or edit a meal once. Next time, log it instantly without another AI scan.</div></div>
                  </div>
                </article>
              </section>

              <section className="insights-row">
                <article className="card chart-card">
                  <div className="chart-head">
                    <div><h2 className="card-title">Weekly calories</h2><div className="card-subtitle">Your 7-day rhythm</div></div>
                    <div className="chart-total"><strong>{weeklyAverage.toLocaleString()}</strong> kcal avg</div>
                  </div>
                  <div className="bar-chart" aria-label="Weekly calories bar chart">
                    {weeklyCalories.map((calories, index) => (
                      <div className="bar-column" key={weekDays[index].key}><div className={`bar ${index === 6 ? "today" : ""}`} style={{ height: `${Math.max(4, Math.min(100, Math.round(calories / DAILY_CALORIE_TARGET * 100)))}%` }} title={`${calories} kcal`} /><div className="bar-label">{weekDays[index].label}</div></div>
                    ))}
                  </div>
                </article>
                <article className="card health-card">
                  <div className="health-icon" aria-hidden="true">♥</div>
                  <div className="health-title">Today&apos;s sodium check</div>
                  <p className="health-copy">{totals.sodiumMg > 2_300 ? "Today is above the general 2,300 mg sodium guide. A fresh, minimally processed next meal can help balance the day." : `${Math.round(totals.sodiumMg).toLocaleString()} mg logged today. Keep reviewing portions and packaged-food labels for the most accurate total.`}</p>
                </article>
              </section>
            </>
          ) : (
            <section className="library-view">
              <div className="page-heading">
                <div><p className="eyebrow">Your shortcuts</p><h1>Personal foods</h1><p className="heading-copy">Every confirmed meal becomes faster to log next time.</p></div>
                <button className="primary-button" onClick={openMealEditor}>＋ Create food</button>
              </div>
              <div className="library-toolbar">
                <input className="search-box" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your meals…" aria-label="Search personal foods" />
                <span className="usage-badge">{templates.length} saved</span>
              </div>
              <div className="template-grid">
                {filteredTemplates.length ? filteredTemplates.map((item) => (
                  <article className="card template-card" key={item.id}>
                    <div className="template-top"><div className="template-emoji" aria-hidden="true">{item.emoji}</div><span className="usage-badge">Used {item.usageCount}×</span></div>
                    <div className="template-name">{item.name}</div><div className="template-portion">{item.portion}</div>
                    <div className="template-macros">
                      <div><strong>{item.calories}</strong>kcal</div><div><strong>{item.proteinG}g</strong>protein</div><div><strong>{item.carbsG}g</strong>carbs</div><div><strong>{item.fatG}g</strong>fat</div>
                    </div>
                    <div className="template-actions">
                      <button className="primary-button" onClick={() => void quickLog(item)}>＋ Add to today</button>
                      <button
                        className="delete-button"
                        onClick={() => void deleteTemplate(item)}
                        disabled={deletingId === item.id}
                        aria-label={`Delete ${item.name}`}
                      >
                        {deletingId === item.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </article>
                )) : <div className="card empty-state"><strong>No meals found</strong><span>Try another search or create a new personal food.</span></div>}
              </div>
            </section>
          )}
        </div>
      </main>

      {editorOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditorOpen(false); }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="meal-dialog-title">
            <div className="dialog-head">
              <div><h2 className="dialog-title" id="meal-dialog-title">Confirm your meal</h2><div className="dialog-subtitle">Review the AI estimate before adding it to today.</div></div>
              <button className="close-button" onClick={() => setEditorOpen(false)} aria-label="Close dialog">×</button>
            </div>
            <div className={`dialog-body ${saving ? "loading" : ""}`}>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={selectMealPhoto}
              />
              <button
                className={`meal-upload ${analyzing ? "analyzing" : ""}`}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={dropMealPhoto}
                disabled={analyzing}
              >
                {imagePreview ? (
                  <span
                    className="meal-preview"
                    style={{ backgroundImage: `url("${imagePreview}")` }}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="upload-icon" aria-hidden="true">⌁</span>
                )}
                <span>
                  <strong>{analyzing ? "Analyzing your meal…" : imageName || "Upload a meal photo"}</strong>
                  <span>{analyzing ? "Gemini is estimating portions and nutrients" : "Click or drag a JPEG, PNG, or WebP · max 8 MB"}</span>
                </span>
                {!analyzing && <span className="upload-action">{imagePreview ? "Replace" : "Browse"}</span>}
              </button>
              {analysisError && <div className="analysis-error" role="alert">{analysisError}</div>}
              <div className={`confidence ${confidence !== null && confidence < 70 ? "low" : ""}`}>
                <span aria-hidden="true">{confidence === null ? "✦" : confidence >= 70 ? "✓" : "!"}</span>
                <strong>{confidence === null ? "Ready for AI analysis" : `${confidence}% confidence`}</strong>
                <span>· {confidence === null ? "Upload a photo or enter values manually" : confidence < 70 ? "The estimate is uncertain—please review carefully" : "Review portion size for best accuracy"}</span>
              </div>
              {dietitianTip && <div className="dietitian-tip"><strong>Dietitian tip</strong>{dietitianTip}</div>}
              <div className="form-grid">
                <div className="field"><label htmlFor="meal-name">Meal name</label><input id="meal-name" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} /></div>
                <div className="field"><label htmlFor="meal-portion">Portion</label><input id="meal-portion" value={draft.portion} onChange={(event) => updateDraft("portion", event.target.value)} /></div>
              </div>
              <div className="nutrition-grid">
                {([
                  ["calories", "Calories", "kcal"], ["proteinG", "Protein", "g"], ["carbsG", "Carbs", "g"],
                  ["fatG", "Fat", "g"], ["sugarG", "Sugar", "g"], ["fiberG", "Fiber", "g"],
                  ["sodiumMg", "Sodium", "mg"],
                ] as const).map(([field, label, unit]) => (
                  <div className="nutrition-field" key={field}><label htmlFor={field}>{label} ({unit})</label><input id={field} type="number" min="0" value={draft[field]} onChange={(event) => updateDraft(field, event.target.value)} /></div>
                ))}
              </div>
              <label className="save-template-check">
                <input type="checkbox" checked={saveAsTemplate} onChange={(event) => setSaveAsTemplate(event.target.checked)} />
                <span><strong>Save to Personal Foods</strong><span>Use these confirmed values next time instead of calling AI again.</span></span>
              </label>
              <div className="dialog-actions"><button className="secondary-button" onClick={() => setEditorOpen(false)}>Cancel</button><button className="primary-button" onClick={saveMeal} disabled={saving}>{saving ? "Saving…" : "Save meal & template"}</button></div>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function MacroCard({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const percentage = Math.min(100, Math.round((value / target) * 100));
  return (
    <article className="card macro-card">
      <div>
        <div className="macro-head"><div className="card-kicker">{label}</div><div className="macro-dot" style={{ background: color }} /></div>
        <div className="macro-number">{value}<span style={{ fontSize: 15, color: "var(--muted-foreground)", marginLeft: 3 }}>{unit}</span></div>
        <div className="macro-target">of {target}{unit} daily target</div>
      </div>
      <div><div className="progress-track"><div className="progress-fill" style={{ width: `${percentage}%`, background: color }} /></div><div className="macro-footer"><span>Progress</span><strong>{percentage}%</strong></div></div>
    </article>
  );
}
