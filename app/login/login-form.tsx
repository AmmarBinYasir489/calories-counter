"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const supabase = createClient();
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account.");
      setLoading(false);
      return;
    }
    window.location.assign("/");
  }

  async function signInWithGoogle() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <>
      <button className="oauth-button" type="button" onClick={signInWithGoogle} disabled={loading}>
        <span aria-hidden="true">G</span> Continue with Google
      </button>
      <div className="auth-divider"><span>or continue with email</span></div>
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-success" role="status">{message}</p>}
        <button className="primary-button auth-submit" disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button className="auth-mode" type="button" onClick={() => setMode((current) => current === "login" ? "signup" : "login")}>
        {mode === "login" ? "New to Nourish? Create an account" : "Already have an account? Sign in"}
      </button>
    </>
  );
}
