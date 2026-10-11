export type Mode = "practice" | "test";

export type InterviewerStyle = "friendly" | "strict" | "stress" | "busy";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type SetupConfig = {
  role: string;
  company: string;
  style: InterviewerStyle;
  mode: Mode;
};

export type RubricItem = {
  skill: string;
  score: number; // 0 to 10
  evidence: string; // short quote from the candidate
  tip: string;
};

// Numbers measured from one spoken answer.
export type VoiceStat = {
  words: number;
  wpm: number | null; // words per minute, null if the answer was too short
  fillerTotal: number;
  fillers: Record<string, number>;
};

// Summary of all spoken answers in one interview.
export type VoiceSummary = {
  answers: number;
  avgWpm: number | null;
  fillerTotal: number;
  topFillers: { word: string; count: number }[];
};

// Rough signals measured from the camera. Only these numbers are saved, never video.
export type Rating = "Good" | "Fair" | "Needs work";
export type BodyReport = {
  seconds: number; // time with a face in view
  facePresentPct: number;
  eyeContactPct: number;
  uprightPct: number | null;
  handMovement: "calm" | "natural" | "restless" | null;
    summary: string;
  ratings: {
    attention: Rating;
    posture: Rating | null;
    hands: Rating | null;
  };
  tips: string[];
  listening?: ListeningReport;
};
export type Debrief = {
  overall: number; // 0 to 100
  summary: string;
  rubric: RubricItem[];
  strengths: string[];
  improvements: string[];
  voice?: VoiceSummary;
  body?: BodyReport;
};

export type Expression = "smiling" | "concerned" | "surprised" | "neutral";

export type ListeningSegment = {
  speaker: string;
  seconds: number;
  attentivePct: number;
  smilingPct: number;
  concernedPct: number;
  surprisedPct: number;
  expression: Expression;
};

export type ListeningReport = {
  attentivePct: number;
  rating: Rating;
  dominant: Expression;
  expressionMix: {
    smiling: number;
    concerned: number;
    surprised: number;
    neutral: number;
  };
  segments: ListeningSegment[];
  summary: string;
  tips: string[];
};