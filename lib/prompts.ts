import type { InterviewerStyle, SetupConfig } from "./types";

export const STYLES: Record<
  InterviewerStyle,
  { label: string; short: string; behaviour: string }
> = {
  friendly: {
    label: "Friendly HR",
    short: "Warm and encouraging. Gentle follow-up questions.",
    behaviour:
      "You are warm and encouraging. You react kindly to good points, put the candidate at ease and ask gentle follow-up questions.",
  },
  strict: {
    label: "Strict Manager",
    short: "Serious and direct. Wants examples and numbers.",
    behaviour:
      "You are serious and direct. You rarely give praise. You ask for specific examples, numbers and results, and you do not accept vague answers.",
  },
  stress: {
    label: "Stress Interviewer",
    short: "Challenges your answers. Tests how you handle pressure.",
    behaviour:
      "You challenge the candidate. You question weak claims, push back on vague answers and keep a fast pace. You always stay professional and never insult the person.",
  },
  busy: {
    label: "Busy Executive",
    short: "Short on time. Wants clear and brief answers.",
    behaviour:
      "You are very busy and a little impatient. You like short, clear answers and you politely cut off long rambling ones.",
  },
};

type InterviewPromptInput = SetupConfig & {
  notes: string;
  answered: number;
  total: number;
};

export function buildInterviewPrompt(input: InterviewPromptInput) {
  const { role, company, style, mode, notes, answered, total } = input;
  const isLast = answered >= total;

  const companyBlock = notes.trim()
    ? `What we know about ${company} right now (use this to choose your questions):\n${notes.trim()}`
    : `We have no saved notes about ${company}. Use only general, widely known facts about this kind of company. Never invent specific facts, products or news.`;

  const modeBlock =
    mode === "practice"
      ? `This is PRACTICE mode. Along with each reply, give "coachTip": 1 or 2 honest sentences about the candidate's LAST answer (what was good and what to add). On your very first message, "coachTip" must be an empty string.`
      : `This is TEST mode. "coachTip" must always be an empty string. Do not hint, teach or praise.`;

  const progressBlock = isLast
    ? `The candidate has answered all ${total} questions. Say a short closing line in character. Do not ask another question.`
    : `The candidate has answered ${answered} of ${total} questions so far. Ask the next question.`;

  return [
    `You are a real interviewer at ${company}, interviewing a candidate for the position of ${role}.`,
    `Your personality: ${STYLES[style].behaviour}`,
    companyBlock,
    `Interview plan: ${total} main questions in total. Start with a short introduction question. Then mix role-specific questions, behavioural questions ("tell me about a time...") and one workplace scenario connected to the company focus. Ask only ONE question at a time. React to what the candidate really said. Keep every message under 90 words. Never write the candidate's answers for them.`,
    modeBlock,
    progressBlock,
    `Reply ONLY with JSON in exactly this shape: {"reply": string, "coachTip": string}`,
  ].join("\n\n");
}

export function buildDebriefPrompt(config: SetupConfig) {
  return [
    `You are an experienced hiring coach. Read the interview transcript and grade the CANDIDATE fairly. The interview was for the role of ${config.role} at ${config.company}.`,
    `Grade exactly these 5 skills from 0 to 10: Communication, Role knowledge, Problem solving, Confidence and clarity, Fit for the company.`,
    `Rules: every skill needs an "evidence" field with a SHORT exact quote (under 25 words) copied from a candidate message. If the candidate gave nothing to judge for a skill, give a low score and say so in "evidence" instead of inventing a quote. Be honest: not harsh, not flattering. "tip" is one concrete action for the next attempt.`,
    `"overall" is a number from 0 to 100. "summary" is 2 or 3 sentences.`,
    `Reply ONLY with JSON in exactly this shape: {"overall": number, "summary": string, "rubric": [{"skill": string, "score": number, "evidence": string, "tip": string}], "strengths": string[], "improvements": string[]}`,
  ].join("\n\n");
}
