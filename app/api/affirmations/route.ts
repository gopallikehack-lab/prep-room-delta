import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// Use the same model name as in your other routes.
const MODEL = "openai/gpt-oss-120b";

type Raw = Record<string, unknown>;

const asString = (v: unknown) => (typeof v === "string" ? v : "");
const asList = (v: unknown, max: number): unknown[] =>
  Array.isArray(v) ? v.slice(0, max) : [];

function safeJson(text: string): Raw {
  try {
    return JSON.parse(text) as Raw;
  } catch {
    return {};
  }
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

  const goals = asList(body.goals, 8)
    .map((item) => {
      const g = (item ?? {}) as Raw;
      return {
        title: asString(g.title).trim().slice(0, 100),
        why: asString(g.why).trim().slice(0, 300),
      };
    })
    .filter((g) => g.title);

  if (goals.length === 0) {
    return NextResponse.json(
      { error: "Add at least one goal first." },
      { status: 400 }
    );
  }

  const focusSkill = asString(body.focusSkill).trim().slice(0, 60);

  const goalLines = goals
    .map((g, i) => `${i + 1}. ${g.title}${g.why ? ` (why it matters: ${g.why})` : ""}`)
    .join("\n");

  const system = [
    `You write personal affirmations for a student or job seeker who is preparing for their career.`,
    `Their goals:\n${goalLines}`,
    focusSkill
      ? `In their last practice session their weakest skill was: ${focusSkill}. Include exactly one affirmation about practising and improving this skill.`
      : `They have no practice results yet, so include one affirmation about practising regularly.`,
    `Rules: write exactly 6 affirmations. Each is in the first person and present tense, believable, and specific to one of the goals. Focus on effort, preparation and growth that the person controls. Never promise or claim a future result such as getting a job, an offer or a salary. No comparisons with other people, and no health claims. Each is under 22 words. Vary how they begin. Use plain, warm language.`,
    `Reply ONLY with JSON in exactly this shape: {"affirmations": string[]}`,
  ].join("\n\n");

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: "Write the affirmations." },
      ],
    });

    const out = safeJson(completion.choices[0]?.message?.content ?? "");
    const affirmations = asList(out.affirmations, 8)
      .map((a) => asString(a).trim().slice(0, 200))
      .filter(Boolean);

    if (affirmations.length === 0) throw new Error("No affirmations");
    return NextResponse.json({ affirmations });
  } catch (err) {
    console.error("affirmations error:", err);
    return NextResponse.json(
      { error: "The AI could not write affirmations right now. Please try again." },
      { status: 502 }
    );
  }
}