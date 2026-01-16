"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/* =========================
   Helpers & Types
========================= */

function friendlyError(reason?: string) {
  switch (reason) {
    case "letters_dont_fit":
      return "That word uses letters not available in today’s word.";
    case "not_in_dictionary":
      return "That word isn’t in the dictionary.";
    case "plural_requires_singular":
      return "Plural words are only allowed if the singular exists.";
    case "daily_word_disallowed":
      return "You can’t use today’s full word.";
    case "length":
      return "That word is not a valid length.";
    case "empty":
      return "Type a word first.";
    case "nonalpha":
      return "Only letters are allowed.";
    default:
      return "Invalid word.";
  }
}

type Result = { word: string; valid: boolean; points: number };
type DaySummary = {
  key: string;
  totalPoints: number;
  validCount: number;
  totalGuesses: number;
  completed: boolean;
};

function getPointsForLength(len: number) {
  if (len < 4) return 0;
  if (len === 4) return 1;
  if (len === 5) return 2;
  if (len === 6) return 3;
  return 5;
}

function counts(s: string) {
  const m = new Map<string, number>();
  for (const ch of s) {
    if (!/^[a-z]$/.test(ch)) continue;
    m.set(ch, (m.get(ch) ?? 0) + 1);
  }
  return m;
}

/* =========================
   8 PM Day Alignment
========================= */

function localDayKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getGameDayDate(now = new Date()) {
  const d = new Date(now);
  d.setHours(d.getHours() - 20);
  return d;
}

function gameDayKey(now = new Date()) {
  return localDayKey(getGameDayDate(now));
}

function yesterdayKeyFromGameDayKey(todayKey: string) {
  const [y, m, d] = todayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return localDayKey(dt);
}

function nextRolloverLocal8pm(now = new Date()) {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 0, 0, 0);
  if (d.getTime() >= next.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* =========================
   Constants
========================= */

const DAILY_GOAL_POINTS = 20;
const COMPLETED_PREFIX = "wordsinwords:completed:";
const STREAK_KEY = "wordsinwords:streak";
const HISTORY_KEY = "wordsinwords:history";

/* =========================
   Game Component
========================= */

export default function Game({ dailyWord }: { dailyWord: string }) {
  const bankLetters = useMemo(() => dailyWord.toLowerCase().split(""), [dailyWord]);
  const bankCounts = useMemo(() => counts(dailyWord.toLowerCase()), [dailyWord]);

  const [guess, setGuess] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completedToday, setCompletedToday] = useState(false);

  /* ---------- Time ---------- */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayKey = useMemo(() => gameDayKey(now), [now]);
  const nextRollover = useMemo(() => nextRolloverLocal8pm(now), [now]);
  const countdown = formatDuration(nextRollover.getTime() - now.getTime());

  /* ---------- Derived ---------- */
  const normalizedGuess = guess.trim().toLowerCase();
  const guessCounts = counts(normalizedGuess);

  const fitsBank = (() => {
    let ok = true;
    guessCounts.forEach((n, ch) => {
      if ((bankCounts.get(ch) ?? 0) < n) ok = false;
    });
    return ok;
  })();

  const pointsPreview =
    normalizedGuess.length >= 4 && fitsBank
      ? getPointsForLength(normalizedGuess.length)
      : 0;

  const totalPoints = results.reduce((s, r) => s + (r.valid ? r.points : 0), 0);

  /* ---------- Submit ---------- */
  async function submitGuess() {
    if (!normalizedGuess) return;
    if (!fitsBank) return;

    setError(null);

    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guess: normalizedGuess, dailyWord }),
    });

    const data = await res.json();
    const valid = !!data.valid;
    const points = valid ? getPointsForLength(normalizedGuess.length) : 0;

    setResults((r) => [...r, { word: normalizedGuess, valid, points }]);

    if (!valid) setError(friendlyError(data.reason));
    if (!completedToday && totalPoints + points >= DAILY_GOAL_POINTS) {
      setCompletedToday(true);
    }

    setGuess("");
  }

  /* =========================
     Render
  ========================= */

  return (
    <main style={{ padding: "2rem", maxWidth: 760, margin: "0 auto" }}>
      <h1>Words in Words</h1>

      <p>
        New word every day at <b>8:00 PM local</b> • Next in <b>{countdown}</b>
      </p>

      <p>
        Today’s word: <b>{dailyWord.toUpperCase()}</b>
      </p>

      <p>
        Score: {totalPoints}/{DAILY_GOAL_POINTS}{" "}
        {completedToday && "✅"}
      </p>

      {/* Input */}
      <input
        value={guess}
        onChange={(e) =>
          setGuess(e.target.value.toLowerCase().replace(/[^a-z]/g, ""))
        }
        onKeyDown={(e) => e.key === "Enter" && submitGuess()}
        placeholder="Type a word"
        style={{ padding: "0.5rem", width: "100%", marginTop: "1rem" }}
      />

      <button onClick={submitGuess} style={{ marginTop: "0.5rem" }}>
        Guess
      </button>

      {error && <div style={{ color: "red" }}>{error}</div>}

      {/* Letter Bank */}
      <h3>Letter Bank</h3>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {bankLetters.map((l, i) => (
          <div key={i} style={{ border: "1px solid #ccc", padding: "0.5rem" }}>
            {l.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Results */}
      <h3>Guesses</h3>
      {results.map((r, i) => (
        <div key={i}>
          {r.word} {r.valid ? `✓ +${r.points}` : "✗"}
        </div>
      ))}
    </main>
  );
}
