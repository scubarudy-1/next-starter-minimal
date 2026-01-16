"use client";

import { useEffect, useMemo, useState } from "react";

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
  // 4 = 1, 5 = 2, 6 = 3, 7+ = 5
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

export default function Game({ dailyWord }: { dailyWord: string }) {
  const bankLetters = useMemo(() => dailyWord.toLowerCase().split(""), [dailyWord]);
  const bankCounts = useMemo(() => counts(dailyWord.toLowerCase()), [dailyWord]);

  const [guess, setGuess] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedGuess = useMemo(() => guess.trim().toLowerCase(), [guess]);
  const guessCounts = useMemo(() => counts(normalizedGuess), [normalizedGuess]);

  // Derived: does the typed word fit in the letter bank?
  const fitsBank = useMemo(() => {
    for (const [ch, n] of guessCounts.entries()) {
      if ((bankCounts.get(ch) ?? 0) < n) return false;
    }
    return true;
  }, [guessCounts, bankCounts]);

  const totalPoints = useMemo(
    () => results.reduce((sum, r) => sum + (r.valid ? r.points : 0), 0),
    [results]
  );

  // Load saved results
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKeyForToday());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setResults(parsed);
    } catch {
      // ignore
    }
  }, []);

  // Save results
  useEffect(() => {
    try {
      localStorage.setItem(storageKeyForToday(), JSON.stringify(results));
    } catch {
      // ignore
    }
  }, [results]);

  function clearGuess() {
    setGuess("");
  }

  function canUseLetter(ch: string) {
    const total = bankCounts.get(ch) ?? 0;
    const used = guessCounts.get(ch) ?? 0;
    return used < total;
  }

  function appendLetter(ch: string) {
    if (!canUseLetter(ch)) return;
    setGuess((prev) => (prev + ch).toLowerCase());
  }

  function removeLastChar() {
    setGuess((prev) => prev.slice(0, -1));
  }

  async function handleSubmit(wordOverride?: string) {
    const trimmed = (wordOverride ?? guess).trim().toLowerCase();
    if (!trimmed) return;

    setError(null);

    // No duplicate guesses
    const alreadyGuessed = results.some((r) => r.word === trimmed);
    if (alreadyGuessed) {
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
          dailyWord, // critical: keeps server validation aligned with UI word
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
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitDisabled =
    isSubmitting ||
    normalizedGuess.length === 0 ||
    normalizedGuess.length < 4 ||
    normalizedGuess.length > dailyWord.length ||
    !/^[a-z]+$/.test(normalizedGuess) ||
    !fitsBank;

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif", maxWidth: 820 }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Words in Words</h1>
      <p style={{ marginTop: 0 }}>
        Today’s word: <b>{dailyWord}</b>
      </p>

      {/* Guess / controls */}
      <div style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
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
            style={{
              padding: "0.6rem 0.75rem",
              fontSize: "1rem",
              width: "300px",
            }}
            disabled={isSubmitting}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />

          <button
            onClick={() => handleSubmit(guess)}
            disabled={submitDisabled}
            style={{ padding: "0.6rem 0.9rem", fontSize: "1rem" }}
          >
            {isSubmitting ? "Checking..." : "Submit"}
          </button>

          <button
            onClick={removeLastChar}
            disabled={isSubmitting || guess.length === 0}
            style={{ padding: "0.6rem 0.9rem", fontSize: "1rem" }}
            title="Backspace"
          >
            Back
          </button>

          <button
            onClick={clearGuess}
            disabled={isSubmitting || guess.length === 0}
            style={{ padding: "0.6rem 0.9rem", fontSize: "1rem" }}
            title="Escape"
          >
            Clear
          </button>
        </div>

        {/* Live “bank fit” feedback (Metazooa-ish) */}
        {normalizedGuess.length > 0 && !fitsBank && (
          <div style={{ marginTop: "0.5rem", color: "crimson" }}>
            Uses letters not available in today’s word.
          </div>
        )}

        {error && <div style={{ marginTop: "0.75rem", color: "crimson" }}>{error}</div>}
      </div>

      {/* Letter Bank */}
      <section style={{ marginTop: "1.5rem" }}>
        <div style={{ marginBottom: "0.5rem" }}>
          <b>Letter bank</b>{" "}
          <span style={{ color: "#555" }}>(click letters to add • typing is primary)</span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {bankLetters.map((ch, i) => {
            const available = canUseLetter(ch);

            return (
              <button
                key={`${ch}-${i}`}
                onClick={() => appendLetter(ch)}
                disabled={!available || isSubmitting}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: available ? "white" : "#eee",
                  cursor: available ? "pointer" : "not-allowed",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  opacity: available ? 1 : 0.55,
                }}
                aria-label={`Letter ${ch}${available ? "" : " unavailable"}`}
              >
                {ch.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Letter usage counts */}
        <div style={{ marginTop: "0.6rem", color: "#666", fontSize: "0.95rem" }}>
          {Array.from(bankCounts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([ch, total]) => {
              const used = guessCounts.get(ch) ?? 0;
              return (
                <span key={ch} style={{ marginRight: "0.75rem" }}>
                  {ch.toUpperCase()}: {used}/{total}
                </span>
              );
            })}
        </div>
      </section>

      {/* Score + results */}
      <div style={{ marginTop: "1.5rem" }}>
        <div style={{ marginBottom: "0.5rem" }}>
          <b>Total points:</b> {totalPoints}
        </div>

        <div style={{ marginBottom: "0.35rem" }}>
          <b>Guesses ({results.length}):</b>
        </div>

        <ul style={{ paddingLeft: "1.25rem", marginTop: 0 }}>
          {results.map((r) => (
            <li key={r.word} style={{ marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 600 }}>{r.word}</span>{" "}
              {r.valid ? (
                <span style={{ color: "green" }}>✓ +{r.points}</span>
              ) : (
                <span style={{ color: "crimson" }}>✗</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
