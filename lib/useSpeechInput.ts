"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Change this if you want another accent, for example "en-US" or "en-GB".
const LANGUAGE = "en-IN";

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechInput(onFinalText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");

  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const callbackRef = useRef(onFinalText);
  const firstAt = useRef<number | null>(null);
  const lastAt = useRef<number | null>(null);

  useEffect(() => {
    callbackRef.current = onFinalText;
  });

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      wantRef.current = false;
      recRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || wantRef.current) return;

    setError("");
    const rec = new Ctor();
    rec.lang = LANGUAGE;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      const now = Date.now();
      if (firstAt.current === null) firstAt.current = now;
      lastAt.current = now;

      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) callbackRef.current(r[0].transcript.trim());
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed") {
        wantRef.current = false;
        setError(
          "The microphone is blocked. Click the lock icon in the address bar and allow the microphone."
        );
      } else {
        setError("Voice problem: " + e.error);
      }
    };

    rec.onend = () => {
      // The browser stops after a long silence, so restart while the user wants to talk.
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          // already started, ignore
        }
        return;
      }
      setListening(false);
      setInterim("");
    };

    recRef.current = rec;
    wantRef.current = true;
    setListening(true);
    try {
      rec.start();
    } catch {
      wantRef.current = false;
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  // Seconds between the first and last spoken result of the current answer.
  const getSpanSeconds = useCallback(() => {
    if (firstAt.current === null || lastAt.current === null) return 0;
    return (lastAt.current - firstAt.current) / 1000;
  }, []);

  const resetSpan = useCallback(() => {
    firstAt.current = null;
    lastAt.current = null;
  }, []);

  return { supported, listening, interim, error, start, stop, getSpanSeconds, resetSpan };
}