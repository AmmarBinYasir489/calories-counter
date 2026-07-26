"use client";

import {
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

const meals = [
  { name: "Breakfast Oats", meta: "8:15 AM · 1 bowl", emoji: "🥣", calories: 420 },
  { name: "Chicken Biryani", meta: "1:20 PM · 1 medium plate", emoji: "🍛", calories: 680 },
  { name: "Mango Lassi", meta: "4:05 PM · 1 glass", emoji: "🥭", calories: 210 },
];

const bars = [72, 88, 61, 96, 79, 85, 68];
const days = ["M", "T", "W", "T", "F", "S", "Today"];

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
  const [editorOpen, setEditorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [dietitianTip, setDietitianTip] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageName, setImageName] = useState("");
  const [toast, setToast] = useState("");
  const [draft, setDraft] = useState<FoodTemplate>({
    id: "", name: "Chicken Biryani", portion: "1 medium plate", emoji: "🍛",
    calories: 680, proteinG: 32, carbsG: 84, fatG: 23, sugarG: 5,
    fiberG: 4, sodiumMg: 890, usageCount: 0, lastUsedAt: "",
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    fetch("/api/food-templates")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { templates: FoodTemplate[] }) => {
        setTemplates(data.templates);
      })
      .catch(() => undefined);
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

  function navigate(next: "today" | "library") {
    setView(next);
    setMenuOpen(false);
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
    try {
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
        throw new Error(result.error ?? "The meal could not be saved.");
      }
      const data = { template: result.template };
      setTemplates((current) => {
        const withoutMatch = current.filter((item) => item.name.toLowerCase() !== data.template.name.toLowerCase());
        return [data.template, ...withoutMatch];
      });
      setEditorOpen(false);
      setToast(`${draft.name} logged and saved to Personal Foods`);
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : "The meal could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function quickLog(template: FoodTemplate) {
    setTemplates((current) =>
      current.map((item) => item.id === template.id
        ? { ...item, usageCount: item.usageCount + 1, lastUsedAt: "Just now" }
        : item),
    );
    setToast(`${template.name} added to today`);
    fetch("/api/food-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: template.id, action: "log" }),
    }).catch(() => undefined);
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
            <div className="top-date">Sunday, July 26</div>
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
                <button className="primary-button" onClick={() => setEditorOpen(true)}>＋ Log a meal</button>
              </div>

              <section className="summary-grid" aria-label="Daily nutrition summary">
                <article className="card calorie-card">
                  <div>
                    <div className="card-kicker">Calories remaining</div>
                    <div className="calorie-value">790</div>
                    <div className="calorie-unit">kcal left today</div>
                    <div className="mini-stats">
                      <div className="mini-stat"><strong>1,310</strong><span>Consumed</span></div>
                      <div className="mini-stat"><strong>2,100</strong><span>Daily goal</span></div>
                    </div>
                  </div>
                  <div className="ring" aria-label="62 percent of calorie target consumed">
                    <div className="ring-content"><strong>62%</strong><span>of your goal</span></div>
                  </div>
                </article>
                <MacroCard label="Protein" value={76} target={135} unit="g" color="#3f8f65" />
                <MacroCard label="Carbohydrates" value={161} target={235} unit="g" color="#e19a4d" />
              </section>

              <section className="dashboard-grid">
                <article className="card section-card">
                  <div className="card-header">
                    <div><h2 className="card-title">Today&apos;s meals</h2><div className="card-subtitle">3 meals · 1,310 kcal</div></div>
                    <button className="text-button" onClick={() => setEditorOpen(true)}>Add meal ＋</button>
                  </div>
                  <div className="meal-list">
                    {meals.map((meal) => (
                      <div className="meal-row" key={meal.name}>
                        <div className="food-thumb" aria-hidden="true">{meal.emoji}</div>
                        <div><div className="meal-name">{meal.name}</div><div className="meal-meta">{meal.meta}</div></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div className="meal-calories">{meal.calories}<span>kcal</span></div>
                          <button className="more-button" onClick={() => {
                            if (meal.name.includes("Biryani")) setDraft((current) => ({ ...current, name: meal.name, calories: meal.calories }));
                            setEditorOpen(true);
                          }} aria-label={`Edit ${meal.name}`}>•••</button>
                        </div>
                      </div>
                    ))}
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
                        <button className="quick-add" onClick={() => quickLog(item)} aria-label={`Quick log ${item.name}`}>＋</button>
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
                    <div className="chart-total"><strong>1,864</strong> kcal avg</div>
                  </div>
                  <div className="bar-chart" aria-label="Weekly calories bar chart">
                    {bars.map((height, index) => (
                      <div className="bar-column" key={`${days[index]}-${index}`}><div className={`bar ${index === 6 ? "today" : ""}`} style={{ height: `${height}%` }} /><div className="bar-label">{days[index]}</div></div>
                    ))}
                  </div>
                </article>
                <article className="card health-card">
                  <div className="health-icon" aria-hidden="true">♥</div>
                  <div className="health-title">A small sodium note</div>
                  <p className="health-copy">Lunch was a little sodium-heavy. Choose a fresh, minimally processed dinner and keep water nearby—no need to overcorrect.</p>
                </article>
              </section>
            </>
          ) : (
            <section className="library-view">
              <div className="page-heading">
                <div><p className="eyebrow">Your shortcuts</p><h1>Personal foods</h1><p className="heading-copy">Every confirmed meal becomes faster to log next time.</p></div>
                <button className="primary-button" onClick={() => setEditorOpen(true)}>＋ Create food</button>
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
                      <button className="primary-button" onClick={() => quickLog(item)}>＋ Add to today</button>
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
                <input type="checkbox" defaultChecked />
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
  const percentage = Math.round((value / target) * 100);
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
