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

  // ✅ FIXED: no Map.entries(), safe for Vercel
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
    normalizedGuess.length < 4 ||
    normalizedGuess.length > dailyWord.length ||
    !/^[a-z]+$/.test(normalizedGuess) ||
    !fitsBank;

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif", maxWidth: 820 }}>
      <h1>Words in Words</h1>
      <p>
        Today’s word: <b>{dailyWord}</b>
      </p>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit(guess);
            if (e.key === "Escape") clearGuess();
          }}
          placeholder="Type a word (or click letters)"
          disabled={isSubmitting}
        />

        <button onClick={() => handleSubmit(guess)} disabled={submitDisabled}>
          {isSubmitting ? "Checking…" : "Submit"}
        </button>

        <button onClick={removeLastChar} disabled={!guess}>
          Back
        </button>

        <button onClick={clearGuess} disabled={!guess}>
          Clear
        </button>
      </div>

      {normalizedGuess && !fitsBank && (
        <div style={{ color: "crimson", marginTop: "0.5rem" }}>
          Uses letters not available in today’s word.
        </div>
      )}

      {error && <div style={{ color: "crimson" }}>{error}</div>}

      <section style={{ marginTop: "1.5rem" }}>
        <b>Letter bank</b>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {bankLetters.map((ch, i) => {
            const available = canUseLetter(ch);
            return (
              <button
                key={`${ch}-${i}`}
                onClick={() => appendLetter(ch)}
                disabled={!available || isSubmitting}
                style={{ opacity: available ? 1 : 0.4 }}
              >
                {ch.toUpperCase()}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <b>Total points:</b> {totalPoints}
        <ul>
          {results.map((r) => (
            <li key={r.word}>
              {r.word} {r.valid ? `✓ +${r.points}` : "✗"}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
