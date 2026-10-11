export type Mood = "supportive" | "neutral" | "frustrated";

// How many messages the team lead gets to send in one meeting.
export const TEAM_ROUNDS = 6;

export type Teammate = {
  name: string;
  role: string;
  personality: string;
};

export type Scenario = {
  id: string;
  title: string;
  summary: string;
  brief: string;
  goal: string;
  hiddenFact: string;
  teammates: Teammate[];
};

export const SCENARIOS: Scenario[] = [
  {
    id: "launch-week",
    title: "Launch week crisis",
    summary: "The launch is in 5 days and a key feature is behind schedule.",
    brief:
      "You have just been made team lead of a four-person app project. The app launches for its first customer in 5 days. The payment feature is two days behind, the customer wants a status update by tomorrow, and the team is tense. You have called a team meeting.",
    goal: "Agree a clear plan with the team that you can tell the customer by tomorrow.",
    hiddenFact:
      "Meera (QA) has found a serious bug in the payment flow that could lose customers' money. She shares it only if the leader asks for her opinion or invites her to speak.",
    teammates: [
      {
        name: "Riya",
        role: "Backend developer",
        personality:
          "Direct and impatient. Wants quick decisions and suggests cutting scope. Gets frustrated by long discussions or vague plans. Respects clear, confident direction.",
      },
      {
        name: "Arjun",
        role: "UI designer",
        personality:
          "A perfectionist who cares about quality. Resists cutting features and worries that rushed work will embarrass the team. Calms down when his concerns are acknowledged and he is given a clear role.",
      },
      {
        name: "Meera",
        role: "QA tester",
        personality:
          "Quiet and careful. Rarely speaks unless asked directly. She has noticed a serious problem and shares it only if the leader asks her opinion or invites her to speak. Withdraws further if the louder teammates dominate.",
      },
    ],
  },
  {
    id: "credit-dispute",
    title: "Dispute over credit",
    summary: "Two teammates clash after a presentation and a report is due Friday.",
    brief:
      "Yesterday the department head praised a report in front of everyone but mentioned only Neha, even though Sameer did most of the analysis. Sameer is upset, Neha feels awkward, and the next report is due on Friday. You are the team lead and you have called a short team meeting.",
    goal: "Rebuild trust and agree who does what for Friday's report.",
    hiddenFact:
      "Karan (the intern) saw that Sameer's name was left off the shared slides by accident and not by Neha's choice. He mentions it only if the leader asks him directly.",
    teammates: [
      {
        name: "Sameer",
        role: "Data analyst",
        personality:
          "Quietly angry and defensive. Answers in short sentences and points to facts. Softens if his work is acknowledged by name and he is not blamed.",
      },
      {
        name: "Neha",
        role: "Marketing executive",
        personality:
          "Friendly and eager to keep the peace. Says everything is fine and avoids the real issue. Opens up only if she is gently asked what she really thinks.",
      },
      {
        name: "Karan",
        role: "Intern",
        personality:
          "Eager but unsure. Wants clear instructions, tends to take sides if nobody guides the group, and shares what he knows only when asked directly.",
      },
    ],
  },
];

export function getScenario(id: string) {
  return SCENARIOS.find((s) => s.id === id);
}