# ⚠️ PUT YOUR REAL TURNSTILE SITE KEY WHERE IT SAYS ""PASTE_SITE_KEY""

'use client';

import { useState, useEffect, useRef } from 'react';

// ─── BOSS MAN: HARDCODE YOUR TURNSTILE SITE KEY HERE ─────────────────
const TURNSTILE_SITE_KEY = "0x4AAAAAAFT_hsr9d14T35I3";
// ─────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
    onTurnstileExpired?: () => void;
    onTurnstileError?: () => void;
  }
}

export default function InterviewSimulator() {
  // ── Security gate state ──
  const [verified, setVerified] = useState(false);
  const [gateStatus, setGateStatus] = useState<'checking' | 'verified' | 'error'>('checking');

  // ── App state ──
  const [mode, setMode] = useState<'practice' | 'test'>('practice');
  const [persona, setPersona] = useState('strict');
  const [userResponse, setUserResponse] = useState('');
  const [aiFeedback, setAiFeedback] = useState<any>(null);
  const [bodyLanguageStatus] = useState('Calm & Eye Contact Maintained');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ── Turnstile callbacks ──
  useEffect(() => {
    window.onTurnstileSuccess = () => {
      setGateStatus('verified');
      setTimeout(() => setVerified(true), 900); // brief "verified" flash
    };
    window.onTurnstileExpired = () => setGateStatus('checking');
    window.onTurnstileError = () => setGateStatus('error');
  }, []);

  // ── Camera (only runs after gate opens) ──
  useEffect(() => {
    if (!verified) return;
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera access denied", err);
      }
    }
    setupCamera();
  }, [verified]);

  const handleResponseSubmit = async () => {
    const res = await fetch('/api/groq-interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        role: 'Software Engineer',
        company: 'Google',
        persona,
        userResponse,
        recentTrends: 'Generative AI Integration and System Resilience',
      }),
    });
    const data = await res.json();
    setAiFeedback(data);
  };

  // ═══════════════════════════════════════════════════════════════════
  //  SECURITY GATE SCREEN — full-page professional loader
  // ═══════════════════════════════════════════════════════════════════
  if (!verified) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6">
          {/* Animated shield */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              {gateStatus === 'verified' ? (
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">
              {gateStatus === 'verified' ? 'Access Granted' : 'Security System Checking'}
            </h1>
            <p className="text-sm text-slate-400">
              {gateStatus === 'verified'
                ? 'Redirecting you in...'
                : gateStatus === 'error'
                ? 'Something went wrong. Refresh to retry.'
                : 'Verifying you are human. This takes a moment.'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500 ${
                gateStatus === 'verified' ? 'w-full' : 'w-1/2 animate-pulse'
              }`}
            />
          </div>

          {/* Turnstile widget — invisible until it needs interaction */}
          {gateStatus !== 'verified' && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                Protected by Cloudflare
              </p>
              <div
                className="cf-turnstile"
                data-sitekey={TURNSTILE_SITE_KEY}
                data-theme="dark"
                data-size="normal"
                data-callback="onTurnstileSuccess"
                data-expired-callback="onTurnstileExpired"
                data-error-callback="onTurnstileError"
              />
            </div>
          )}

          {gateStatus === 'verified' && (
            <p className="text-xs text-cyan-400 font-medium"> Welcome User </p>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MAIN APP — only renders after verification passes
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-950 p-6 flex justify-center items-center">
      <div className="w-full max-w-4xl bg-slate-900 text-white p-6 rounded-xl shadow-2xl border border-slate-800">
        <h1 className="text-3xl font-bold mb-4 text-cyan-400">
          AI Job Simulator &amp; Interview Portal
        </h1>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setMode('practice')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              mode === 'practice' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Practice Mode (With Hints)
          </button>
          <button
            onClick={() => setMode('test')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              mode === 'test' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Test Mode (Timed &amp; Evaluated)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative border border-slate-700 rounded-lg overflow-hidden bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
            <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 text-xs rounded text-green-400 font-medium">
              Live Detector: {bodyLanguageStatus}
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg flex flex-col justify-between border border-slate-700">
            <div>
              <h3 className="font-semibold text-lg text-slate-200">Interviewer Style</h3>
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                className="w-full mt-2 p-2 bg-slate-700 rounded text-white border border-slate-600 focus:outline-none focus:border-cyan-500"
              >
                <option value="strict">Strict Technical Lead</option>
                <option value="friendly">Supportive HR Specialist</option>
                <option value="pressure">High-Pressure Executive</option>
              </select>
            </div>
          </div>
        </div>

        <textarea
          value={userResponse}
          onChange={(e) => setUserResponse(e.target.value)}
          placeholder="Type or speak your interview answer here..."
          className="w-full h-32 p-3 bg-slate-800 border border-slate-700 rounded-lg text-white mb-4 focus:outline-none focus:border-cyan-500 placeholder-slate-400"
        />

        <button
          onClick={handleResponseSubmit}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-bold text-lg hover:opacity-95 transition-opacity"
        >
          Submit Response to AI Interviewer
        </button>

        {aiFeedback && (
          <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-cyan-500/30">
            <h2 className="text-xl font-bold text-cyan-300 mb-2">
              Next Question: {aiFeedback.nextQuestion}
            </h2>
            <p className="text-slate-300 mb-2">Feedback: {aiFeedback.feedback}</p>
            <div className="text-yellow-400 font-semibold">Score: {aiFeedback.score}/10</div>
          </div>
        )}
      </div>
    </div>
  );
}
