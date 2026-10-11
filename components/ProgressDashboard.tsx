"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Debrief } from "@/lib/types";

type Row = {
  id: string;
  created_at: string;
  mode: "practice" | "test";
  company: string | null;
  role: string | null;
  overall_score: number | null;
  debrief: Debrief | null;
};

type Point = { label: string; score: number };

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function ScoreChart({ points }: { points: Point[] }) {
  const w = 600;
  const h = 200;
  const padX = 32;
  const padY = 24;
  const stepX = points.length > 1 ? (w - padX * 2) / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? padX + i * stepX : w / 2);
  const y = (s: number) => h - padY - (s / 100) * (h - padY * 2);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.score)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Score over time">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={padX} x2={w - padX} y1={y(g)} y2={y(g)} stroke="#E3DFD5" />
          <text x={0} y={y(g) + 4} fontSize="10" fill="#5F6B7A">
            {g}
          </text>
        </g>
      ))}
      {points.length > 1 && (
        <path d={path} fill="none" stroke="#0E7C7B" strokeWidth="2" />
      )}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.score)} r="4" fill="#0E7C7B" />
          <text x={x(i)} y={y(p.score) - 10} fontSize="10" textAnchor="middle" fill="#14213D">
            {p.score}
          </text>
          <text x={x(i)} y={h - 4} fontSize="10" textAnchor="middle" fill="#5F6B7A">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function ProgressDashboard({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("sessions")
      .select("id, created_at, mode, company, role, overall_score, debrief")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message);
        else setRows((data ?? []) as Row[]);
      });
  }, [userId]);

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!rows) return <p className="text-sm text-muted">Loading your progress...</p>;

  const scored = rows.filter((r) => typeof r.overall_score === "number");

  if (scored.length === 0) {
    return (
      <section className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-semibold">Your progress</h2>
        <p className="mt-2 text-sm text-muted">
          No finished interviews yet. Complete one in the Interview tab and your
          results will appear here.
        </p>
      </section>
    );
  }

  const scores = scored.map((r) => r.overall_score as number);
  const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const best = Math.max(...scores);
  const change = scores.length > 1 ? scores[scores.length - 1] - scores[0] : null;

  const points: Point[] = scored.slice(-12).map((r) => ({
    label: shortDate(r.created_at),
    score: r.overall_score as number,
  }));

  const skillMap = new Map<string, { total: number; count: number; tip: string }>();
  for (const r of rows) {
    for (const item of r.debrief?.rubric ?? []) {
      const current = skillMap.get(item.skill) ?? { total: 0, count: 0, tip: "" };
      current.total += item.score;
      current.count += 1;
      if (item.tip) current.tip = item.tip;
      skillMap.set(item.skill, current);
    }
  }
  const skills = Array.from(skillMap, ([name, v]) => ({
    name,
    avg: v.total / v.count,
    tip: v.tip,
  }));
  const weakest = skills.length
    ? skills.reduce((a, b) => (b.avg < a.avg ? b : a))
    : null;

  const recent = [...rows].reverse().slice(0, 8);

  return (
    <section className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-semibold">Your progress</h2>
      <p className="mt-1 text-sm text-muted">Based on your saved interviews.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Attempts" value={String(scored.length)} />
        <StatCard label="Average" value={`${average}`} hint="out of 100" />
        <StatCard label="Best" value={`${best}`} hint="out of 100" />
        <StatCard
          label="Change"
          value={change === null ? "-" : `${change > 0 ? "+" : ""}${change}`}
          hint="first to latest"
        />
      </div>

      <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
        Score over time
      </h3>
      <div className="mt-3 rounded-lg border border-line bg-white p-4">
        <ScoreChart points={points} />
      </div>

      {skills.length > 0 && (
        <>
          <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
            Average by skill
          </h3>
          <div className="mt-3 space-y-4 rounded-lg border border-line bg-white p-4">
            {skills.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted">{s.avg.toFixed(1)} / 10</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${s.avg * 10}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {weakest && (
        <div className="mt-8 border-l-2 border-accent pl-4">
          <p className="text-sm font-semibold text-accent">Work on this next: {weakest.name}</p>
          {weakest.tip && <p className="mt-1 text-sm text-muted">{weakest.tip}</p>}
        </div>
      )}

      <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
        Recent attempts
      </h3>
      <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
        {recent.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">
                {r.role ?? "Interview"} at {r.company ?? "Company"}
              </p>
              <p className="text-xs text-muted">
                {shortDate(r.created_at)} | {r.mode === "practice" ? "Practice" : "Test"}
              </p>
            </div>
            <p className="text-lg font-semibold text-accent">{r.overall_score ?? "-"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}