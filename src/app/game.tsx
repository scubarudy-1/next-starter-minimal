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
  // Scoring rules:
  // 4 = 1, 5 = 2, 6 = 3, 7+ = 5
  if (len < 4) return 0;
  if (len === 4) return 1;
  if (len === 5) return 2;
  if (len === 6) return 3;
  return 5; // 7 and above
}

function normalizeGuess(s: string) {
  return s.trim().toLowerCase();
}

function storageKey(dailyWord: string) {
  return `words-in-words:v1:${dailyWord.toLowerCase()}`;
}

export default function Game({ dailyWord }: { dailyWord: string }) {
  const [guess, setGuess] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const totalScore = useMemo(
    () => results.reduce((sum, r) => sum + (r.valid ? r.points : 0), 0),
    [results]
  );

  const validWords = useMemo(() => results.filter((r) => r.valid), [results]);
  const invalidWords = useMemo(() => results.filter((r) => !r.valid), [results]);

  useEffect(() => {
    const key = storageKey(dailyWord);
    const raw = localStorage.getItem(key);
    if (!raw) {
      setResults([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { results: Result[] };
      if (Array.isArray(parsed?.results)) setResults(parsed.results);
      else setResults([]);
    } catch {
      setResults([]);
    }
  }, [dailyWord]);

  useEffect(() => {
    const key = storageKey(dailyWord);
    localStorage.setItem(key, JSON.stringify({ results }));
  }, [dailyWord, results]);

  const handleSubmit = async () => {
    setError(null);

    const trimmed = normalizeGuess(guess);
    if (!trimmed) return;

    if (trimmed.length < 4) {
      setError("Words must be at least 4 letters.");
      return;
    }
    if (trimmed.length > dailyWord.length) {
      setError("That word is longer than today’s word.");
      return;
    }

    const alreadyGuessed = results.some((r) => r.word === trimmed);
    if (alreadyGuessed) {
      setGuess("");
      return;
    }

    setIsChecking(true);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess: trimmed, dailyWord }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        valid?: boolean;
        reason?: string;
      };

      if (!res.ok) {
        setError(friendlyError(data.reason ?? "server_error"));
        return;
      }

      const isValid = !!data.valid;

      if (!isValid) {
        setError(friendlyError(data.reason));
      }

      const points = isValid ? getPointsForLength(trimmed.length) : 0;

      setResults((prev) => [...prev, { word: trimmed, valid: isValid, points }]);
      setGuess("");
    } catch {
      setError("Network error checking word.");
    } finally {
      setIsChecking(false);
    }
  };

  const resetToday = () => {
    setResults([]);
    setGuess("");
    setError(null);
    localStorage.removeItem(storageKey(dailyWord));
  };

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "Arial, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Words in Words</h1>
          <p style={{ margin: "0.25rem 0 0", opacity: 0.8 }}>
            Today’s word:{" "}
            <strong style={{ letterSpacing: 1 }}>{dailyWord.toUpperCase()}</strong>
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>
            {totalScore}
          </div>
          <div style={{ opacity: 0.8, marginTop: 2 }}>score</div>
        </div>
      </header>

      <section style={{ marginTop: "1.5rem" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Enter a word (4+ letters)"
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontSize: "1rem",
            }}
            disabled={isChecking}
            autoFocus
            inputMode="text"
            enterKeyHint="send"
          />

          <button
            type="submit"
            disabled={isChecking}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "white",
              cursor: isChecking ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {isChecking ? "Checking..." : "Submit"}
          </button>

          <button
            type="button"
            onClick={resetToday}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
            title="Clears your guesses for today"
          >
            Reset
          </button>
        </form>
      </section>

      {error && <p style={{ marginTop: "0.75rem", color: "crimson" }}>{error}</p>}

      <section
        style={{
          marginTop: "1.5rem",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
        }}
      >
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: "1rem" }}>
          <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Valid ({validWords.length})
          </h2>

          {validWords.length === 0 ? (
            <p style={{ opacity: 0.7, margin: 0 }}>No valid words yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {validWords
                .slice()
                .sort((a, b) => b.points - a.points || a.word.localeCompare(b.word))
                .map((r) => (
                  <li key={r.word} style={{ marginBottom: 6 }}>
                    <strong>{r.word}</strong>{" "}
                    <span style={{ opacity: 0.8 }}>
                      ({r.word.length} letters · +{r.points})
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: "1rem" }}>
          <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            Invalid ({invalidWords.length})
          </h2>

          {invalidWords.length === 0 ? (
            <p style={{ opacity: 0.7, margin: 0 }}>No invalid guesses.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {invalidWords.map((r) => (
                <li key={r.word} style={{ marginBottom: 6 }}>
                  {r.word}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer style={{ marginTop: "1.5rem", opacity: 0.75 }}>
        <p style={{ margin: 0 }}>
          Scoring: 4 letters = 1, 5 = 2, 6 = 3, 7+ = 5.
        </p>
      </footer>
    </main>
  );
}
