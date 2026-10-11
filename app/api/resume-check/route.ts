import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { verifyTurnstile, getClientIp } from "@/lib/turnstile";

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

function buildPrompt(role: string) {
  return [
    `You are an experienced recruiter and resume coach. Review the resume text for a candidate applying for this role: ${role}.`,
    `Score exactly these 5 sections from 0 to 10: Structure and format, Impact and results, Relevance to the role, Skills and keywords, Clarity and language.`,
    `Rules: Judge only what is written. Never guess or mention the person's name, age, gender, nationality or background. Each section needs a "finding" (what you saw, include a short exact phrase from the resume when possible) and a "fix" (one concrete action).`,
    `"missingKeywords": up to 8 skills or terms normally expected for this role that the resume does not show. Do not claim the candidate has them.`,
    `"rewrites": choose 3 weak lines copied exactly from the resume and write an improved version of each. NEVER invent facts, employers, tools or numbers. If a number would help, use a placeholder such as [X%] or [number] for the candidate to fill in with real data. "why" is one short reason.`,
    `"topFixes": the 3 most important actions, in order. "overall" is 0 to 100. "summary" is 2 or 3 sentences.`,
    `Reply ONLY with JSON in exactly this shape: {"overall": number, "summary": string, "sections": [{"name": string, "score": number, "finding": string, "fix": string}], "missingKeywords": string[], "rewrites": [{"original": string, "improved": string, "why": string}], "topFixes": string[]}`,
  ].join("\n\n");
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

  const human = await verifyTurnstile(body.turnstileToken, getClientIp(req));
  if (!human) {
    return NextResponse.json(
      { error: "Captcha verification failed. Please refresh and try again." },
      { status: 403 }
    );
  }

  const resume = asString(body.resume).trim().slice(0, 8000);
  const role = asString(body.role).trim().slice(0, 100);
  if (!role) {
    return NextResponse.json({ error: "Please enter the target role." }, { status: 400 });
  }
  if (resume.length < 200) {
    return NextResponse.json(
      { error: "Please paste your full resume (at least a few lines)." },
      { status: 400 }
    );
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 3500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildPrompt(role) },
        { role: "user", content: `Resume text:\n\n${resume}` },
      ],
    });

    const raw = safeJson(completion.choices[0]?.message?.content ?? "");

    return NextResponse.json({
      overall: clamp(raw.overall, 0, 100),
      summary: asString(raw.summary),
      sections: asList(raw.sections, 6).map((item) => {
        const s = (item ?? {}) as Raw;
        return {
          name: asString(s.name),
          score: clamp(s.score, 0, 10),
          finding: asString(s.finding),
          fix: asString(s.fix),
        };
      }),
      missingKeywords: asList(raw.missingKeywords, 8).map((k) => asString(k)),
      rewrites: asList(raw.rewrites, 4).map((item) => {
        const r = (item ?? {}) as Raw;
        return {
          original: asString(r.original),
          improved: asString(r.improved),
          why: asString(r.why),
        };
      }),
      topFixes: asList(raw.topFixes, 5).map((f) => asString(f)),
    });
  } catch (err) {
    console.error("resume-check error:", err);
    return NextResponse.json(
      { error: "The AI could not check the resume right now. Please try again." },
      { status: 502 }
    );
  }
}
