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
  key: string; // YYYY-MM-DD (GAME DAY KEY — 8PM rollover)
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

/** YYYY-MM-DD from a Date (local) */
function localDayKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** -------- 8PM GAME DAY KEY --------
 * We want the day to switch at 8:00 PM local time.
 * Trick: shift time back 20 hours so "after 8pm" maps into the next calendar date.
 */
function getGameDayDate(now = new Date()) {
  const d = new Date(now);
  d.setHours(d.getHours() - 20);
  return d;
}
function gameDayKey(now = new Date()) {
  return localDayKey(getGameDayDate(now));
}

function yesterdayKeyFromGameDayKey(todayGameKey: string) {
  const [y, m, d] = todayGameKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return localDayKey(dt);
}

/** Storage key for results list (ALIGNED to 8PM game day). */
function storageKeyForGameDay(dayKey: string) {
  return `wordsinwords:${dayKey}:results`;
}

// -------- 8PM local rollover countdown --------
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
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

// -------- Daily completion + streaks --------
const DAILY_GOAL_POINTS = 20;
const COMPLETED_PREFIX = "wordsinwords:completed:v1:"; // + YYYY-MM-DD (GAME DAY KEY)
const STREAK_KEY = "wordsinwords:streak:v2"; // completion-based streaks
type StreakState = { current: number; best: number; lastCompleted: string | null };

// -------- History --------
const HISTORY_KEY = "wordsinwords:history:v1"; // array of DaySummary

