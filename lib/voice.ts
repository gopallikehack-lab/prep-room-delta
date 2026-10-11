import type { VoiceStat, VoiceSummary } from "./types";

const FILLERS = [
  "um",
  "uh",
  "er",
  "you know",
  "basically",
  "actually",
  "literally",
  "kind of",
  "sort of",
  "i mean",
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function buildStat(text: string, spanSeconds: number): VoiceStat {
  const lower = text.toLowerCase();
  const fillers: Record<string, number> = {};
  let fillerTotal = 0;

  for (const f of FILLERS) {
    const matches = lower.match(new RegExp(`\\b${escapeRegExp(f)}\\b`, "g"));
    if (matches) {
      fillers[f] = matches.length;
      fillerTotal += matches.length;
    }
  }

  const words = countWords(text);
  // Pace is only meaningful for answers that are long enough.
  const wpm =
    words >= 15 && spanSeconds >= 8
      ? Math.round(words / (spanSeconds / 60))
      : null;

  return { words, wpm, fillerTotal, fillers };
}

export function summarizeVoice(stats: VoiceStat[]): VoiceSummary | null {
  if (stats.length === 0) return null;

  const wpms = stats.map((s) => s.wpm).filter((v): v is number => v !== null);
  const avgWpm = wpms.length
    ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length)
    : null;

  const totals: Record<string, number> = {};
  for (const s of stats) {
    for (const [word, count] of Object.entries(s.fillers)) {
      totals[word] = (totals[word] ?? 0) + count;
    }
  }
  const topFillers = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word, count]) => ({ word, count }));

  return {
    answers: stats.length,
    avgWpm,
    fillerTotal: stats.reduce((sum, s) => sum + s.fillerTotal, 0),
    topFillers,
  };
}

export function paceAdvice(wpm: number) {
  if (wpm < 110) {
    return "Your pace is on the slow side. Try to keep a steady flow, and pause only at the end of a point.";
  }
  if (wpm <= 160) {
    return "Your pace is in a comfortable range for an interview.";
  }
  return "Your pace is fast. Slow down a little so the listener can follow every point.";
}