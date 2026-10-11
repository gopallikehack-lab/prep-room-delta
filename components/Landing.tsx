type Props = {
  onStart: () => void;
};

// After you export your logo from Canva and save it as public/logo.png,
// change null to "/logo.png" on the next line.
const LOGO: string | null = null;

const steps = [
  {
    title: "Choose your target",
    text: "Pick the job role and the company. Questions follow what that company cares about right now.",
  },
  {
    title: "Face the interviewer",
    text: "Choose a friendly HR, a strict manager, a stress interviewer or a busy executive. Practise with tips or take a real test.",
  },
  {
    title: "Get a fair debrief",
    text: "Every score is backed by a quote from your own answers, with one clear action for next time.",
  },
];

const features: { title: string; text: string; ready: boolean }[] = [
  {
    title: "Company-aware questions",
    text: "Questions come from saved notes about what the company is focusing on.",
    ready: true,
  },
  {
    title: "Interviewer personalities",
    text: "Four different behaviours, from warm to demanding.",
    ready: true,
  },
  {
    title: "Practice and test mode",
    text: "Coach tips while you learn, then a no-help test.",
    ready: true,
  },
  {
    title: "Evidence-based score card",
    text: "Five skills scored, each proved with your own words.",
    ready: true,
  },
  {
    title: "Progress tracker",
    text: "See your scores and weakest skill across attempts.",
    ready: true,
  },
  {
    title: "Voice and camera practice",
    text: "Speak your answers and see body language signals.",
    ready : true,
  },
  {
    title: "Resume check",
    text: "A score for your resume and advice to improve it.",
    ready : true,
  },
  {
    title: "Team leadership scenarios",
    text: "Lead AI teammates with different personalities.",
    ready : true,
  },
  {
    title: "Vision board and affirmations",
    text: "Set goals and get personal affirmations.",
    ready : true,
  },
];

export default function Landing({ onStart }: Props) {
  return (
    <div className="mx-auto max-w-4xl">
      <section className="py-10 sm:py-16">
        {LOGO && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={LOGO} alt="PrepRoom logo" className="mb-6 h-14 w-auto" />
        )}
        <p className="text-sm font-medium uppercase tracking-wide text-accent">
          AI job simulator
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
          Practise the interview before it counts.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
          PrepRoom puts you in a realistic interview with an AI interviewer who
          reacts to what you actually say. Afterwards you get an honest score
          card that quotes your own answers.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={onStart}
            className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accentDark"
          >
            Get started
          </button>
          <span className="text-sm text-muted">Free to try. Takes about 10 minutes.</span>
        </div>
      </section>

      <section className="border-t border-line py-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          How it works
        </h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title}>
              <p className="text-3xl font-semibold text-accent">{i + 1}</p>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line py-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          What you get
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-line bg-white p-4"
            >
              <p
                className={
                  "text-xs font-medium " + (f.ready ? "text-accent" : "text-muted")
                }
              >
                {f.ready ? "Available" : "Coming soon"}
              </p>
              <h3 className="mt-2 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line py-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Built to be fair
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          Everyone is graded on the same five skills. The AI is told to judge
          only what you said, never your name, accent, age or gender. Every
          score must point to a quote, so you can see exactly why you got it.
        </p>
      </section>
    </div>
  );
}