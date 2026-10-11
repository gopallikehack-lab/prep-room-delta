"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export default function AuthBox() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const credentials = { email, password };
    const { error: authError } = isSignUp
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials);
    if (authError) setError(authError.message);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">
        {isSignUp ? "Create your account" : "Sign in"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Your practice sessions are saved to your account so you can track
        progress.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password (at least 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent py-2.5 text-sm font-medium text-white hover:bg-accentDark disabled:opacity-50"
        >
          {loading ? "Please wait..." : isSignUp ? "Sign up" : "Sign in"}
        </button>
      </form>

      <button
        onClick={() => setIsSignUp(!isSignUp)}
        className="mt-4 text-sm text-muted hover:text-ink"
      >
        {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}
