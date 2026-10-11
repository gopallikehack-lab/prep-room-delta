"use client";

import { useEffect } from "react";
import { useBodyLanguage } from "@/lib/useBodyLanguage";
import type { BodyReport } from "@/lib/types";

type Controls = {
  setListening: (label: string | null) => void;
};

type Props = {
  registerSummary: (fn: () => BodyReport | null) => void;
  registerControls?: (controls: Controls) => void;
};

const EXPRESSION_TEXT = {
  smiling: "Smiling",
  concerned: "Tense or puzzled",
  surprised: "Surprised",
  neutral: "Neutral",
} as const;

function Chip({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean | null;
}) {
  const color =
    good === null ? "text-muted" : good ? "text-accent" : "text-amber-700";
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={"text-sm font-medium " + color}>{value}</p>
    </div>
  );
}

export default function BodyCamera({ registerSummary, registerControls }: Props) {
  const { status, error, live, videoRef, start, stop, getSummary, setListening } =
    useBodyLanguage();

  useEffect(() => {
    registerSummary(getSummary);
  }, [registerSummary, getSummary]);

  useEffect(() => {
    registerControls?.({ setListening });
  }, [registerControls, setListening]);

  const active = status === "on" || status === "loading";

  return (
    <div className="mt-6 rounded-lg border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Body language practice</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Optional. Your camera is processed inside this browser tab. No video
            or picture is uploaded or saved. Only a few percentages are added to
            your debrief.
          </p>
        </div>
        <button
          onClick={active ? stop : start}
          className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-muted"
        >
          {active ? "Turn off camera" : "Turn on camera"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

      <div className={active ? "mt-4 flex flex-wrap items-start gap-4" : "hidden"}>
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-32 w-44 rounded-md bg-ink object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <div className="min-w-[220px] flex-1">
          {status === "loading" && (
            <p className="text-xs text-muted">
              Loading the camera model. The first time can take 10 to 20 seconds.
            </p>
          )}
          {status === "on" && (
            <>
              <p className="mb-2 text-xs text-muted">
                {live?.calibrating
                  ? "Sit upright for 3 seconds so I can learn your normal posture."
                  : "Tracking. Look near the camera lens when you answer."}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Chip
                  label="Face"
                  value={live?.face ? "In view" : "Not seen"}
                  good={live ? live.face : null}
                />
                <Chip
                  label="Eye contact"
                  value={live ? (live.eyeContact ? "Good" : "Looking away") : "..."}
                  good={live ? live.eyeContact : null}
                />
                <Chip
                  label="Posture"
                  value={
                    live?.upright === null || live === null
                      ? "Learning"
                      : live.upright
                        ? "Upright"
                        : "Slouching"
                  }
                  good={live?.upright ?? null}
                />
                <Chip
                  label="Hands"
                  value={live?.hands ?? "Measuring"}
                  good={live?.hands ? live.hands === "natural" : null}
                />
                <Chip
                  label="Expression"
                  value={
                    live?.expression ? EXPRESSION_TEXT[live.expression] : "..."
                  }
                  good={null}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}