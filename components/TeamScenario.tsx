"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SCENARIOS, TEAM_ROUNDS, getScenario } from "@/lib/teamScenarios";
import type { Mood } from "@/lib/teamScenarios";
import { useSpeechInput } from "@/lib/useSpeechInput";
import { buildStat, countWords, summarizeVoice } from "@/lib/voice";
import type { BodyReport, Debrief, Mode, VoiceStat } from "@/lib/types";
import BodyCamera from "./BodyCamera";
import DebriefView from "./DebriefView";

type Stage = "pick" | "meeting" | "debrief";
type ChatMsg = {
  speaker: string;
  text: string;
  mood?: Mood;
  coachTip?: string;
};
type Reply = { speaker: string; message: string; mood: Mood };
type Controls = { setListening: (label: string | null) => void };

const inputClass =
  "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const MODES: { value: Mode; title: string; text: string }[] = [
  {
    value: "practice",
    title: "Practice mode",
    text: "You get a short coaching tip after each message.",
  },
  {
    value: "test",
    title: "Test mode",
    text: "No help during the meeting. Scored at the end.",
  },
];

// Different pitch per teammate so you can tell them apart by ear.
const PITCHES = [0.8, 1.0, 1.25];

function cardClass(selected: boolean) {
  const base = "block cursor-pointer rounded-lg border p-4 transition-colors ";
  return (
    base +
    (selected
      ? "border-accent bg-white ring-1 ring-accent"
      : "border-line bg-white hover:border-muted")
  );
}

