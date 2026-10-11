"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import type {
  BodyReport,
  Expression,
  ListeningReport,
  ListeningSegment,
  Rating,
} from "./types";

const VERSION = "0.10.14";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const SAMPLE_MS = 150; // one measurement about every 0.15 seconds
const BASELINE_SAMPLES = 20; // about 3 seconds to learn your normal posture

type Vision = typeof import("@mediapipe/tasks-vision");
type Fileset = Awaited<ReturnType<Vision["FilesetResolver"]["forVisionTasks"]>>;
type Status = "off" | "loading" | "on" | "error";
type HandLevel = "calm" | "natural" | "restless";

export type LiveSignals = {
  face: boolean;
  eyeContact: boolean;
  upright: boolean | null;
  calibrating: boolean;
  hands: HandLevel | null;
  expression: Expression | null;
};

type ListenCounter = {
  samples: number;
  faceSamples: number;
  attentive: number;
  smiling: number;
  concerned: number;
  surprised: number;
  neutral: number;
};

type Counters = {
  samples: number;
  faceSamples: number;
  eyeSamples: number;
  postureSamples: number;
  uprightSamples: number;
  baseline: number[];
  baselineValue: number | null;
  handDist: number;
  handTicks: number;
  prevWrists: ({ x: number; y: number } | null)[];
  listen: Record<string, ListenCounter>;
  listenOrder: string[];
};

function newListen(): ListenCounter {
  return {
    samples: 0,
    faceSamples: 0,
    attentive: 0,
    smiling: 0,
    concerned: 0,
    surprised: 0,
    neutral: 0,
  };
}

function newCounters(): Counters {
  return {
    samples: 0,
    faceSamples: 0,
    eyeSamples: 0,
    postureSamples: 0,
    uprightSamples: 0,
    baseline: [],
    baselineValue: null,
    handDist: 0,
    handTicks: 0,
    prevWrists: [null, null],
    listen: {},
    listenOrder: [],
  };
}

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((100 * part) / whole) : 0;
}

function handLevel(c: Counters): HandLevel | null {
  const seconds = (c.handTicks * SAMPLE_MS) / 1000;
  if (seconds < 5) return null;
  const speed = c.handDist / seconds; // shoulder-widths per second
  if (speed < 0.12) return "calm";
  if (speed < 0.5) return "natural";
  return "restless";
}

function dominantOf(l: ListenCounter): Expression {
  if (l.faceSamples === 0) return "neutral";
  const options: Expression[] = ["smiling", "concerned", "surprised"];
  let best: Expression = "neutral";
  let bestCount = 0;
  for (const e of options) {
    if (l[e] > bestCount) {
      best = e;
      bestCount = l[e];
    }
  }
  return bestCount / l.faceSamples >= 0.25 ? best : "neutral";
}

