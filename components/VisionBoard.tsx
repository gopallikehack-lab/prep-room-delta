"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { Debrief } from "@/lib/types";

type Item = {
  id: string;
  title: string;
  why: string | null;
  target: string | null;
  image: string | null;
};

const MAX_GOALS = 8;

const inputClass =
  "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

// Shrinks a picture inside the browser so it stays small in the database.
function resizeImage(file: File, maxSide = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("This browser cannot process the picture."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not a picture. Please choose a JPG or PNG."));
    };
    img.src = url;
  });
}

export default function VisionBoard({ userId }: { userId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [affirmations, setAffirmations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [target, setTarget] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [goalsRes, affRes] = await Promise.all([
        supabase
          .from("vision_items")
          .select("id, title, why, target, image")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("affirmations")
          .select("items")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      if (goalsRes.error) setError(goalsRes.error.message);
      else setItems((goalsRes.data ?? []) as Item[]);

      const saved = affRes.data?.items;
      if (Array.isArray(saved)) {
        setAffirmations(saved.filter((s): s is string => typeof s === "string"));
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      setImage(await resizeImage(file));
    } catch (err) {
      setImage(null);
      setError(errorMessage(err));
    }
  }

  async function addGoal() {
    if (!title.trim()) {
      setError("Please give your goal a title.");
      return;
    }
    if (items.length >= MAX_GOALS) {
      setError(`You can keep up to ${MAX_GOALS} goals on one board.`);
      return;
    }
    setSaving(true);
    setError("");

    const { data, error: insertError } = await supabase
      .from("vision_items")
      .insert({
        user_id: userId,
        title: title.trim(),
        why: why.trim() || null,
        target: target.trim() || null,
        image,
      })
      .select("id, title, why, target, image")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not save the goal.");
    } else {
      setItems([...items, data as Item]);
      setTitle("");
      setWhy("");
      setTarget("");
      setImage(null);
      setFileKey((k) => k + 1);
    }
    setSaving(false);
  }

  async function removeGoal(id: string) {
    const { error: deleteError } = await supabase
      .from("vision_items")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setItems(items.filter((i) => i.id !== id));
  }

  // Finds your weakest skill from recent practice, so one affirmation can target it.
  async function findFocusSkill() {
    const { data } = await supabase
      .from("sessions")
      .select("debrief")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    for (const row of data ?? []) {
      const rubric = (row.debrief as Debrief | null)?.rubric;
      if (rubric && rubric.length > 0) {
        return rubric.reduce((a, b) => (b.score < a.score ? b : a)).skill;
      }
    }
    return "";
  }

  async function generate() {
    if (items.length === 0) {
      setError("Add at least one goal first.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const focusSkill = await findFocusSkill();
      const res = await fetch("/api/affirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goals: items.map((i) => ({ title: i.title, why: i.why ?? "" })),
          focusSkill,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");

      const list = data.affirmations as string[];
      setAffirmations(list);

      const { error: saveError } = await supabase.from("affirmations").upsert({
        user_id: userId,
        items: list,
        updated_at: new Date().toISOString(),
      });
      if (saveError) {
        setError("Your affirmations are ready, but saving failed: " + saveError.message);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading your board...</p>;

  const today = affirmations.length
    ? affirmations[Math.floor(Date.now() / 86400000) % affirmations.length]
    : null;

  return (
    <section className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-semibold">Vision board</h2>
      <p className="mt-1 text-sm text-muted">
        Put your career goals where you can see them, then get affirmations that
        keep your practice going.
      </p>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      <div className="mt-8 rounded-lg border border-line bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Add a goal
        </h3>
        <div className="mt-4 space-y-4">
          <input
            className={inputClass}
            placeholder="Your goal, for example: Get a junior data analyst job"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            rows={2}
            className={inputClass}
            placeholder="Why does it matter to you? (optional)"
            value={why}
            maxLength={300}
            onChange={(e) => setWhy(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Target date, for example: March 2027 (optional)"
            value={target}
            maxLength={40}
            onChange={(e) => setTarget(e.target.value)}
          />
          <div>
            <label className="block text-xs font-medium text-muted">
              Picture (optional). Make one in Canva, then upload it here.
            </label>
            <input
              key={fileKey}
              type="file"
              accept="image/*"
              onChange={onFile}
              className="mt-2 block w-full text-xs text-muted"
            />
            {image && (
              <div className="mt-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Preview" className="h-16 w-24 rounded-md object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImage(null);
                    setFileKey((k) => k + 1);
                  }}
                  className="text-xs text-muted hover:text-ink"
                >
                  Remove picture
                </button>
              </div>
            )}
          </div>
          <button
            onClick={addGoal}
            disabled={saving}
            className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accentDark disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add to my board"}
          </button>
        </div>
      </div>

      <h3 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
        My board ({items.length} of {MAX_GOALS})
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Your board is empty. Add your first goal above.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-lg border border-line bg-white"
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.title} className="h-36 w-full object-cover" />
              ) : (
                <div className="h-36 w-full bg-line" />
              )}
              <div className="p-4">
                <p className="font-medium">{item.title}</p>
                {item.why && (
                  <p className="mt-1 text-sm leading-relaxed text-muted">{item.why}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-accent">
                    {item.target ? `Target: ${item.target}` : ""}
                  </p>
                  <button
                    onClick={() => removeGoal(item.id)}
                    className="text-xs text-muted hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="mt-12 text-sm font-semibold uppercase tracking-wide text-muted">
        Affirmations
      </h3>
      <p className="mt-2 text-xs text-muted">
        Only your goal titles and reasons are sent to the AI to write these.
        Your pictures are not.
      </p>

      {today && (
        <div className="mt-4 border-l-2 border-accent pl-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Today
          </p>
          <p className="mt-1 text-lg leading-relaxed">{today}</p>
        </div>
      )}

      {affirmations.length > 0 && (
        <ul className="mt-5 space-y-2 text-sm leading-relaxed">
          {affirmations.map((a, i) => (
            <li key={i} className="rounded-md border border-line bg-white px-4 py-3">
              {a}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={generate}
        disabled={generating || items.length === 0}
        className="mt-5 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {generating
          ? "Writing your affirmations..."
          : affirmations.length > 0
            ? "Write new affirmations"
            : "Write my affirmations"}
      </button>
    </section>
  );
}