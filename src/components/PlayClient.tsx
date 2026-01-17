// src/components/PlayClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Game from "@/app/game";

/* ---------- 8 PM LOCAL DAY KEY ---------- */
function gameDayKeyLocal8pm(now = new Date()) {
  const d = new Date(now);
  d.setHours(d.getHours() - 20);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nextRolloverLocal8pm(now = new Date()) {
  const d = new Date(now);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 0, 0, 0);
  if (d.getTime() >= next.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

export default function PlayClient() {
  const [dailyWord, setDailyWord] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const dayKey = useMemo(() => gameDayKeyLocal8pm(nowTick), [nowTick]);
  const lastLoadedKeyRef = useRef<string | null>(null);

  async function loadWord(forKey: string) {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/daily?key=${encodeURIComponent(forKey)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Daily API error (${res.status})`);
      const data: { word: string } = await res.json();
      setDailyWord(data.word);
      lastLoadedKeyRef.current = forKey;
    } catch {
      setErr("We couldn’t load today’s word.");
      setDailyWord("");
    } finally {
      setLoading(false);
    }
  }

  // Initial load + rollover
  useEffect(() => {
    if (lastLoadedKeyRef.current !== dayKey) {
      loadWord(dayKey);
    }
  }, [dayKey]);

  // Hard guarantee at rollover even if tab sleeps
  useEffect(() => {
    const next = nextRolloverLocal8pm(new Date());
    const ms = next.getTime() - Date.now() + 250;
    const t = window.setTimeout(() => {
      loadWord(gameDayKeyLocal8pm(new Date()));
    }, ms);
    return () => window.clearTimeout(t);
  }, [dayKey]);

  /* ---------- LOADING ---------- */
  if (loading && !dailyWord) {
    return (
      <main style={{ padding: "2rem", maxWidth: 760, margin: "0 auto" }}>
        <h1>Words in Words</h1>
        <p style={{ opacity: 0.75 }}>Loading today’s word…</p>
      </main>
    );
  }

  /* ---------- ERROR + RETRY ---------- */
  if (err && !dailyWord) {
    return (
      <main style={{ padding: "2rem", maxWidth: 760, margin: "0 auto" }}>
        <h1>Words in Words</h1>
        <p style={{ color: "#b91c1c", fontWeight: 600 }}>{err}</p>

        <button
          onClick={() => location.reload()}
          style={{
            marginTop: "1rem",
            padding: "0.6rem 1rem",
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Retry
        </button>
      </main>
    );
  }

  /* ---------- GAME ---------- */
  return (
    <>
      {/* FIRST-TIME PLAYER CLARITY */}
      <div
        style={{
          maxWidth: 760,
          margin: "1.25rem auto 0",
          padding: "0 1rem",
          textAlign: "center",
          color: "rgba(0,0,0,0.7)",
          fontSize: "0.95rem",
        }}
      >
        Make as many real words as you can using today’s word.
        <br />
        <strong>New word drops at 8 PM local time.</strong>
      </div>

      <Game dailyWord={dailyWord} />
    </>
  );
}
