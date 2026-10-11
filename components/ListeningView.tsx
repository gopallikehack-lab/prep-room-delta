import type { Expression, ListeningReport, Rating } from "@/lib/types";

const LABEL: Record<Expression, string> = {
  smiling: "Smiling",
  concerned: "Tense or puzzled",
  surprised: "Surprised",
  neutral: "Neutral",
};

function ratingColor(r: Rating) {
  if (r === "Good") return "text-accent";
  if (r === "Fair") return "text-amber-700";
  return "text-red-700";
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={"mt-2 text-xl font-semibold " + (color ?? "")}>{value}</p>
    </div>
  );
}

export default function ListeningView({ report }: { report: ListeningReport }) {
  return (
    <>
      <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
        How you listened to your team
      </h3>
      <p className="mt-3 text-sm leading-relaxed">{report.summary}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card
          label="Listening attention"
          value={report.rating}
          color={ratingColor(report.rating)}
        />
        <Card label="Attentive" value={`${report.attentivePct}%`} />
        <Card label="Mostly looked" value={LABEL[report.dominant]} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Card label="Smiling" value={`${report.expressionMix.smiling}%`} />
        <Card label="Tense or puzzled" value={`${report.expressionMix.concerned}%`} />
        <Card label="Surprised" value={`${report.expressionMix.surprised}%`} />
        <Card label="Neutral" value={`${report.expressionMix.neutral}%`} />
      </div>

      <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
        Teammate by teammate
      </h4>
      <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
        {report.segments.map((s) => (
          <div
            key={s.speaker}
            className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
          >
            <div>
              <p className="font-medium">While {s.speaker} spoke</p>
              <p className="text-xs text-muted">about {s.seconds} seconds</p>
            </div>
            <p className="text-sm text-muted">
              Attentive {s.attentivePct}% | Mostly {LABEL[s.expression].toLowerCase()}
            </p>
          </div>
        ))}
      </div>

      {report.tips.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm leading-relaxed">
          {report.tips.map((t, i) => (
            <li key={i} className="border-l-2 border-line pl-3">
              {t}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-muted">
        Expressions are read from facial movements such as smile, frown and
        raised eyebrows. They show what your face did, not what you felt. The
        time spent on each teammate is estimated from reading time.
      </p>
    </>
  );
}