import { readFileSync } from "fs";
import path from "path";

function utcDateString(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hashStringToInt(s: string) {
  // Simple deterministic hash (good enough for indexing)
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getDailyWord() {
  const poolPath = path.join(process.cwd(), "src", "data", "daily_pool.txt");
  const raw = readFileSync(poolPath, "utf8");

  const pool = raw
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]+$/.test(w) && w.length >= 8 && w.length <= 12);

  if (pool.length === 0) {
    throw new Error("daily_pool.txt has no valid words");
  }

  const today = utcDateString();
  const idx = hashStringToInt(today) % pool.length;

  return pool[idx];
}
