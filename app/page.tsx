"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import AuthBox from "@/components/AuthBox";
import Landing from "@/components/Landing";
import InterviewSimulator from "@/components/InterviewSimulator";
import TeamScenario from "@/components/TeamScenario";
import ProgressDashboard from "@/components/ProgressDashboard";
import ResumeCheck from "@/components/ResumeCheck";
import VisionBoard from "@/components/VisionBoard";

type View = "interview" | "team" | "progress" | "resume" | "vision";

const tabs: { id: View; label: string }[] = [
  { id: "interview", label: "Interview" },
  { id: "team", label: "Team" },
  { id: "progress", label: "Progress" },
  { id: "resume", label: "Resume" },
  { id: "vision", label: "Vision" },
];

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("interview");
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <button
            onClick={() => setShowAuth(false)}
            className="text-base font-semibold tracking-tight"
          >
            PrepRoom
          </button>
          {session ? (
            <div className="flex items-center gap-6">
              <nav className="flex gap-4">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setView(t.id)}
                    className={
                      "border-b-2 pb-1 text-sm " +
                      (view === t.id
                        ? "border-accent font-medium text-ink"
                        : "border-transparent text-muted hover:text-ink")
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-sm text-muted hover:text-ink"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="text-sm text-muted hover:text-ink"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {session ? (
          <>
            <div className={view === "interview" ? "" : "hidden"}>
              <InterviewSimulator userId={session.user.id} />
            </div>
            <div className={view === "team" ? "" : "hidden"}>
              <TeamScenario userId={session.user.id} />
            </div>
            {view === "progress" && <ProgressDashboard userId={session.user.id} />}
            {view === "resume" && <ResumeCheck />}
            {view === "vision" && <VisionBoard userId={session.user.id} />}
          </>
        ) : showAuth ? (
          <AuthBox />
        ) : (
          <Landing onStart={() => setShowAuth(true)} />
        )}
      </main>
    </div>
  );
}