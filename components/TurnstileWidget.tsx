"use client";

import { useTurnstile } from "@/lib/useTurnstile";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type Props = {
  onToken?: (token: string | null) => void;
  className?: string;
  label?: string;
};

/**
 * Drop-in Turnstile widget with dark styling that matches the app.
 * Wrap it above any submit button and read the token via onToken.
 */
export default function TurnstileWidget({
  onToken,
  className = "",
  label = "Security Check",
}: Props) {
  const { containerRef, token } = useTurnstile(SITE_KEY);

  // Notify parent whenever the token changes.
  // (We still keep the token inside the hook, so if the parent
  // wants to call reset they should pass a ref — see pages that use it.)
  if (onToken) {
    // sync via microtask to avoid setState-during-render
    Promise.resolve().then(() => onToken(token));
  }

  return (
    <div
      className={`flex flex-col items-center gap-2 p-4 rounded-lg bg-slate-800/60 border border-slate-700 ${className}`}
    >
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
        🔒 {label}
      </p>
      <div ref={containerRef} />
    </div>
  );
}
