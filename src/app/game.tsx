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

function getPointsForLength(len: number) {
  if (len < 4) return 0;
  if (len === 4) return 1;
  if (len === 5) return 2;
  if (len === 6) return 3;
  return 5;
}

function storageKeyForToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `wordsinwords:${yyyy}-${mm}-${dd}:results`;
}

function counts(s: string) {
  const m = new Map<string, number>();
  for (const ch of s) {
    if (!/^[a-z]$/.test(ch)) continue;
    m.set(ch, (m.get(ch) ?? 0) + 1);
  }
  return m;
}

/** Local “day key” (matches your results storage behavior) */
function localDayKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function yesterdayKey(todayKey: string) {
  const [y, m, d] = todayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return localDayKey(dt);
}

const STREAK_KEY = "wordsinwords:streak:v1";
type StreakState = { current: number; best: number; lastPlayed: string | null };

export default function Game({ dailyWord }: { dailyWord: string }) {
  // ---------- “Metazooa clean” style knobs (tweak here) ----------
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

  const inputRef = useRef<HTMLInputElement | null>(null);

  function focusInput() {
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  useEffect(() => {
    focusInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedGuess = useMemo(() => guess.trim().toLowerCase(), [guess]);
  const guessCounts = useMemo(() => counts(normalizedGuess), [normalizedGuess]);

  // ✅ build-safe: no Map.entries() iteration
  const fitsBank = useMemo(() => {
    let ok = true;
    guessCounts.forEach((n, ch) => {
      if ((bankCounts.get(ch) ?? 0) < n) ok = false;
    });
    return ok;
  }, [guessCounts, bankCounts]);

  const submitDisabled =
    isSubmitting ||
    normalizedGuess.length < 4 ||
    normalizedGuess.length > dailyWord.length ||
    !fitsBank;

  const pointsPreview = useMemo(() => {
    if (submitDisabled) return 0;
    return getPointsForLength(normalizedGuess.length);
  }, [submitDisabled, normalizedGuess.length]);

  const totalPoints = useMemo(
    () => results.reduce((sum, r) => sum + (r.valid ? r.points : 0), 0),
    [results]
  );

  // ----- Streaks -----
  const todayKey = useMemo(() => localDayKey(), []);
  const [streak, setStreak] = useState<StreakState>({
    current: 0,
    best: 0,
    lastPlayed: null,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STREAK_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StreakState;
      if (parsed && typeof parsed.current === "number" && typeof parsed.best === "number") {
        setStreak({
          current: parsed.current ?? 0,
          best: parsed.best ?? 0,
          lastPlayed: parsed.lastPlayed ?? null,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
    } catch {
      // ignore
    }
  }, [streak]);

  function recordPlayIfNeeded() {
    setStreak((prev) => {
      const last = prev.lastPlayed;
      const today = todayKey;

      if (last === today) return prev; // already counted today

      const yKey = yesterdayKey(today);
      const nextCurrent = last === yKey ? prev.current + 1 : 1;
      const nextBest = Math.max(prev.best, nextCurrent);

      return { current: nextCurrent, best: nextBest, lastPlayed: today };
    });
  }

  // Load saved results
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKeyForToday());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setResults(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  // Save results
  useEffect(() => {
    try {
      localStorage.setItem(storageKeyForToday(), JSON.stringify(results));
    } catch {
      /* ignore */
    }
  }, [results]);

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

  async function handleSubmit(wordOverride?: string) {
    const trimmed = (wordOverride ?? guess).trim().toLowerCase();
    if (!trimmed) return;

    setError(null);

    // ✅ streak counts when you submit at least one guess today (valid or invalid)
    recordPlayIfNeeded();

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
          dailyWord, // keeps API validation aligned with UI word
        }),
      });

      const data: { valid?: boolean; reason?: string } = await res.json();

      const valid = !!data.valid;
      const points = valid ? getPointsForLength(trimmed.length) : 0;

      setResults((prev) => [...prev, { word: trimmed, valid, points }]);

      if (!valid) setError(friendlyError(data.reason));

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
  });

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
            </div>

            <div style={{ textAlign: "right", color: UI.subtext }}>
              <div style={{ fontWeight: 900, color: UI.text }}>
                🔥 {streak.current} <span style={{ fontWeight: 700, color: UI.subtext }}>streak</span>
              </div>
              <div style={{ fontSize: "0.95rem" }}>
                Best: <b style={{ color: UI.text }}>{streak.best}</b>
              </div>
              <div style={{ fontSize: "0.95rem", marginTop: "0.2rem" }}>
                <b style={{ color: UI.text }}>{totalPoints}</b> pts • {results.length} guesses
              </div>
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
                <b style={{ color: UI.text }}>Length:</b>{" "}
                {normalizedGuess.length}/{dailyWord.length}
              </div>
              <div style={{ color: UI.subtext }}>
                <b style={{ color: UI.text }}>Fits bank:</b>{" "}
                <span style={{ color: normalizedGuess ? (fitsBank ? UI.ok : UI.danger) : UI.subtext }}>
                  {normalizedGuess ? (fitsBank ? "Yes" : "No") : "—"}
                </span>
              </div>
              <div style={{ color: UI.subtext }}>
                <b style={{ color: UI.text }}>Points:</b> {pointsPreview}
              </div>
            </div>

            {/* Errors */}
            {normalizedGuess.length > 0 && !fitsBank && (
              <div style={{ marginTop: "0.75rem", color: UI.danger, fontWeight: 700 }}>
                Uses letters not available in today’s word.
              </div>
            )}

            {error && (
              <div style={{ marginTop: "0.75rem", color: UI.danger, fontWeight: 700 }}>
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
                const available = canUseLetter(ch);
                return (
                  <button
                    key={`${ch}-${i}`}
                    onClick={() => appendLetter(ch)}
                    disabled={!available || isSubmitting}
                    style={tileStyle(available && !isSubmitting)}
                    aria-label={`Letter ${ch}${available ? "" : " unavailable"}`}
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
                        fontWeight: over ? 800 : 600,
                      }}
                    >
                      {ch.toUpperCase()}: {used}/{total}
                    </span>
                  );
                })}
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
                      <div style={{ fontWeight: 800, letterSpacing: "0.02em" }}>{r.word}</div>
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