function buildListening(c: Counters): ListeningReport | null {
  const segments: ListeningSegment[] = [];
  const total = newListen();

  for (const name of c.listenOrder) {
    const l = c.listen[name];
    if (!l || l.samples < 20) continue; // under about 3 seconds: ignore
    total.samples += l.samples;
    total.faceSamples += l.faceSamples;
    total.attentive += l.attentive;
    total.smiling += l.smiling;
    total.concerned += l.concerned;
    total.surprised += l.surprised;
    total.neutral += l.neutral;

    segments.push({
      speaker: name,
      seconds: Math.round((l.samples * SAMPLE_MS) / 1000),
      attentivePct: pct(l.attentive, l.samples),
      smilingPct: pct(l.smiling, l.faceSamples),
      concernedPct: pct(l.concerned, l.faceSamples),
      surprisedPct: pct(l.surprised, l.faceSamples),
      expression: dominantOf(l),
    });
  }

  if (segments.length === 0 || total.samples < 30) return null;

  const attentivePct = pct(total.attentive, total.samples);
  const rating: Rating =
    attentivePct >= 75 ? "Good" : attentivePct >= 50 ? "Fair" : "Needs work";
  const expressionMix = {
    smiling: pct(total.smiling, total.faceSamples),
    concerned: pct(total.concerned, total.faceSamples),
    surprised: pct(total.surprised, total.faceSamples),
    neutral: pct(total.neutral, total.faceSamples),
  };
  const dominant = dominantOf(total);

  const lowest = segments.reduce((a, b) =>
    b.attentivePct < a.attentivePct ? b : a
  );
  const tensest = segments.reduce((a, b) =>
    b.concernedPct > a.concernedPct ? b : a
  );

  const lines: string[] = [
    `While your teammates were speaking you stayed attentive about ${attentivePct}% of the time.`,
  ];
  if (expressionMix.neutral >= 85) {
    lines.push("Your face stayed mostly neutral.");
  }
  if (expressionMix.concerned >= 25) {
    lines.push("You looked tense or puzzled for part of it.");
  }
  if (expressionMix.smiling >= 25) {
    lines.push("You often looked warm and open.");
  }
  if (expressionMix.surprised >= 25) {
    lines.push("You looked surprised several times.");
  }
  if (segments.length > 1 && lowest.attentivePct < 60) {
    lines.push(
      `Your attention dropped most while ${lowest.speaker} was speaking.`
    );
  }
  if (tensest.concernedPct >= 30) {
    lines.push(`You looked most tense while ${tensest.speaker} was speaking.`);
  }

  const tips: string[] = [];
  if (attentivePct < 60) {
    tips.push(
      "Keep your face toward the screen and your eyes on the speaker while others talk. Looking away tells people you are not listening."
    );
  } else if (attentivePct >= 75) {
    tips.push("You stayed focused while others were speaking. That builds trust.");
  }
  if (expressionMix.concerned >= 25) {
    tips.push(
      "A frown can look like disagreement or irritation. Try to keep a calm, open face while you hear someone out, even when you disagree."
    );
  }
  if (expressionMix.neutral >= 85) {
    tips.push(
      "A small nod or a light smile when someone makes a good point shows you are listening."
    );
  }
  if (expressionMix.smiling >= 25 && expressionMix.concerned < 25) {
    tips.push("Your warm expression helps people feel safe to speak up.");
  }

  return {
    attentivePct,
    rating,
    dominant,
    expressionMix,
    segments,
    summary: lines.join(" "),
    tips,
  };
}

async function loadModels(vision: Vision, fileset: Fileset) {
  const make = async (delegate: "GPU" | "CPU") => {
    const face = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
    const pose = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    return { face, pose };
  };

  try {
    return await make("GPU");
  } catch {
    // Some computers cannot use the graphics card for this. Fall back to the CPU.
    return await make("CPU");
  }
}

