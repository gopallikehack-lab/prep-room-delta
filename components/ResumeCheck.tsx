"use client";

import { useState } from "react";

type Section = { name: string; score: number; finding: string; fix: string };
type Rewrite = { original: string; improved: string; why: string };
type ResumeResult = {
  overall: number;
  summary: string;
  sections: Section[];
  missingKeywords: string[];
  rewrites: Rewrite[];
  topFixes: string[];
};

const inputClass =
  "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const headingClass = "text-sm font-semibold uppercase tracking-wide text-muted";

export default function ResumeCheck() {
  const [role, setRole] = useState("");
  const [resume, setResume] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResumeResult | null>(null);

  async function check() {
    if (!role.trim()) {
      setError("Please enter the role you are applying for.");
      return;
    }
    if (resume.trim().length < 200) {
      setError("Please paste your full resume. It looks too short.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/resume-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, resume }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setResult(data as ResumeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="flex items-end justify-between border-b border-line pb-6">
          <div>
            <p className="text-sm text-muted">Resume check for {role}</p>
            <h2 className="text-2xl font-semibold">Overall score</h2>
          </div>
          <p className="text-5xl font-semibold text-accent">
            {result.overall}
            <span className="text-lg text-muted">/100</span>
          </p>
        </div>

        <p className="mt-6 text-sm leading-relaxed">{result.summary}</p>

        {result.topFixes.length > 0 && (
          <div className="mt-8 border-l-2 border-accent pl-4">
            <p className="text-sm font-semibold text-accent">Fix these first</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
              {result.topFixes.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ol>
          </div>
        )}

        <h3 className={"mt-10 " + headingClass}>Section scores</h3>
        <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
          {result.sections.map((s) => (
            <div key={s.name} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{s.name}</p>
                <p className="text-sm font-semibold">{s.score}/10</p>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${s.score * 10}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-muted">
                <span className="font-medium text-ink">What I saw: </span>
                {s.finding}
              </p>
              <p className="mt-1 text-sm text-muted">
                <span className="font-medium text-ink">Fix: </span>
                {s.fix}
              </p>
            </div>
          ))}
        </div>

        {result.missingKeywords.length > 0 && (
          <>
            <h3 className={"mt-10 " + headingClass}>Keywords not shown in your resume</h3>
            <p className="mt-2 text-xs text-muted">
              Add these only if they are true for you.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.missingKeywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-line bg-white px-3 py-1 text-xs"
                >
                  {k}
                </span>
              ))}
            </div>
          </>
        )}

        {result.rewrites.length > 0 && (
          <>
            <h3 className={"mt-10 " + headingClass}>Better wording</h3>
            <p className="mt-2 text-xs text-muted">
              Replace anything in square brackets with your real numbers.
            </p>
            <div className="mt-3 space-y-4">
              {result.rewrites.map((r, i) => (
                <div key={i} className="rounded-lg border border-line bg-white p-4 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Before</p>
                  <p className="mt-1 leading-relaxed text-muted">{r.original}</p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-accent">After</p>
                  <p className="mt-1 leading-relaxed">{r.improved}</p>
                  <p className="mt-3 text-xs text-muted">{r.why}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => setResult(null)}
          className="mt-10 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Check another version
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-semibold">Resume check</h2>
      <p className="mt-1 text-sm text-muted">
        Paste your resume as plain text and get a score, gaps and better wording.
      </p>

      <div className="mt-8 space-y-6">
        <div>
          <span className="block text-sm font-medium">Role you are applying for</span>
          <input
            className={inputClass + " mt-2"}
            placeholder="For example: Junior Data Analyst"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>

        <div>
          <span className="block text-sm font-medium">Your resume text</span>
          <textarea
            rows={14}
            className={inputClass + " mt-2"}
            placeholder="Open your resume, press Ctrl + A, Ctrl + C, then paste it here."
            value={resume}
            onChange={(e) => setResume(e.target.value)}
          />
          <p className="mt-2 text-xs text-muted">
            Tip: delete your phone number and home address before pasting. They are not needed. The
            text is sent to the AI to be checked and is not saved in your PrepRoom account.
          </p>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          onClick={check}
          disabled={busy}
          className="rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accentDark disabled:opacity-50"
        >
          {busy ? "Checking your resume..." : "Check my resume"}
        </button>
      </div>
    </section>
  );
}