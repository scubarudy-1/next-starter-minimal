"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Game from "./game"; // adjust if your Game path differs

function gameDayKeyLocal8pm(now = new Date()) {
  const d = new Date(now);
  d.setHours(d.getHours() - 20); // 8 PM rollover
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

export default function Page() {
  const [dailyWord, setDailyWord] = useState<string>("");
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
      const data: { key: string; word: string } = await res.json();
      setDailyWord(String(data.word || ""));
      lastLoadedKeyRef.current = forKey;
    } catch (e) {
      setErr("Couldn’t load today’s word. Please refresh.");
      setDailyWord("");
    } finally {
      setLoading(false);
    }
  }

  // Load on mount + whenever the key changes (8 PM rollover)
  useEffect(() => {
    if (lastLoadedKeyRef.current === dayKey) return;
    loadWord(dayKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey]);

  // Optional: if you want an extra “hard guarantee” at 8 PM even if the tab was sleeping
  useEffect(() => {
    const next = nextRolloverLocal8pm(new Date());
    const ms = next.getTime() - Date.now() + 250; // slight buffer
    const t = window.setTimeout(() => {
      // forces a reload right at rollover
      loadWord(gameDayKeyLocal8pm(new Date()));
    }, ms);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey]);

  if (loading && !dailyWord) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>Loading today’s word…</div>
          <div style={{ marginTop: "0.5rem", opacity: 0.7 }}>Key: {dayKey}</div>
        </div>
      </main>
    );
  }

  if (err && !dailyWord) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#b91c1c" }}>{err}</div>
          <div style={{ marginTop: "0.5rem", opacity: 0.7 }}>Key: {dayKey}</div>
        </div>
      </main>
    );
  }

  return <Game dailyWord={dailyWord} />;
}
