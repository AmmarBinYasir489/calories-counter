import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in | Nourish",
  description: "Sign in to your private Nourish nutrition workspace.",
};

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand auth-brand">
          <div className="brand-mark" aria-hidden="true">N</div>
          <span className="brand-name">nourish</span>
        </div>
        <div>
          <p className="eyebrow">Your nutrition, remembered</p>
          <h1>Log it once.<br />Reuse it forever.</h1>
          <p className="auth-story-copy">
            Nourish learns your real meals—from family recipes to office lunches—so every day gets easier to track.
          </p>
        </div>
        <div className="auth-proof">
          <div><strong>Private</strong><span>Your meals stay yours</span></div>
          <div><strong>Faster</strong><span>Fewer repeated AI scans</span></div>
          <div><strong>Smarter</strong><span>Personal nutrition patterns</span></div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">Welcome</p>
          <h2>Sign in to Nourish</h2>
          <p className="auth-intro">Continue to your personal nutrition dashboard.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