function moodClass(mood?: Mood) {
  if (mood === "supportive") return "text-accent";
  if (mood === "frustrated") return "text-amber-700";
  return "text-muted";
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export default function TeamScenario({ userId }: { userId: string }) {
  const [stage, setStage] = useState<Stage>("pick");
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [mode, setMode] = useState<Mode>("practice");
  const [chat, setChat] = useState<ChatMsg[]>([]);
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
  const controlsRef = useRef<Controls>({ setListening: () => {} });
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const speech = useSpeechInput((text) => {
    usedVoice.current = true;
    setInput((prev) => (prev ? prev.trimEnd() + " " : "") + text);
  });

  const scenario = getScenario(scenarioId) ?? SCENARIOS[0];
  const leaderCount = chat.filter((m) => m.speaker === "You").length;
  const done = leaderCount >= TEAM_ROUNDS;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, busy]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  // ---- Listening timer: whose message is the user reading or hearing now? ----
  function endListening() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    controlsRef.current.setListening(null);
  }

  function startListening(replies: ChatMsg[]) {
    endListening();
    let elapsed = 0;
    replies.forEach((r) => {
      const ms = Math.max(2500, countWords(r.text) * 400);
      timersRef.current.push(
        setTimeout(() => controlsRef.current.setListening(r.speaker), elapsed)
      );
      elapsed += ms;
    });
    timersRef.current.push(
      setTimeout(() => controlsRef.current.setListening(null), elapsed)
    );
  }

  function speakReplies(replies: ChatMsg[]) {
    if (!speakAloud || typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    replies.forEach((r) => {
      const idx = Math.max(
        0,
        scenario.teammates.findIndex((t) => t.name === r.speaker)
      );
      const utterance = new SpeechSynthesisUtterance(r.text);
      utterance.pitch = PITCHES[idx] ?? 1;
      window.speechSynthesis.speak(utterance);
    });
  }

  function toggleMic() {
    if (speech.listening) {
      speech.stop();
    } else {
      endListening();
      stopSpeaking(); // so the microphone does not hear the teammates
      speech.start();
    }
  }

  async function callApi(body: Record<string, unknown>) {
    const res = await fetch("/api/team-scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId, mode, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed.");
    return data;
  }

  function toApi(list: ChatMsg[]) {
    return list.map(({ speaker, text }) => ({ speaker, text }));
  }

  function repliesToChat(replies: Reply[], coachTip: string): ChatMsg[] {
    return replies.map((r, i) => ({
      speaker: r.speaker,
      text: r.message,
      mood: r.mood,
      coachTip: i === replies.length - 1 && coachTip ? coachTip : undefined,
    }));
  }

  async function startMeeting() {
    setError("");
    setBusy(true);
    setChat([]);
    setLastStat(null);
    voiceStatsRef.current = [];
    usedVoice.current = false;
    speech.resetSpan();
    setStage("meeting");
    try {
      const data = await callApi({ action: "turn", messages: [] });
      const opening = repliesToChat(data.replies, "");
      setChat(opening);
      startListening(opening);
      speakReplies(opening);
    } catch (e) {
      setError(errorMessage(e));
      setStage("pick");
    } finally {
      setBusy(false);
    }
  }

  async function finishMeeting(finalChat: ChatMsg[]) {
    const body = bodySummaryRef.current();
    endListening();
    speech.stop();
    stopSpeaking();
    setBusy(true);
    setError("");
    try {
      const transcript = toApi(finalChat);
      const scored: Debrief = await callApi({
        action: "debrief",
        messages: transcript,
      });
      const voice = summarizeVoice(voiceStatsRef.current);
      const result: Debrief = { ...scored };
      if (voice) result.voice = voice;
      if (body) result.body = body;

      setDebrief(result);
      setStage("debrief");

      const { error: saveError } = await supabase.from("sessions").insert({
        user_id: userId,
        mode,
        scenario_type: "team",
        company: scenario.title,
        role: "Team lead",
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

  async function sendMessage() {
    const text = input.trim();
    if (!text || busy || done) return;

    endListening();
    speech.stop();
    stopSpeaking();

    const stat = usedVoice.current
      ? buildStat(text, speech.getSpanSeconds())
      : null;

    const next: ChatMsg[] = [...chat, { speaker: "You", text }];
    setChat(next);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const data = await callApi({ action: "turn", messages: toApi(next) });

      if (stat) {
        voiceStatsRef.current = [...voiceStatsRef.current, stat];
        setLastStat(stat);
      } else {
        setLastStat(null);
      }
      usedVoice.current = false;
      speech.resetSpan();

      const replies = repliesToChat(data.replies, data.coachTip);
      setChat([...next, ...replies]);
      setBusy(false);

      if (data.finished) {
        await finishMeeting([...next, ...replies]);
      } else {
        startListening(replies);
        speakReplies(replies);
      }
    } catch (e) {
      setChat(chat);
      setInput(text);
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  function restart() {
    endListening();
    stopSpeaking();
    speech.stop();
    setChat([]);
    setInput("");
    setDebrief(null);
    setError("");
    setLastStat(null);
    voiceStatsRef.current = [];
    setStage("pick");
  }

  // ---------- Screen 3: debrief ----------
  if (stage === "debrief" && debrief) {
    return (
      <>
        {error && (
          <p className="mx-auto mb-4 max-w-3xl text-sm text-red-700">{error}</p>
        )}
        <DebriefView
          debrief={debrief}
          onRestart={restart}
          restartLabel="Try another scenario"
        />
      </>
    );
  }

  // ---------- Screen 1: pick ----------
  if (stage === "pick") {
    return (
      <section className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-semibold">Team leadership</h2>
        <p className="mt-1 text-sm text-muted">
          You lead a meeting with three AI teammates. Each has a different
          personality and reacts to what you say. Turn on your camera and
          microphone during the meeting to also practise how you listen.
        </p>

        <div className="mt-8 space-y-7">
          <fieldset>
            <legend className="text-sm font-medium">Choose a scenario</legend>
            <div className="mt-2 grid gap-3">
              {SCENARIOS.map((s) => (
                <label key={s.id} className={cardClass(scenarioId === s.id)}>
                  <input
                    type="radio"
                    name="scenario"
                    className="sr-only"
                    checked={scenarioId === s.id}
                    onChange={() => setScenarioId(s.id)}
                  />
                  <span className="block text-sm font-medium">{s.title}</span>
                  <span className="mt-1 block text-xs text-muted">{s.summary}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Mode</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {MODES.map((m) => (
                <label key={m.value} className={cardClass(mode === m.value)}>
                  <input
                    type="radio"
                    name="team-mode"
                    className="sr-only"
                    checked={mode === m.value}
                    onChange={() => setMode(m.value)}
                  />
                  <span className="block text-sm font-medium">{m.title}</span>
                  <span className="mt-1 block text-xs text-muted">{m.text}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            onClick={startMeeting}
            disabled={busy}
            className="rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accentDark disabled:opacity-50"
          >
            Start the meeting
          </button>
        </div>
      </section>
    );
  }

  // ---------- Screen 2: meeting ----------
  const progress = (Math.min(leaderCount, TEAM_ROUNDS) / TEAM_ROUNDS) * 100;
  const lastMood = (name: string) =>
    [...chat].reverse().find((m) => m.speaker === name)?.mood;

  return (
    <section className="mx-auto flex max-w-3xl flex-col">
      <header className="border-b border-line pb-4">
        <h2 className="text-lg font-semibold">{scenario.title}</h2>
        <p className="text-sm text-muted">
          You are the team lead | {mode === "practice" ? "Practice mode" : "Test mode"}
        </p>

        <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm leading-relaxed">
          <span className="font-medium">Situation: </span>
          {scenario.brief}
          <span className="mt-2 block">
            <span className="font-medium">Your goal: </span>
            {scenario.goal}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {scenario.teammates.map((t) => {
            const mood = lastMood(t.name);
            return (
              <div key={t.name} className="rounded-md border border-line bg-white px-3 py-2">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted">{t.role}</p>
                <p className={"mt-1 text-xs font-medium " + moodClass(mood)}>
                  {mood ?? "listening"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Your message {Math.min(leaderCount + 1, TEAM_ROUNDS)} of {TEAM_ROUNDS}
        </p>
      </header>

      <BodyCamera
        registerSummary={(fn) => {
          bodySummaryRef.current = fn;
        }}
        registerControls={(controls) => {
          controlsRef.current = controls;
        }}
      />
      <p className="mt-2 text-xs text-muted">
        With the camera on, look at the screen while your teammates talk. Your
        attention and facial reactions are measured for each teammate.
      </p>

      <div className="mt-6 space-y-5">
        {chat.map((m, i) =>
          m.speaker === "You" ? (
            <div key={i} className="ml-auto max-w-[85%]">
              <p className="mb-1 text-right text-xs font-medium uppercase tracking-wide text-muted">
                You (team lead)
              </p>
              <div className="whitespace-pre-wrap rounded-lg bg-ink px-4 py-3 text-sm leading-relaxed text-white">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="max-w-[85%]">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                {m.speaker}
                {" | "}
                {scenario.teammates.find((t) => t.name === m.speaker)?.role}
              </p>
              <div className="whitespace-pre-wrap rounded-lg border border-line bg-white px-4 py-3 text-sm leading-relaxed">
                {m.text}
              </div>
              {m.coachTip && (
                <div className="mt-2 border-l-2 border-accent pl-3 text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-accent">Coach tip: </span>
                  {m.coachTip}
                </div>
              )}
            </div>
          )
        )}
        {busy && (
          <p className="text-sm text-muted">
            {done ? "Preparing your debrief..." : "The team is responding..."}
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
              disabled={busy || done}
              className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium hover:border-muted disabled:opacity-50"
            >
              <span
                className={
                  "h-2 w-2 rounded-full " +
                  (speech.listening ? "animate-pulse bg-red-600" : "bg-muted")
                }
              />
              {speech.listening ? "Stop listening" : "Speak your message"}
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
            Teammates speak aloud
          </label>
        </div>

        <textarea
          rows={3}
          className={inputClass}
          placeholder="Write or speak what you say to the team. Enter to send, Shift+Enter for a new line."
          value={input}
          disabled={busy || done}
          onChange={(e) => {
            if (!input && e.target.value) endListening();
            setInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />

        {speech.listening && (
          <p className="mt-2 text-xs text-muted">Listening... {speech.interim}</p>
        )}
        {speech.error && (
          <p className="mt-2 text-xs text-red-700">{speech.error}</p>
        )}
        {lastStat && (
          <p className="mt-2 text-xs text-muted">
            Last spoken message: {lastStat.words} words
            {lastStat.wpm !== null && `, about ${lastStat.wpm} words per minute`}
            {lastStat.fillerTotal > 0 &&
              `, ${lastStat.fillerTotal} filler word(s)`}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => finishMeeting(chat)}
            disabled={busy || leaderCount < 1}
            className="text-sm text-muted hover:text-ink disabled:opacity-40"
          >
            End meeting and get debrief
          </button>
          <button
            onClick={sendMessage}
            disabled={busy || done || !input.trim()}
            className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accentDark disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}