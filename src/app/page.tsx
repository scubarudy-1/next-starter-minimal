"use client";

import { useState } from "react";

export default function Home() {
  const [guess, setGuess] = useState("");
  const [results, setResults] = useState<{ word: string; valid: boolean }[]>(
    []
  );

  const handleSubmit = async () => {
    const trimmed = guess.trim().toLowerCase();

    // No empty submits
    if (!trimmed) return;

    // No duplicate guesses (case-insensitive)
    const alreadyGuessed = results.some((r) => r.word === trimmed);
    if (alreadyGuessed) {
      setGuess("");
      return;
    }

    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guess: trimmed }),
    });

    const data = await res.json();

    setResults((prev) => [...prev, { word: trimmed, valid: !!data.valid }]);
    setGuess("");
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Words in Words</h1>
      <p><em>version: DUPES-v1</em></p>
      <p>
        Daily Word: <strong>WATERMELON</strong>
      </p>

      <input
        type="text"
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        placeholder="Type a word"
        style={{ padding: "0.5rem", width: "300px" }}
      />

      <button
        onClick={handleSubmit}
        style={{ marginLeft: "1rem", padding: "0.5rem" }}
      >
        Submit
      </button>

      <ul style={{ marginTop: "1rem" }}>
        {results.map((r, i) => (
          <li key={i}>
            {r.word} → {r.valid ? "✅" : "❌"}
          </li>
        ))}
      </ul>
    </main>
  );
}