export default function Game({ dailyWord }: { dailyWord: string }) {
  // ---------- style knobs ----------
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

  const inputRef = useRef<HTMLInputElement | null>(null);

  function focusInput() {
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  useEffect(() => {
    focusInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown tick
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const nextRollover = useMemo(() => nextRolloverLocal8pm(nowTick), [nowTick]);
  const msToNext = nextRollover.getTime() - nowTick.getTime();
  const countdownText = useMemo(() => formatDuration(msToNext), [msToNext]);
  const nextAtText = useMemo(
    () => nextRollover.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    [nextRollover]
  );

  // ✅ GAME DAY KEY (8PM aligned) — updates over time
  const todayKey = useMemo(() => gameDayKey(nowTick), [nowTick]);
  const completedKey = useMemo(() => `${COMPLETED_PREFIX}${todayKey}`, [todayKey]);
  const resultsStorageKey = useMemo(() => storageKeyForGameDay(todayKey), [todayKey]);

  // Used to detect rollover and reset state
  const prevDayKeyRef = useRef<string>(todayKey);
  useEffect(() => {
    const prev = prevDayKeyRef.current;
    if (prev !== todayKey) {
      prevDayKeyRef.current = todayKey;

      // Hard reset for the new day
      setGuess("");
      setError(null);
      setIsSubmitting(false);
      setJustCompletedPulse(false);

      // Load new day's persisted state
      try {
        const rawCompleted = localStorage.getItem(`${COMPLETED_PREFIX}${todayKey}`);
        setCompletedToday(rawCompleted === "1");
      } catch {
        setCompletedToday(false);
      }

      try {
        const rawResults = localStorage.getItem(storageKeyForGameDay(todayKey));
        if (rawResults) {
          const parsed = JSON.parse(rawResults);
          if (Array.isArray(parsed)) setResults(parsed);
          else setResults([]);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      }

      focusInput();
    }
  }, [todayKey]);

  const normalizedGuess = useMemo(() => guess.trim().toLowerCase(), [guess]);
  const guessCounts = useMemo(() => counts(normalizedGuess), [normalizedGuess]);

  // ✅ Per-tile used state (handles duplicates correctly)
  const usedTiles = useMemo(() => {
    const usedSoFar = new Map<string, number>();
    const out: boolean[] = new Array(bankLetters.length).fill(false);

    for (let i = 0; i < bankLetters.length; i++) {
      const ch = bankLetters[i];
      const usedCount = guessCounts.get(ch) ?? 0;
      const seen = (usedSoFar.get(ch) ?? 0) + 1;
      usedSoFar.set(ch, seen);
      if (seen <= usedCount) out[i] = true;
    }

    return out;
  }, [bankLetters, guessCounts]);

  // ✅ build-safe: no Map.entries() iteration
  const fitsBank = useMemo(() => {
    let ok = true;
    guessCounts.forEach((n, ch) => {
      if ((bankCounts.get(ch) ?? 0) < n) ok = false;
    });
    return ok;
  }, [guessCounts, bankCounts]);

  const totalPoints = useMemo(
    () => results.reduce((sum, r) => sum + (r.valid ? r.points : 0), 0),
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
  }, [isSubmitting, normalizedGuess.length, dailyWord.length, fitsBank]);

  const submitDisabled =
    isSubmitting ||
    normalizedGuess.length < 4 ||
    normalizedGuess.length > dailyWord.length ||
    !fitsBank;

  // ----- Streaks (completion-based) -----
  const [streak, setStreak] = useState<StreakState>({
    current: 0,
    best: 0,
    lastCompleted: null,
  });

  // ----- History -----
  const [history, setHistory] = useState<DaySummary[]>([]);

  // ----- Copy/share -----
  const [copyStatus, setCopyStatus] = useState<null | "ok" | "fail">(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  function clearGuess() {
    setGuess("");
    setError(null);
    focusInput();
  }

  function removeLastChar() {
    setGuess((prev) => prev.slice(0, -1));
    focusInput();
  }

  function canUseLetter(ch: string) {
    const total = bankCounts.get(ch) ?? 0;
    const used = guessCounts.get(ch) ?? 0;
    return used < total;
  }

  function appendLetter(ch: string) {
    if (!canUseLetter(ch)) return;
    setGuess((prev) => (prev + ch).toLowerCase());
    focusInput();
  }

  // Load completion/streak/history/results on mount
  useEffect(() => {
    // completion flag (for CURRENT game day)
    try {
      const raw = localStorage.getItem(completedKey);
      if (raw === "1") setCompletedToday(true);
    } catch {}

    // streak
    try {
      const raw = localStorage.getItem(STREAK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StreakState>;
        if (typeof parsed.current === "number" && typeof parsed.best === "number") {
          setStreak({
            current: parsed.current ?? 0,
            best: parsed.best ?? 0,
            lastCompleted: parsed.lastCompleted ?? null,
          });
        }
      }
    } catch {}

    // history
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch {}

    // results (for CURRENT game day)
    try {
      const raw = localStorage.getItem(resultsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setResults(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist streak
  useEffect(() => {
    try {
      localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
    } catch {}
  }, [streak]);

  // Persist completion flag
  useEffect(() => {
    try {
      if (completedToday) localStorage.setItem(completedKey, "1");
      else localStorage.removeItem(completedKey);
    } catch {}
  }, [completedToday, completedKey]);

  // Persist results (for CURRENT game day)
  useEffect(() => {
    try {
      localStorage.setItem(resultsStorageKey, JSON.stringify(results));
    } catch {}
  }, [results, resultsStorageKey]);

  // Persist history
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {}
  }, [history]);

  function recordCompletionIfNeeded() {
    setStreak((prev) => {
      const last = prev.lastCompleted;
      const today = todayKey;
      if (last === today) return prev;

      const yKey = yesterdayKeyFromGameDayKey(todayKey);
      const nextCurrent = last === yKey ? prev.current + 1 : 1;
      const nextBest = Math.max(prev.best, nextCurrent);
      return { current: nextCurrent, best: nextBest, lastCompleted: today };
    });
  }

  function upsertHistoryForToday(completedOverride?: boolean) {
    const completed = completedOverride ?? completedToday;
    const summary: DaySummary = {
      key: todayKey,
      totalPoints,
      validCount,
      totalGuesses: results.length,
      completed,
    };

    setHistory((prev) => {
      const next = prev.filter((d) => d.key !== todayKey);
      next.unshift(summary);
      return next.slice(0, 7);
    });
  }

  // Keep history updated when score/guesses change
  useEffect(() => {
    upsertHistoryForToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPoints, validCount, results.length, completedToday, todayKey]);

  // If results already imply goal reached (e.g., after refresh), ensure completion is set
  useEffect(() => {
    if (!completedToday && totalPoints >= DAILY_GOAL_POINTS) {
      setCompletedToday(true);
      recordCompletionIfNeeded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPoints, todayKey]);

  // ---- Share text ----
  function buildShareText() {
    const goalMark = completedToday ? "✅" : "❌";
    const url =
      typeof window !== "undefined" ? window.location.origin : "https://your-site.com";

    return [
      `Words in Words — ${todayKey}`,
      `Score: ${totalPoints} / ${DAILY_GOAL_POINTS} ${goalMark}`,
      `Valid: ${validCount} / ${results.length}`,
      `Streak: 🔥${streak.current} (Best ${streak.best})`,
      "",
      `Play: ${url}`,
    ].join("\n");
  }

  async function copyResults() {
    const text = buildShareText();

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("ok");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "true");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopyStatus("ok");
      } catch {
        setCopyStatus("fail");
      }
    }

    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopyStatus(null), 1800);
  }

  async function handleSubmit(wordOverride?: string) {
    const trimmed = (wordOverride ?? guess).trim().toLowerCase();
    if (!trimmed) return;

    setError(null);

    if (results.some((r) => r.word === trimmed)) {
      clearGuess();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guess: trimmed,
          dailyWord,
        }),
      });

      const data: { valid?: boolean; reason?: string } = await res.json();

      const valid = !!data.valid;
      const points = valid ? getPointsForLength(trimmed.length) : 0;

      const nextTotal = totalPoints + points;

      setResults((prev) => [...prev, { word: trimmed, valid, points }]);

      if (!valid) setError(friendlyError(data.reason));

      // Completion trigger (once)
      if (!completedToday && nextTotal >= DAILY_GOAL_POINTS) {
        setCompletedToday(true);
        recordCompletionIfNeeded();
        upsertHistoryForToday(true);

        // gentle “pop” feedback
        setJustCompletedPulse(true);
        window.setTimeout(() => setJustCompletedPulse(false), 650);
      }

      clearGuess();
    } catch {
      setError("Something went wrong. Please try again.");
      focusInput();
    } finally {
      setIsSubmitting(false);
    }
  }

  const btnBase: React.CSSProperties = {
    padding: "0.62rem 0.95rem",
    fontSize: "1rem",
    borderRadius: 999,
    border: UI.border,
    background: "white",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
  };

  const btnGhost: React.CSSProperties = {
    ...btnBase,
    background: "rgba(255,255,255,0.65)",
  };

  const btnDisabled: React.CSSProperties = {
    opacity: 0.55,
    cursor: "not-allowed",
    boxShadow: "none",
  };

  const inputStyle: React.CSSProperties = {
    padding: "0.72rem 0.9rem",
    fontSize: "1.05rem",
    width: 340,
    borderRadius: 999,
    border: UI.border,
    outline: "none",
    background: "rgba(255,255,255,0.92)",
  };

  const tileStyle = (available: boolean): React.CSSProperties => ({
    width: 46,
    height: 46,
    borderRadius: UI.radiusSm,
    border: UI.border,
    background: available ? UI.tileBg : UI.tileUsedBg,
    cursor: available ? "pointer" : "not-allowed",
    fontSize: "1.1rem",
    fontWeight: 800,
    opacity: available ? 1 : 0.5,
    boxShadow: available ? "0 10px 22px rgba(0,0,0,0.07)" : "none",
    transition: "transform 120ms ease",
  });

  const goalProgress = Math.min(DAILY_GOAL_POINTS, totalPoints);
  const goalPct = Math.round((goalProgress / DAILY_GOAL_POINTS) * 100);

  // History helpers (GAME DAY aligned)
  const yesterday = useMemo(() => yesterdayKeyFromGameDayKey(todayKey), [todayKey]);
  const yesterdaySummary = useMemo(
    () => history.find((h) => h.key === yesterday) ?? null,
    [history, yesterday]
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: UI.bg,
        color: UI.text,
        padding: "2rem 1rem 3rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: UI.pageMax }}>
        {/* TOP RESET STRIP (single 8PM message) */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "1rem",
            fontSize: "0.95rem",
            color: UI.subtext,
          }}
        >
          New word every day at <b style={{ color: UI.text }}>8:00 PM local</b> • Next at{" "}
          <b style={{ color: UI.text }}>{nextAtText}</b> • in{" "}
          <b style={{ color: UI.text }}>{countdownText}</b>
        </div>

        <div
          style={{
            margin: "0 auto",
            maxWidth: UI.cardMax,
            background: UI.cardBg,
            border: UI.border,
            borderRadius: UI.radius,
            boxShadow: UI.softShadow,
            padding: "1.6rem 1.6rem 1.4rem",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
                Words in Words
              </div>

              <div style={{ marginTop: "0.25rem", color: UI.subtext }}>
                Today’s word:{" "}
                <span style={{ fontWeight: 800, color: UI.text }}>{dailyWord.toUpperCase()}</span>
              </div>

              {/* Daily goal */}
              <div style={{ marginTop: "0.75rem" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ color: UI.subtext }}>
                    <b style={{ color: UI.text }}>Today’s goal:</b> {goalProgress}/{DAILY_GOAL_POINTS} pts
                  </div>

                  {completedToday && (
                    <span
                      style={{
                        padding: "0.25rem 0.6rem",
                        borderRadius: 999,
                        border: UI.border,
                        background: "rgba(22,101,52,0.10)",
                        color: UI.ok,
                        fontWeight: 900,
                        transform: justCompletedPulse ? "scale(1.05)" : "scale(1)",
                        transition: "transform 180ms ease",
                      }}
                    >
                      ✅ Completed
                    </span>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "0.35rem",
                    height: 10,
                    borderRadius: 999,
                    border: UI.border,
                    background: "rgba(255,255,255,0.55)",
                    overflow: "hidden",
                    maxWidth: 360,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${goalPct}%`,
                      background: completedToday ? "rgba(22,101,52,0.55)" : "rgba(0,0,0,0.18)",
                      transition: "width 200ms ease",
                    }}
                  />
                </div>

                {/* Completion copy (no extra share button here) */}
                {completedToday && (
                  <div style={{ marginTop: "0.6rem", color: UI.ok, fontWeight: 900 }}>
                    Nice! You hit {DAILY_GOAL_POINTS}+ points today.
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign: "right", color: UI.subtext }}>
              <div style={{ fontWeight: 900, color: UI.text }}>
                🔥 {streak.current}{" "}
                <span style={{ fontWeight: 700, color: UI.subtext }}>streak</span>
              </div>
              <div style={{ fontSize: "0.95rem" }}>
                Best: <b style={{ color: UI.text }}>{streak.best}</b>
              </div>
              <div style={{ fontSize: "0.95rem", marginTop: "0.2rem" }}>
                <b style={{ color: UI.text }}>{totalPoints}</b> pts • {results.length} guesses
              </div>

              {/* Single share button */}
              <button
                onClick={copyResults}
                style={{
                  marginTop: "0.55rem",
                  padding: "0.45rem 0.75rem",
                  borderRadius: 999,
                  border: UI.border,
                  background: "rgba(255,255,255,0.75)",
                  cursor: "pointer",
                  fontWeight: 900,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                }}
              >
                📋 Share
              </button>

              {copyStatus === "ok" && (
                <div style={{ marginTop: "0.35rem", color: UI.ok, fontWeight: 900, fontSize: "0.95rem" }}>
                  Copied!
                </div>
              )}
              {copyStatus === "fail" && (
                <div style={{ marginTop: "0.35rem", color: UI.danger, fontWeight: 900, fontSize: "0.95rem" }}>
                  Couldn’t copy. Try again.
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div style={{ marginTop: "1.25rem" }}>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                ref={inputRef}
                value={guess}
                onChange={(e) => {
                  const cleaned = e.target.value.toLowerCase().replace(/[^a-z]/g, "");
                  setGuess(cleaned);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit(guess);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    clearGuess();
                  }
                }}
                placeholder="Type a word (or click letters below)"
                style={inputStyle}
                disabled={isSubmitting}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />

              <button
                onClick={() => handleSubmit(guess)}
                disabled={submitDisabled}
                style={{ ...btnBase, ...(submitDisabled ? btnDisabled : {}) }}
              >
                {isSubmitting ? "Checking…" : "Guess"}
              </button>

              <button
                onClick={removeLastChar}
                disabled={isSubmitting || guess.length === 0}
                style={{ ...btnGhost, ...((isSubmitting || guess.length === 0) ? btnDisabled : {}) }}
                title="Backspace"
              >
                Back
              </button>

              <button
                onClick={clearGuess}
                disabled={isSubmitting || guess.length === 0}
                style={{ ...btnGhost, ...((isSubmitting || guess.length === 0) ? btnDisabled : {}) }}
                title="Escape"
              >
                Clear
              </button>
            </div>

            {/* Live status row */}
            <div style={{ marginTop: "0.85rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ color: UI.subtext }}>
                <b style={{ color: UI.text }}>Length:</b> {normalizedGuess.length}/{dailyWord.length}
              </div>
              <div style={{ color: UI.subtext }}>
                <b style={{ color: UI.text }}>Uses letters:</b>{" "}
                <span style={{ color: normalizedGuess ? (fitsBank ? UI.ok : UI.danger) : UI.subtext }}>
                  {normalizedGuess ? (fitsBank ? "Valid" : "Too many") : "—"}
                </span>
              </div>
              <div style={{ color: UI.subtext }}>
                <b style={{ color: UI.text }}>Points:</b> {pointsPreview}
              </div>
            </div>

            {/* Errors */}
            {normalizedGuess.length > 0 && !fitsBank && (
              <div style={{ marginTop: "0.75rem", color: UI.danger, fontWeight: 800 }}>
                Uses letters not available in today’s word.
              </div>
            )}

            {error && (
              <div style={{ marginTop: "0.75rem", color: UI.danger, fontWeight: 800 }}>
                {error}
              </div>
            )}
          </div>

          {/* Letter bank */}
          <section style={{ marginTop: "1.35rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <div style={{ fontWeight: 900 }}>Letter bank</div>
              <div style={{ color: UI.subtext, fontSize: "0.95rem" }}>
                Click letters to add (typing is primary)
              </div>
            </div>

            <div style={{ marginTop: "0.65rem", display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
              {bankLetters.map((ch, i) => {
                const available = !usedTiles[i];
                return (
                  <button
                    key={`${ch}-${i}`}
                    onClick={() => appendLetter(ch)}
                    disabled={!available || isSubmitting}
                    style={tileStyle(available && !isSubmitting)}
                    aria-label={`Letter ${ch}${available ? "" : " used"}`}
                  >
                    {ch.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/* Usage counts */}
            <div style={{ marginTop: "0.75rem", color: UI.subtext, fontSize: "0.95rem" }}>
              {Array.from(bankCounts.keys())
                .sort((a, b) => a.localeCompare(b))
                .map((ch) => {
                  const total = bankCounts.get(ch) ?? 0;
                  const used = guessCounts.get(ch) ?? 0;
                  const over = used > total;
                  return (
                    <span
                      key={ch}
                      style={{
                        marginRight: "0.85rem",
                        color: over ? UI.danger : UI.subtext,
                        fontWeight: over ? 900 : 600,
                      }}
                    >
                      {ch.toUpperCase()}: {used}/{total}
                    </span>
                  );
                })}
            </div>
          </section>

          {/* Yesterday + History */}
          <section style={{ marginTop: "1.35rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
              <div style={{ fontWeight: 900 }}>History</div>
              <div style={{ color: UI.subtext, fontSize: "0.95rem" }}>Last 7 days</div>
            </div>

            <div style={{ marginTop: "0.6rem", display: "grid", gap: "0.6rem" }}>
              {/* Yesterday highlight */}
              <div
                style={{
                  border: UI.border,
                  borderRadius: UI.radiusSm,
                  background: "rgba(255,255,255,0.65)",
                  padding: "0.65rem 0.85rem",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: "0.2rem" }}>
                  Yesterday ({yesterday})
                </div>
                {yesterdaySummary ? (
                  <div style={{ color: UI.subtext }}>
                    Score <b style={{ color: UI.text }}>{yesterdaySummary.totalPoints}</b> •{" "}
                    {yesterdaySummary.completed ? (
                      <span style={{ color: UI.ok, fontWeight: 900 }}>✅ Completed</span>
                    ) : (
                      <span style={{ color: UI.danger, fontWeight: 900 }}>❌ Not completed</span>
                    )}{" "}
                    • Valid {yesterdaySummary.validCount}/{yesterdaySummary.totalGuesses}
                  </div>
                ) : (
                  <div style={{ color: UI.subtext }}>No data yet.</div>
                )}
              </div>

              {/* 7-day list */}
              <div
                style={{
                  border: UI.border,
                  borderRadius: UI.radiusSm,
                  background: "rgba(255,255,255,0.65)",
                  overflow: "hidden",
                }}
              >
                {history.length === 0 ? (
                  <div style={{ padding: "0.7rem 0.85rem", color: UI.subtext }}>
                    Play a few days and your history will appear here.
                  </div>
                ) : (
                  history.map((h, idx) => (
                    <div
                      key={h.key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                        padding: "0.7rem 0.85rem",
                        borderTop: idx === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900, color: UI.text }}>{h.key}</div>
                        <div style={{ color: UI.subtext, fontSize: "0.95rem" }}>
                          Valid {h.validCount}/{h.totalGuesses}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900, color: UI.text }}>{h.totalPoints} pts</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 900, color: h.completed ? UI.ok : UI.danger }}>
                          {h.completed ? "✅ Completed" : "❌ Not yet"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Results */}
          <section style={{ marginTop: "1.35rem" }}>
            <div style={{ fontWeight: 900, marginBottom: "0.5rem" }}>Guesses</div>

            {results.length === 0 ? (
              <div style={{ color: UI.subtext }}>No guesses yet. Try your first word!</div>
            ) : (
              <div
                style={{
                  border: UI.border,
                  borderRadius: UI.radiusSm,
                  background: "rgba(255,255,255,0.65)",
                  overflow: "hidden",
                }}
              >
                {results
                  .slice()
                  .reverse()
                  .map((r, idx) => (
                    <div
                      key={`${r.word}-${idx}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.7rem 0.85rem",
                        borderTop: idx === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 900, letterSpacing: "0.02em" }}>{r.word}</div>
                      {r.valid ? (
                        <div style={{ color: UI.ok, fontWeight: 900 }}>✓ +{r.points}</div>
                      ) : (
                        <div style={{ color: UI.danger, fontWeight: 900 }}>✗</div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
