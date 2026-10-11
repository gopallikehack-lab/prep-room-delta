"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { STYLES } from "@/lib/prompts";
import { TOTAL_QUESTIONS } from "@/lib/config";
import { useSpeechInput } from "@/lib/useSpeechInput";
import { buildStat, summarizeVoice } from "@/lib/voice";
import type {
  Debrief,
  InterviewerStyle,
  Message,
  Mode,
  SetupConfig,
  VoiceStat,
  BodyReport,
} from "@/lib/types";
import DebriefView from "./DebriefView";
import BodyCamera from "./BodyCamera";

type Company = { id: string; name: string; trend_notes: string | null };
type ChatItem = Message & { coachTip?: string };
type Stage = "setup" | "interview" | "debrief";

const inputClass =
  "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const MODES: { value: Mode; title: string; text: string }[] = [
  {
    value: "practice",
    title: "Practice mode",
    text: "You get a short coach tip after every answer.",
  },
  {
    value: "test",
    title: "Test mode",
    text: "No help during the interview. Scored at the end.",
  },
];

function cardClass(selected: boolean) {
  const base = "block cursor-pointer rounded-lg border p-4 transition-colors ";
  return (
    base +
    (selected
      ? "border-accent bg-white ring-1 ring-accent"
      : "border-line bg-white hover:border-muted")
  );
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="block text-sm font-medium">{label}</span>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function InterviewSimulator({ userId }: { userId: string }) {
  const [stage, setStage] = useState<Stage>("setup");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [config, setConfig] = useState<SetupConfig>({
    role: "",
    company: "",
    style: "friendly",
    mode: "practice",
  });
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [speakAloud, setSpeakAloud] = useState(false);
  const [lastStat, setLastStat] = useState<VoiceStat | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const usedVoice = useRef(false);
  const voiceStatsRef = useRef<VoiceStat[]>([]);
  const bodySummaryRef = useRef<() => BodyReport | null>(() => null);

  const speech = useSpeechInput((text) => {
    usedVoice.current = true;
    setInput((prev) => (prev ? prev.trimEnd() + " " : "") + text);
  });

  useEffect(() => {
    supabase
      .from("company_profiles")
      .select("id, name, trend_notes")
      .order("name")
      .then(({ data }) => setCompanies(data ?? []));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, busy]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const companyNotes =
    companies.find((c) => c.name === config.company)?.trend_notes ?? "";
  const answered = chat.filter((m) => m.role === "user").length;
  const allAnswered = answered >= TOTAL_QUESTIONS;

  function speak(text: string) {
    if (!speakAloud || typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function toggleMic() {
    if (speech.listening) {
      speech.stop();
    } else {
      stopSpeaking(); // so the microphone does not hear the interviewer
      speech.start();
    }
  }

  async function callApi(body: Record<string, unknown>) {
    const res = await fetch("/api/groq-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed.");
    return data;
  }

  async function startInterview() {
    if (!config.role.trim() || !config.company.trim()) {
      setError("Please enter the job role and the company.");
      return;
    }
    setError("");
    setBusy(true);
    setChat([]);
    setLastStat(null);
    voiceStatsRef.current = [];
    usedVoice.current = false;
    speech.resetSpan();
    setStage("interview");
    try {
      const data = await callApi({
        action: "turn",
        config,
        companyNotes,
        messages: [],
      });
      setChat([{ role: "assistant", content: data.reply }]);
      speak(data.reply);
    } catch (e) {
      setError(errorMessage(e));
      setStage("setup");
    } finally {
      setBusy(false);
    }
  }

    async function finishInterview(finalChat: ChatItem[]) {
    const body = bodySummaryRef.current();
    speech.stop();
    stopSpeaking();
    setBusy(true);
    setError("");
    try {
      const transcript: Message[] = finalChat.map(({ role, content }) => ({
        role,
        content,
      }));
      const scored: Debrief = await callApi({
        action: "debrief",
        config,
        messages: transcript,
      });
      const voice = summarizeVoice(voiceStatsRef.current);

      const result: Debrief = voice ? { ...scored, voice } : scored;

      setDebrief(result);
      setStage("debrief");

      const { error: saveError } = await supabase.from("sessions").insert({
        user_id: userId,
        mode: config.mode,
        scenario_type: "interview",
        company: config.company,
        role: config.role,
        interviewer_style: config.style,
        transcript,
        debrief: result,
        overall_score: result.overall,
      });
      if (saveError) {
        setError(
          "Your debrief is ready, but saving it failed: " + saveError.message
        );
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendAnswer() {
    const text = input.trim();
    if (!text || busy || allAnswered) return;

    speech.stop();
    stopSpeaking();

    const stat = usedVoice.current
      ? buildStat(text, speech.getSpanSeconds())
      : null;

    const next: ChatItem[] = [...chat, { role: "user", content: text }];
    setChat(next);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const data = await callApi({
        action: "turn",
        config,
        companyNotes,
        messages: next.map(({ role, content }) => ({ role, content })),
      });

      if (stat) {
        voiceStatsRef.current = [...voiceStatsRef.current, stat];
        setLastStat(stat);
      } else {
        setLastStat(null);
      }
      usedVoice.current = false;
      speech.resetSpan();

      const withReply: ChatItem[] = [
        ...next,
        {
          role: "assistant",
          content: data.reply,
          coachTip: data.coachTip || undefined,
        },
      ];
      setChat(withReply);
      setBusy(false);
      speak(data.reply);
      if (data.finished) await finishInterview(withReply);
    } catch (e) {
      // put the answer back so the user does not lose it
      setChat(chat);
      setInput(text);
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  function restart() {
    stopSpeaking();
    speech.stop();
    setChat([]);
    setInput("");
    setDebrief(null);
    setError("");
    setLastStat(null);
    voiceStatsRef.current = [];
    setStage("setup");
  }

  // ---------- Screen 3: debrief ----------
  if (stage === "debrief" && debrief) {
    return (
      <>
        {error && (
          <p className="mx-auto mb-4 max-w-3xl text-sm text-red-700">{error}</p>
        )}
        <DebriefView debrief={debrief} onRestart={restart} />
      </>
    );
  }

  // ---------- Screen 1: setup ----------
  if (stage === "setup") {
    return (
      <section className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-semibold">Set up your interview</h2>
        <p className="mt-1 text-sm text-muted">
          Choose the job, the company and how the interviewer should behave.
        </p>

        <div className="mt-8 space-y-7">
          <Field label="Job role you are applying for">
            <input
              className={inputClass}
              placeholder="For example: Junior Data Analyst"
              value={config.role}
              onChange={(e) => setConfig({ ...config, role: e.target.value })}
            />
          </Field>

          <Field label="Company">
            <input
              className={inputClass}
              list="company-list"
              placeholder="Pick a saved company or type your own"
              value={config.company}
              onChange={(e) =>
                setConfig({ ...config, company: e.target.value })
              }
            />
            <datalist id="company-list">
              {companies.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            {companyNotes && (
              <p className="mt-2 text-xs text-muted">
                Saved company notes found. Questions will follow them.
              </p>
            )}
          </Field>

          <fieldset>
            <legend className="text-sm font-medium">Interviewer behaviour</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(Object.keys(STYLES) as InterviewerStyle[]).map((key) => (
                <label key={key} className={cardClass(config.style === key)}>
                  <input
                    type="radio"
                    name="style"
                    className="sr-only"
                    checked={config.style === key}
                    onChange={() => setConfig({ ...config, style: key })}
                  />
                  <span className="block text-sm font-medium">
                    {STYLES[key].label}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {STYLES[key].short}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Mode</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {MODES.map((m) => (
                <label
                  key={m.value}
                  className={cardClass(config.mode === m.value)}
                >
                  <input
                    type="radio"
                    name="mode"
                    className="sr-only"
                    checked={config.mode === m.value}
                    onChange={() => setConfig({ ...config, mode: m.value })}
                  />
                  <span className="block text-sm font-medium">{m.title}</span>
                  <span className="mt-1 block text-xs text-muted">{m.text}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            onClick={startInterview}
            disabled={busy}
            className="rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accentDark disabled:opacity-50"
          >
            Start interview
          </button>
        </div>
      </section>
    );
  }

  // ---------- Screen 2: interview ----------
  const progress =
    (Math.min(answered, TOTAL_QUESTIONS) / TOTAL_QUESTIONS) * 100;

  return (
    <section className="mx-auto flex max-w-3xl flex-col">
      <header className="border-b border-line pb-4">
        <h2 className="text-lg font-semibold">
          {config.role} at {config.company}
        </h2>
        <p className="text-sm text-muted">
          {STYLES[config.style].label} |{" "}
          {config.mode === "practice" ? "Practice mode" : "Test mode"}
        </p>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Question {Math.min(answered + 1, TOTAL_QUESTIONS)} of {TOTAL_QUESTIONS}
        </p>
      </header>

             <BodyCamera
        registerSummary={(fn) => {
          bodySummaryRef.current = fn;
        }}
      />
      <div className="mt-6 space-y-5">
        {chat.map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} className="max-w-[85%]">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Interviewer
              </p>
              <div className="whitespace-pre-wrap rounded-lg border border-line bg-white px-4 py-3 text-sm leading-relaxed">
                {m.content}
              </div>
              {m.coachTip && (
                <div className="mt-2 border-l-2 border-accent pl-3 text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-accent">Coach tip: </span>
                  {m.coachTip}
                </div>
              )}
            </div>
          ) : (
            <div key={i} className="ml-auto max-w-[85%]">
              <p className="mb-1 text-right text-xs font-medium uppercase tracking-wide text-muted">
                You
              </p>
              <div className="whitespace-pre-wrap rounded-lg bg-ink px-4 py-3 text-sm leading-relaxed text-white">
                {m.content}
              </div>
            </div>
          )
        )}
        {busy && (
          <p className="text-sm text-muted">
            {allAnswered
              ? "Preparing your debrief..."
              : "The interviewer is typing..."}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 mt-6 border-t border-line bg-paper pb-2 pt-4">
        {error && <p className="mb-2 text-sm text-red-700">{error}</p>}

        <div className="mb-2 flex items-center justify-between">
          {speech.supported ? (
            <button
              type="button"
              onClick={toggleMic}
              disabled={busy || allAnswered}
              className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium hover:border-muted disabled:opacity-50"
            >
              <span
                className={
                  "h-2 w-2 rounded-full " +
                  (speech.listening ? "animate-pulse bg-red-600" : "bg-muted")
                }
              />
              {speech.listening ? "Stop listening" : "Speak your answer"}
            </button>
          ) : (
            <p className="text-xs text-muted">
              Voice input works in Chrome or Edge.
            </p>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={speakAloud}
              onChange={(e) => {
                setSpeakAloud(e.target.checked);
                if (!e.target.checked) stopSpeaking();
              }}
            />
            Interviewer speaks aloud
          </label>
        </div>

        <textarea
          rows={3}
          className={inputClass}
          placeholder="Type your answer, or press Speak your answer. Enter to send, Shift+Enter for a new line."
          value={input}
          disabled={busy || allAnswered}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendAnswer();
            }
          }}
        />

        {speech.listening && (
          <p className="mt-2 text-xs text-muted">
            Listening... {speech.interim}
          </p>
        )}
        {speech.error && (
          <p className="mt-2 text-xs text-red-700">{speech.error}</p>
        )}
        {lastStat && (
          <p className="mt-2 text-xs text-muted">
            Last spoken answer: {lastStat.words} words
            {lastStat.wpm !== null && `, about ${lastStat.wpm} words per minute`}
            {lastStat.fillerTotal > 0 &&
              `, ${lastStat.fillerTotal} filler word(s)`}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => finishInterview(chat)}
            disabled={busy || answered < 1}
            className="text-sm text-muted hover:text-ink disabled:opacity-40"
          >
            Finish and get debrief
          </button>
          <button
            onClick={sendAnswer}
            disabled={busy || allAnswered || !input.trim()}
            className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accentDark disabled:opacity-50"
          >
            Send answer
          </button>
        </div>
      </div>
    </section>
  );
}