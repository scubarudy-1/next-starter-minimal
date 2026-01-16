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
  for (const ch of s) m.set(ch, (m.get(ch) ?? 0) + 1);
  return m;
}

export default function Game({ dailyWord }: { dailyWord: string }) {
  const bankLetters = useMemo(() => dailyWord.toLowerCase().split(""), [dailyWord]);
  const bankCounts = useMemo(() => counts(dailyWord.toLowerCase()), [dailyWord]);

  const [guess, setGuess] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NEW: letter bank selection as indices into bankLetters (so duplicates are handled correctly)
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);

  const pickedWord = useMemo(
    () => pickedIndices.map((i) => bankLetters[i]).join(""),
    [pickedIndices, bankLetters]
  );

  const usedCounts = useMemo(() => counts(pickedWord), [pickedWord]);

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

  // Keep input text in sync with picked tiles, but still allow typing if you want.
  useEffect(() => {
    setGuess(pickedWord);
  }, [pickedWord]);

  function clearPick() {
    setPickedIndices([]);
  }

  function removeLastPick() {
    setPickedIndices((prev) => prev.slice(0, -1));
  }

  function canPickIndex(i: number) {
    // If already picked that exact tile index, it's not available.
    if (pickedIndices.includes(i)) return false;
    return true;
  }

  function pickIndex(i: number) {
    if (!canPickIndex(i)) return;
    setPickedIndices((prev) => [...prev, i]);
  }

  // Allow typing too, but we’ll reconcile it into pickedIndices only when pressing “Use Typed”
  // (Keeping it simple: typing is optional. If you want typing to fully drive indices,
  // we can map typed letters to available indices.)
  const [typedMode, setTypedMode] = useState(false);

  async function handleSubmit(wordOverride?: string) {
    const trimmed = (wordOverride ?? guess).trim().toLowerCase();
    if (!trimmed) return;

    setError(null);

    // No duplicate guesses
    const alreadyGuessed = results.some((r) => r.word === trimmed);
    if (alreadyGuessed) {
      setGuess("");
      clearPick();
      return;
    }

    setIsSubmitting(true);
try {
  const res = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guess: trimmed,
      dailyWord, // ✅ makes API validate against the same word UI shows
    }),
  });

  const data: { valid?: boolean; reason?: string } = await res.json();

  const valid = !!data.valid;
  const points = valid ? getPointsForLength(trimmed.length) : 0;

      setResults((prev) => [...prev, { word: trimmed, valid, points }]);

      if (!valid) setError(friendlyError(data.reason));

      setGuess("");
      clearPick();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Keyboard shortcuts for tile-built word
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // If user is typing in the input, don't hijack normal typing unless they want tile-mode only.
      // (We still allow Enter/Backspace to work when input is focused.)
      if (e.key === "Backspace") {
        // If there are picked tiles, backspace removes last picked tile
        if (pickedIndices.length > 0) {
          e.preventDefault();
          removeLastPick();
        }
      } else if (e.key === "Enter") {
        if (pickedWord.length > 0) {
          e.preventDefault();
          handleSubmit(pickedWord);
        }
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        // Optional: let single-letter keypress pick the first available matching tile
        const ch = e.key.toLowerCase();
        const idx = bankLetters.findIndex((l, i) => l === ch && !pickedIndices.includes(i));
        if (idx !== -1) {
          e.preventDefault();
          pickIndex(idx);
        }
      } else if (e.key === "Escape") {
        clearPick();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedIndices, pickedWord, bankLetters]);

  const isTileUsed = (i: number) => pickedIndices.includes(i);

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif", maxWidth: 720 }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Words in Words</h1>
      <p style={{ marginTop: 0 }}>
        Today’s word: <b>{dailyWord}</b>
      </p>

      {/* Guess / controls */}
      <div style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={guess}
            onChange={(e) => {
              setTypedMode(true);
              setGuess(e.target.value);
            }}
            placeholder="Click letters below (or type)"
            style={{
              padding: "0.6rem 0.75rem",
              fontSize: "1rem",
              width: "260px",
            }}
            disabled={isSubmitting}
          />

          <button
            onClick={() => handleSubmit(pickedWord || guess)}
            disabled={isSubmitting}
            style={{ padding: "0.6rem 0.9rem", fontSize: "1rem" }}
          >
            {isSubmitting ? "Checking..." : "Submit"}
          </button>

          <button
            onClick={removeLastPick}
            disabled={isSubmitting || pickedIndices.length === 0}
            style={{ padding: "0.6rem 0.9rem", fontSize: "1rem" }}
            title="Backspace"
          >
            Back
          </button>

          <button
            onClick={clearPick}
            disabled={isSubmitting || pickedIndices.length === 0}
            style={{ padding: "0.6rem 0.9rem", fontSize: "1rem" }}
            title="Escape"
          >
            Clear
          </button>
        </div>

        {error && <div style={{ marginTop: "0.75rem", color: "crimson" }}>{error}</div>}
      </div>

      {/* Letter Bank */}
      <section style={{ marginTop: "1.5rem" }}>
        <div style={{ marginBottom: "0.5rem" }}>
          <b>Letter bank</b>{" "}
          <span style={{ color: "#555" }}>
            (click tiles • type letters • Backspace removes • Enter submits • Esc clears)
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {bankLetters.map((ch, i) => {
            const used = isTileUsed(i);
            return (
              <button
                key={`${ch}-${i}`}
                onClick={() => pickIndex(i)}
                disabled={used || isSubmitting}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: used ? "#eee" : "white",
                  cursor: used ? "not-allowed" : "pointer",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  opacity: used ? 0.55 : 1,
                }}
                aria-label={`Letter ${ch}${used ? " used" : ""}`}
              >
                {ch.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* A small “picked word” preview (nice for clarity) */}
        <div style={{ marginTop: "0.75rem", color: "#333" }}>
          <b>Selected:</b>{" "}
          <span style={{ letterSpacing: "0.06em" }}>
            {pickedWord ? pickedWord.toUpperCase() : "—"}
          </span>
        </div>

        {/* Optional: show letter usage counts (helps debugging/feel-good UI) */}
        <div style={{ marginTop: "0.5rem", color: "#666", fontSize: "0.95rem" }}>
          {Array.from(bankCounts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([ch, total]) => {
              const used = usedCounts.get(ch) ?? 0;
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
