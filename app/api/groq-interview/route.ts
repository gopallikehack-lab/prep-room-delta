import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { TOTAL_QUESTIONS } from "@/lib/config";
import {
  STYLES,
  buildDebriefPrompt,
  buildInterviewPrompt,
} from "@/lib/prompts";
import type {
  Debrief,
  InterviewerStyle,
  Message,
  SetupConfig,
} from "@/lib/types";

// If Groq retires this model, pick a new one at
// console.groq.com/docs/models and change only this line.
const MODEL = "openai/gpt-oss-120b";

type Raw = Record<string, unknown>;

const asString = (v: unknown) => (typeof v === "string" ? v : "");
const asList = (v: unknown, max: number): unknown[] =>
  Array.isArray(v) ? v.slice(0, max) : [];
const clamp = (v: unknown, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

function safeJson(text: string): Raw {
  try {
    return JSON.parse(text) as Raw;
  } catch {
    return {};
  }
}

function parseConfig(v: unknown): SetupConfig | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Raw;
  const role = asString(c.role).trim().slice(0, 100);
  const company = asString(c.company).trim().slice(0, 100);
  const style = asString(c.style);
  const mode = asString(c.mode);
  const validStyle = Object.keys(STYLES).includes(style);
  if (!role || !company || !validStyle) return null;
  if (mode !== "practice" && mode !== "test") return null;
  return { role, company, style: style as InterviewerStyle, mode };
}

function parseMessages(v: unknown): Message[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(-30)
    .map((item) => (item ?? {}) as Raw)
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .map((m) => ({
      role: m.role as Message["role"],
      content: asString(m.content).slice(0, 2000),
    }));
}

function cleanDebrief(raw: Raw): Debrief {
  return {
    overall: clamp(raw.overall, 0, 100),
    summary: asString(raw.summary),
    rubric: asList(raw.rubric, 8).map((item) => {
      const r = (item ?? {}) as Raw;
      return {
        skill: asString(r.skill),
        score: clamp(r.score, 0, 10),
        evidence: asString(r.evidence),
        tip: asString(r.tip),
      };
    }),
    strengths: asList(raw.strengths, 5).map((s) => asString(s)),
    improvements: asList(raw.improvements, 5).map((s) => asString(s)),
  };
}

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "The server is missing GROQ_API_KEY." },
      { status: 500 }
    );
  }

  let body: Raw;
  try {
    body = (await req.json()) as Raw;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const config = parseConfig(body.config);
  if (!config) {
    return NextResponse.json(
      { error: "Please fill in the job role and the company." },
      { status: 400 }
    );
  }
  const messages = parseMessages(body.messages);
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    if (body.action === "turn") {
      const answered = messages.filter((m) => m.role === "user").length;
      const system = buildInterviewPrompt({
        ...config,
        notes: asString(body.companyNotes).slice(0, 1500),
        answered,
        total: TOTAL_QUESTIONS,
      });

      const completion = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: "[The candidate has joined. Begin the interview.]",
          },
          ...messages,
        ],
      });

      const out = safeJson(completion.choices[0]?.message?.content ?? "");
      const reply = asString(out.reply).trim();
      if (!reply) throw new Error("Empty reply from the model");

      return NextResponse.json({
        reply,
        coachTip:
          config.mode === "practice" ? asString(out.coachTip).trim() : "",
        finished: answered >= TOTAL_QUESTIONS,
      });
    }

    if (body.action === "debrief") {
      if (!messages.some((m) => m.role === "user")) {
        return NextResponse.json(
          { error: "Answer at least one question first." },
          { status: 400 }
        );
      }
      const transcript = messages
        .map(
          (m) =>
            `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`
        )
        .join("\n\n");

      const completion = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildDebriefPrompt(config) },
          { role: "user", content: transcript },
        ],
      });

      const out = safeJson(completion.choices[0]?.message?.content ?? "");
      return NextResponse.json(cleanDebrief(out));
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("groq-interview error:", err);
    return NextResponse.json(
      { error: "The AI could not answer right now. Please try again." },
      { status: 502 }
    );
  }
}