export function useBodyLanguage() {
  const [status, setStatus] = useState<Status>("off");
  const [error, setError] = useState("");
  const [live, setLive] = useState<LiveSignals | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceRef = useRef<FaceLandmarker | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingRef = useRef(false);
  const counters = useRef<Counters>(newCounters());
  const lastLiveAt = useRef(0);
  const listenLabel = useRef<string | null>(null);

  const release = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    faceRef.current?.close();
    faceRef.current = null;
    poseRef.current?.close();
    poseRef.current = null;
  }, []);

  useEffect(() => {
    return () => release();
  }, [release]);

  // The Team meeting tells us whose message the user is currently listening to.
  const setListening = useCallback((label: string | null) => {
    listenLabel.current = label;
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const faceModel = faceRef.current;
    const poseModel = poseRef.current;
    if (!video || !faceModel || !poseModel || video.readyState < 2) return;

    try {
      const now = performance.now();
      const c = counters.current;
      c.samples += 1;

      // ---- Face: head direction, eyes and expression ----
      let faceFound = false;
      let eye = false;
      let attentive = false;
      let expression: Expression = "neutral";

      const f = faceModel.detectForVideo(video, now);
      const lm = f.faceLandmarks[0];
      if (lm) {
        faceFound = true;
        c.faceSamples += 1;

        const a = lm[234];
        const b = lm[454];
        const nose = lm[1];
        const minX = Math.min(a.x, b.x);
        const w = Math.abs(a.x - b.x);
        const yaw = w > 0 ? (nose.x - minX) / w : 0.5; // 0.5 means facing the camera

        const shapes = f.faceBlendshapes[0]?.categories ?? [];
        const score = (name: string) =>
          shapes.find((s) => s.categoryName === name)?.score ?? 0;
        const avg = (x: string, y: string) => (score(x) + score(y)) / 2;

        const side = Math.max(
          score("eyeLookInLeft"),
          score("eyeLookOutLeft"),
          score("eyeLookInRight"),
          score("eyeLookOutRight")
        );
        const down = avg("eyeLookDownLeft", "eyeLookDownRight");
        const blink = avg("eyeBlinkLeft", "eyeBlinkRight");

        eye = yaw > 0.38 && yaw < 0.62 && side < 0.5 && down < 0.6;
        if (eye) c.eyeSamples += 1;

        // Listening attention is kinder than eye contact, because people read the
        // screen below the camera. We only ask: face toward the screen, eyes open,
        // not looking far to the side.
        attentive = yaw > 0.3 && yaw < 0.7 && side < 0.6 && blink < 0.7;

        const smile = avg("mouthSmileLeft", "mouthSmileRight");
        const frown = avg("mouthFrownLeft", "mouthFrownRight");
        const browDown = avg("browDownLeft", "browDownRight");
        const browUp = Math.max(
          score("browInnerUp"),
          avg("browOuterUpLeft", "browOuterUpRight")
        );
        const jaw = score("jawOpen");

        if (browUp > 0.5 && jaw > 0.15) expression = "surprised";
        else if (smile > 0.35) expression = "smiling";
        else if (browDown > 0.4 || frown > 0.3) expression = "concerned";
        else expression = "neutral";
      }

      // ---- Record this moment for the teammate being listened to ----
      const label = listenLabel.current;
      if (label) {
        let l = c.listen[label];
        if (!l) {
          l = newListen();
          c.listen[label] = l;
          c.listenOrder.push(label);
        }
        l.samples += 1;
        if (faceFound) {
          l.faceSamples += 1;
          if (attentive) l.attentive += 1;
          l[expression] += 1;
        }
      }

      // ---- Body: posture and hands ----
      let upright: boolean | null = null;
      const p = poseModel.detectForVideo(video, now);
      const pl = p.landmarks[0];
      if (pl) {
        const ls = pl[11];
        const rs = pl[12];
        const nose = pl[0];
        const shouldersVisible =
          (ls.visibility ?? 0) > 0.5 && (rs.visibility ?? 0) > 0.5;
        const sw = Math.abs(ls.x - rs.x); // shoulder width

        if (shouldersVisible && sw > 0.05) {
          const lift = ((ls.y + rs.y) / 2 - nose.y) / sw; // bigger when sitting tall
          const tilt = Math.abs(ls.y - rs.y) / sw;

          if (c.baselineValue === null) {
            c.baseline.push(lift);
            if (c.baseline.length >= BASELINE_SAMPLES) {
              c.baselineValue =
                c.baseline.reduce((x, y) => x + y, 0) / c.baseline.length;
            }
          } else {
            c.postureSamples += 1;
            const ok = lift >= c.baselineValue * 0.8 && tilt < 0.25;
            if (ok) c.uprightSamples += 1;
            upright = ok;
          }

          [pl[15], pl[16]].forEach((wrist, i) => {
            const visible = (wrist.visibility ?? 0) > 0.5;
            const prev = c.prevWrists[i];
            if (visible && prev) {
              const d = Math.hypot(wrist.x - prev.x, wrist.y - prev.y) / sw;
              if (d < 1) {
                c.handDist += d;
                c.handTicks += 1;
              }
            }
            c.prevWrists[i] = visible ? { x: wrist.x, y: wrist.y } : null;
          });
        }
      }

      // ---- Update the screen about twice a second ----
      if (now - lastLiveAt.current > 500) {
        lastLiveAt.current = now;
        setLive({
          face: faceFound,
          eyeContact: eye,
          upright,
          calibrating: c.baselineValue === null,
          hands: handLevel(c),
          expression: faceFound ? expression : null,
        });
      }
    } catch (e) {
      console.error("body language tick error:", e);
    }
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || timerRef.current) return;
    startingRef.current = true;
    setStatus("loading");
    setError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser cannot use the camera. Try Chrome or Edge.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
      const { face, pose } = await loadModels(vision, fileset);
      faceRef.current = face;
      poseRef.current = pose;

      timerRef.current = setInterval(tick, SAMPLE_MS);
      setStatus("on");
    } catch (e) {
      release();
      setStatus("error");
      const name = e instanceof Error ? e.name : "";
      if (name === "NotAllowedError") {
        setError(
          "The camera is blocked. Click the lock icon in the address bar and allow the camera."
        );
      } else if (name === "NotFoundError") {
        setError("No camera was found on this computer.");
      } else {
        setError(
          e instanceof Error ? e.message : "The camera could not be started."
        );
      }
    } finally {
      startingRef.current = false;
    }
  }, [tick, release]);

  const stop = useCallback(() => {
    release();
    setStatus("off");
    setLive(null);
  }, [release]);

  const getSummary = useCallback((): BodyReport | null => {
    const c = counters.current;
    if (c.samples < 20 || c.faceSamples < 10) return null; // not enough data

    const seconds = Math.round((c.faceSamples * SAMPLE_MS) / 1000);
    const facePresentPct = Math.round((100 * c.faceSamples) / c.samples);
    const eyeContactPct = Math.round((100 * c.eyeSamples) / c.faceSamples);
    const uprightPct =
      c.postureSamples >= 10
        ? Math.round((100 * c.uprightSamples) / c.postureSamples)
        : null;
    const hands = handLevel(c);

    const tips: string[] = [];
    if (eyeContactPct < 50) {
      tips.push(
        "Try to look toward the camera more while you speak. It makes the listener feel you are talking to them."
      );
    } else if (eyeContactPct >= 70) {
      tips.push("Good eye contact. You faced the camera most of the time.");
    }
    if (uprightPct !== null && uprightPct < 70) {
      tips.push(
        "Your posture drifted during the interview. Sit tall with both shoulders level and relaxed."
      );
    } else if (uprightPct !== null) {
      tips.push("You kept a steady, upright posture.");
    }
    if (hands === "restless") {
      tips.push(
        "Your hands moved a lot. Rest them on the table and use a few deliberate gestures to make a point."
      );
    } else if (hands === "calm") {
      tips.push(
        "Your hands were very still. A few natural gestures can make you look more engaged."
      );
    }
    if (facePresentPct < 80) {
      tips.push(
        "Your face was out of view for part of the time. Keep your face inside the frame."
      );
    }

    // ---- Ratings and the written summary ----
    const attentionPct = Math.round(0.7 * eyeContactPct + 0.3 * facePresentPct);
    const attention: Rating =
      attentionPct >= 70 ? "Good" : attentionPct >= 45 ? "Fair" : "Needs work";
    const posture: Rating | null =
      uprightPct === null
        ? null
        : uprightPct >= 75
          ? "Good"
          : uprightPct >= 50
            ? "Fair"
            : "Needs work";
    const handsRating: Rating | null =
      hands === "natural"
        ? "Good"
        : hands === "calm"
          ? "Fair"
          : hands === "restless"
            ? "Needs work"
            : null;

    const words = (r: Rating) =>
      r === "Good" ? "good" : r === "Fair" ? "fair" : "weak";

    const lines: string[] = [];
    lines.push(
      `Your attention was ${words(attention)}: you faced the camera about ${eyeContactPct}% of the time.`
    );
    if (posture) {
      lines.push(
        `Your posture was ${words(posture)}: you stayed upright about ${uprightPct}% of the time.`
      );
    }
    if (hands) {
      lines.push(
        hands === "natural"
          ? "Your hand gestures looked natural."
          : hands === "calm"
            ? "Your hands were very still, which can look a little stiff."
            : "Your hands moved a lot, which can distract the listener."
      );
    }

    const rank = { "Needs work": 0, Fair: 1, Good: 2 } as const;
    const areas: { name: string; rating: Rating }[] = [
      { name: "eye contact and attention", rating: attention },
    ];
    if (posture) areas.push({ name: "posture", rating: posture });
    if (handsRating) areas.push({ name: "hand gestures", rating: handsRating });
    const weakest = areas.reduce((a, b) =>
      rank[b.rating] < rank[a.rating] ? b : a
    );
    lines.push(
      weakest.rating === "Good"
        ? "All areas were solid. Keep it up."
        : `Focus on your ${weakest.name} first in the next attempt.`
    );

    const report: BodyReport = {
      seconds,
      facePresentPct,
      eyeContactPct,
      uprightPct,
      handMovement: hands,
      summary: lines.join(" "),
      ratings: { attention, posture, hands: handsRating },
      tips,
    };

    const listening = buildListening(c);
    if (listening) report.listening = listening;
    return report;
  }, []);

  return {
    status,
    error,
    live,
    videoRef,
    start,
    stop,
    getSummary,
    setListening,
  };
}