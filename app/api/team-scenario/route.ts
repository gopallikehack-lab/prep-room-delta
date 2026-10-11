import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { TEAM_ROUNDS, getScenario } from "@/lib/teamScenarios";
import type { Mood, Scenario } from "@/lib/teamScenarios";
import type { Debrief, Mode } from "@/lib/types";

// Use the same model name as in your other routes.
const MODEL = "openai/gpt-oss-120b";

type Raw = Record<string, unknown>;
type TeamMsg = { speaker: string; text: string };

const MOODS: string[] = ["supportive", "neutral", "frustrated"];

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

function parseMessages(v: unknown): TeamMsg[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(-40)
    .map((item) => (item ?? {}) as Raw)
    .filter((m) => typeof m.speaker === "string" && typeof m.text === "string")
    .map((m) => ({
      speaker: asString(m.speaker).slice(0, 40),
      text: asString(m.text).slice(0, 1500),
    }));
}

function toTranscript(msgs: TeamMsg[]) {
  return msgs
    .map((m) => `${m.speaker === "You" ? "Team lead" : m.speaker}: ${m.text}`)
    .join("\n");
}

function buildTurnPrompt(s: Scenario, leaderCount: number, mode: Mode) {
  const people = s.teammates
    .map((t) => `- ${t.name} (${t.role}): ${t.personality}`)
    .join("\n");

  const progress =
    leaderCount === 0
      ? `The meeting is starting. One or two teammates briefly describe the problem from their own point of view, then wait for the team lead to take charge.`
      : leaderCount >= TEAM_ROUNDS
        ? `The team lead has now sent all ${TEAM_ROUNDS} messages. Teammates give a short closing reaction to the plan. Nobody asks a new question.`
        : `The team lead has sent ${leaderCount} of ${TEAM_ROUNDS} messages. Continue the meeting.`;

  const modeBlock =
    mode === "practice"
      ? `This is PRACTICE mode. Set "coachTip" to 1 or 2 honest sentences of leadership advice about the team lead's LAST message. When the meeting is just starting, "coachTip" must be an empty string.`
      : `This is TEST mode. "coachTip" must always be an empty string.`;

  return [
    `You are simulating a team meeting for a leadership practice exercise. The human is the TEAM LEAD. You play ALL of the teammates below. Never speak for the team lead.`,
    `Scenario: ${s.title}. Situation: ${s.brief}`,
    `Teammates (stay strictly in character):\n${people}`,
    `Hidden information (only a teammate who is asked or invited can reveal it, and only in character): ${s.hiddenFact}`,
    `Rules: After each team lead message, choose 1 to 3 teammates who would naturally respond and write their replies. Not everyone has to speak every turn. Teammates react to what the team lead really said: if they are ignored, dismissed or blamed their mood gets worse; if they are listened to and given clear direction it gets better. Do not make it too easy and do not make it impossible. Each reply is under 60 words, in natural workplace language, with no stage directions. "mood" is exactly one of: supportive, neutral, frustrated.`,
    progress,
    modeBlock,
    `Reply ONLY with JSON in exactly this shape: {"replies": [{"speaker": string, "message": string, "mood": string}], "coachTip": string}. "speaker" must be exactly one of: ${s.teammates.map((t) => t.name).join(", ")}.`,
  ].join("\n\n");
}

function buildDebriefPrompt(s: Scenario) {
  return [
    `You are an experienced leadership coach. Read the team meeting transcript and grade the TEAM LEAD (the person labelled "Team lead") fairly. Scenario: ${s.title}. Situation: ${s.brief} Goal: ${s.goal}`,
    `Hidden information in this scenario: ${s.hiddenFact} In your summary, say clearly whether the team lead uncovered it.`,
    `Grade exactly these 5 skills from 0 to 10: Clear direction, Listening to the team, Handling conflict, Decision making, Fairness and inclusion.`,
    `Rules: every skill needs an "evidence" field with a SHORT exact quote (under 25 words) copied from a message written by the Team lead. If the team lead gave nothing to judge for a skill, give a low score and say so in "evidence" instead of inventing a quote. You may use how the teammates reacted to support your judgement, but the quote must come from the team lead. Be honest: not harsh, not flattering. "tip" is one concrete action for the next attempt.`,
    `"overall" is 0 to 100. "summary" is 2 or 3 sentences.`,
    `Reply ONLY with JSON in exactly this shape: {"overall": number, "summary": string, "rubric": [{"skill": string, "score": number, "evidence": string, "tip": string}], "strengths": string[], "improvements": string[]}`,
  ].join("\n\n");
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

  const scenario = getScenario(asString(body.scenarioId));
  if (!scenario) {
    return NextResponse.json({ error: "Unknown scenario." }, { status: 400 });
  }
  const mode: Mode = body.mode === "test" ? "test" : "practice";
  const messages = parseMessages(body.messages);
  const leaderCount = messages.filter((m) => m.speaker === "You").length;
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    if (body.action === "turn") {
      const userContent =
        messages.length === 0
          ? "The meeting is starting. Write the opening replies."
          : `Meeting so far:\n${toTranscript(messages)}\n\nWrite the teammates' next replies.`;

      const completion = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildTurnPrompt(scenario, leaderCount, mode) },
          { role: "user", content: userContent },
        ],
      });

      const out = safeJson(completion.choices[0]?.message?.content ?? "");
      const names = scenario.teammates.map((t) => t.name);
      const replies = asList(out.replies, 3)
        .map((item) => {
          const r = (item ?? {}) as Raw;
          const mood = asString(r.mood);
          return {
            speaker: asString(r.speaker).trim(),
            message: asString(r.message).trim().slice(0, 600),
            mood: (MOODS.includes(mood) ? mood : "neutral") as Mood,
          };
        })
        .filter((r) => names.includes(r.speaker) && r.message);

      if (replies.length === 0) throw new Error("No teammate replies");

      return NextResponse.json({
        replies,
        coachTip: mode === "practice" ? asString(out.coachTip).trim() : "",
        finished: leaderCount >= TEAM_ROUNDS,
      });
    }

    if (body.action === "debrief") {
      if (leaderCount < 1) {
        return NextResponse.json(
          { error: "Send at least one message to the team first." },
          { status: 400 }
        );
      }
      const completion = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 3500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildDebriefPrompt(scenario) },
          { role: "user", content: toTranscript(messages) },
        ],
      });
      const out = safeJson(completion.choices[0]?.message?.content ?? "");
      return NextResponse.json(cleanDebrief(out));
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("team-scenario error:", err);
    return NextResponse.json(
      { error: "The AI could not answer right now. Please try again." },
      { status: 502 }
    );
  }
}