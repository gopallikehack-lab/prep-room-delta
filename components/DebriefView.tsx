import type { Debrief, Rating } from "@/lib/types";
import { paceAdvice } from "@/lib/voice";
import ListeningView from "./ListeningView";

type Props = {
  debrief: Debrief;
  onRestart: () => void;
  restartLabel?: string;
};

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed">
        {items.map((item, i) => (
          <li key={i} className="border-l-2 border-line pl-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RatingCard({ label, rating }: { label: string; rating: Rating | null }) {
  const color =
    rating === "Good"
      ? "text-accent"
      : rating === "Fair"
        ? "text-amber-700"
        : rating === "Needs work"
          ? "text-red-700"
          : "text-muted";
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={"mt-2 text-xl font-semibold " + color}>
        {rating ?? "Not enough data"}
      </p>
    </div>
  );
}

export default function DebriefView({ debrief, onRestart, restartLabel }: Props) {
  const voice = debrief.voice;
  const body = debrief.body;

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-end justify-between border-b border-line pb-6">
        <div>
          <p className="text-sm text-muted">Your debrief</p>
          <h2 className="text-2xl font-semibold">Overall score</h2>
        </div>
        <p className="text-5xl font-semibold text-accent">
          {debrief.overall}
          <span className="text-lg text-muted">/100</span>
        </p>
      </div>

      <p className="mt-6 text-sm leading-relaxed">{debrief.summary}</p>

      <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
        Rubric
      </h3>
      <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
        {debrief.rubric.map((r) => (
          <div key={r.skill} className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{r.skill}</p>
              <p className="text-sm font-semibold">{r.score}/10</p>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${r.score * 10}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-muted">
              <span className="font-medium text-ink">Evidence: </span>
              &ldquo;{r.evidence}&rdquo;
            </p>
            <p className="mt-1 text-sm text-muted">
              <span className="font-medium text-ink">Next time: </span>
              {r.tip}
            </p>
          </div>
        ))}
      </div>

      {voice && (
        <>
          <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
            Voice report
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Stat label="Spoken answers" value={String(voice.answers)} />
            <Stat
              label="Average pace"
              value={voice.avgWpm === null ? "-" : `${voice.avgWpm} wpm`}
            />
            <Stat label="Filler words" value={String(voice.fillerTotal)} />
          </div>
          {voice.avgWpm !== null && (
            <p className="mt-3 text-sm text-muted">{paceAdvice(voice.avgWpm)}</p>
          )}
          {voice.topFillers.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              Most used:{" "}
              {voice.topFillers.map((f) => `${f.word} (${f.count})`).join(", ")}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            The browser often hides sounds like um and uh when it writes your
            words down, so the real number can be higher.
          </p>
        </>
      )}

      {body && (
        <>
          <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
            Body language report
          </h3>
          <p className="mt-3 text-sm leading-relaxed">{body.summary}</p>
          <div className="mb-4 mt-4 grid gap-4 sm:grid-cols-3">
            <RatingCard label="Attention" rating={body.ratings.attention} />
            <RatingCard label="Posture" rating={body.ratings.posture} />
            <RatingCard label="Hand gestures" rating={body.ratings.hands} />
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <Stat label="Eye contact" value={`${body.eyeContactPct}%`} />
            <Stat
              label="Upright posture"
              value={body.uprightPct === null ? "-" : `${body.uprightPct}%`}
            />
            <Stat
              label="Hand movement"
              value={
                body.handMovement
                  ? body.handMovement.charAt(0).toUpperCase() +
                    body.handMovement.slice(1)
                  : "-"
              }
            />
            <Stat label="Face in view" value={`${body.facePresentPct}%`} />
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed">
            {body.tips.map((t, i) => (
              <li key={i} className="border-l-2 border-line pl-3">
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            These are rough signals from your camera, based on {body.seconds}{" "}
            seconds with your face in view. They show where your head and body
            were pointing, not your feelings or personality. Your video never
            left your device.
          </p>
        </>
      )}
      {body?.listening && <ListeningView report={body.listening} />}
      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <ListBlock title="What went well" items={debrief.strengths} />
        <ListBlock title="What to improve" items={debrief.improvements} />
      </div>

      <button
        onClick={onRestart}
        className="mt-10 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        {restartLabel ?? "Start another interview"}
      </button>
    </section>
  );
}