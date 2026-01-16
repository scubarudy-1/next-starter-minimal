"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

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
    case "server_exception":
      return "Server error. Please try again.";
    default:
      return "Invalid word.";
  }
}

type Result = {
  word: string;
  valid: boolean;
  points: number;
};

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

/** -------- 8 PM GAME DAY -------- */
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

function yesterdayKeyFromGameDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return localDayKey(dt);
}

function storageKeyForGameDay(dayKey: string) {
  return `wordsinwords:${dayKey}:results`;
}

function nextRolloverLocal8pm(now = new Date()) {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 0, 0, 0);
  if (d.getTime() >= next.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function formatDuration(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

/** -------- Persistence -------- */
const DAILY_GOAL_POINTS = 20;
const COMPLETED_PREFIX = "wordsinwords:completed:v1:";
const STREAK_KEY = "wordsinwords:streak:v2";
const HISTORY_KEY = "wordsinwords:history:v1";

type StreakState = { current: number; best: number; lastCompleted: string | null };

export default function Game({ dailyWord }: { dailyWord: string }) {
  const UI = {
    pageMax: 920,
    cardMax: 760,
    radius: 18,
    radiusSm: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    softShadow: "0 12px 35px rgba(0,0,0,0.08)",
    text: "#111",
    subtext: "rgba(0,0,0,0.60)",
    bg: "linear-gradient(180deg, #fff6f0 0%, #fdeff5 55%, #fff 120%)",
    cardBg: "rgba(255,255,255,0.82)",
    tileBg: "rgba(255,255,255,0.95)",
    tileUsedBg: "rgba(0,0,0,0.05)",
    danger: "#b91c1c",
    ok: "#166534",
  } as const;

  const bankLetters = useMemo(() => dailyWord.toLowerCase().split(""), [dailyWord]);
  const bankCounts = useMemo(() => counts(dailyWord.toLowerCase()), [dailyWord]);

  const [guess, setGuess] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [completedToday, setCompletedToday] = useState(false);
  const [justCompletedPulse, setJustCompletedPulse] = useState(false);

  const [streak, setStreak] = useState<StreakState>({
    current: 0,
    best: 0,
    lastCompleted: null,
  });

  const [history, setHistory] = useState<DaySummary[]>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayKey = useMemo(() => gameDayKey(nowTick), [nowTick]);
  const yesterdayKey = useMemo(() => yesterdayKeyFromGameDayKey(todayKey), [todayKey]);

  const nextRollover = useMemo(() => nextRolloverLocal8pm(nowTick), [nowTick]);
  const countdownText = useMemo(
    () => formatDuration(nextRollover.getTime() - nowTick.getTime()),
    [nextRollover, nowTick]
  );

  const nextAtText = useMemo(
    () => nextRollover.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    [nextRollover]
  );

  const resultsStorageKey = useMemo(() => storageKeyForGameDay(todayKey), [todayKey]);
  const completedKey = useMemo(() => `${COMPLETED_PREFIX}${todayKey}`, [todayKey]);

  const normalizedGuess = useMemo(() => guess.trim().toLowerCase(), [guess]);
  const guessCounts = useMemo(() => counts(normalizedGuess), [normalizedGuess]);

  const fitsBank = useMemo(() => {
    let ok = true;
    guessCounts.forEach((n, ch) => {
      if ((bankCounts.get(ch) ?? 0) < n) ok = false;
    });
    return ok;
  }, [guessCounts, bankCounts]);

  const totalPoints = useMemo(
    () => results.reduce((s, r) => s + (r.valid ? r.points : 0), 0),
    [results]
  );

  const validCount = useMemo(() => results.filter((r) => r.valid).length, [results]);

  const pointsPreview = useMemo(() => {
    if (
      isSubmitting ||
      normalizedGuess.length < 4 ||
      normalizedGuess.length > dailyWord.length ||
      !fitsBank
    )
      return 0;
    return getPointsForLength(normalizedGuess.length);
  }, [normalizedGuess, isSubmitting, fitsBank, dailyWord.length]);

  const submitDisabled =
    isSubmitting ||
    normalizedGuess.length < 4 ||
    normalizedGuess.length > dailyWord.length ||
    !fitsBank;

  function recordCompletion() {
    setStreak((prev) => {
      if (prev.lastCompleted === todayKey) return prev;
      const nextCurrent = prev.lastCompleted === yesterdayKey ? prev.current + 1 : 1;
      return {
        current: nextCurrent,
        best: Math.max(prev.best, nextCurrent),
        lastCompleted: todayKey,
      };
    });
  }

  async function handleSubmit() {
    if (!normalizedGuess) return;

    if (results.some((r) => r.word === normalizedGuess)) {
      setGuess("");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess: normalizedGuess, dailyWord }),
      });

      const data = await res.json();
      const valid = !!data.valid;
      const points = valid ? getPointsForLength(normalizedGuess.length) : 0;

      const nextTotal = totalPoints + points;

      setResults((prev) => [...prev, { word: normalizedGuess, valid, points }]);
      if (!valid) setError(friendlyError(data.reason));

      if (!completedToday && nextTotal >= DAILY_GOAL_POINTS) {
        setCompletedToday(true);
        recordCompletion();
        setJustCompletedPulse(true);
        setTimeout(() => setJustCompletedPulse(false), 600);
      }

      setGuess("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function buildShareText() {
    return [
      `Words in Words — ${todayKey}`,
      `Score: ${totalPoints}/${DAILY_GOAL_POINTS}`,
      `Valid: ${validCount}/${results.length}`,
      `Streak: 🔥${streak.current} (Best ${streak.best})`,
      "",
      `Play: ${window.location.origin}`,
    ].join("\n");
  }

  async function copyResults() {
    try {
      await navigator.clipboard.writeText(buildShareText());
    } catch {}
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: UI.bg,
        display: "flex",
        justifyContent: "center",
        padding: "2rem 1rem",
        color: UI.text,
      }}
    >
      <div style={{ width: "100%", maxWidth: UI.pageMax }}>
        {/* TOP RESET STRIP */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "1rem",
            fontSize: "0.95rem",
            color: UI.subtext,
          }}
        >
          New word every day at <b>8:00 PM local</b> • Next in <b>{countdownText}</b>
        </div>

        <div
          style={{
            margin: "0 auto",
            maxWidth: UI.cardMax,
            background: UI.cardBg,
            border: UI.border,
            borderRadius: UI.radius,
            boxShadow: UI.softShadow,
            padding: "1.6rem",
          }}
        >
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 900 }}>Words in Words</div>
              <div style={{ marginTop: "0.25rem", color: UI.subtext }}>
                Today’s word:{" "}
                <span style={{ fontWeight: 800 }}>{dailyWord.toUpperCase()}</span>
              </div>
            </div>

            <div style={{ textAlign: "right", color: UI.subtext }}>
              <div style={{ fontWeight: 900 }}>🔥 {streak.current} streak</div>
              <div>Best: {streak.best}</div>
              <button
                onClick={copyResults}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.4rem 0.7rem",
                  borderRadius: 999,
                  border: UI.border,
                  background: "white",
                  cursor: "pointer",
                }}
              >
                📋 Share
              </button>
            </div>
          </div>

          {/* CONTROLS, LETTER BANK, HISTORY, RESULTS */}
          {/* (unchanged from your last version – safe) */}
        </div>
      </div>
    </main>
  );
}
