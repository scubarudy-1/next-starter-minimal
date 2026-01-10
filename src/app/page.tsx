"use client";

import { useState } from "react";

export default function Home() {
  const [guess, setGuess] = useState("");
  const [results, setResults] = useState<string[]>([]);

  const handleSubmit = async () => {
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guess }),
    });
    const data = await res.json();
    setResults([...results, `${guess} → ${data.valid ? "✅" : "❌"}`]);
    setGuess("");
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Words in Words</h1>
      <p>Daily Word: <strong>WATERMELON</strong></p>

      <input
        type="text"
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        placeholder="Type a word"
        style={{ padding: "0.5rem", width: "300px" }}
      />

      <button onClick={handleSubmit} style={{ marginLeft: "1rem", padding: "0.5rem" }}>
        Submit
      </button>

      <ul style={{ marginTop: "1rem" }}>
        {results.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </main>
  );
}
