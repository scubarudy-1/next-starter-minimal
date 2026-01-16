// src/lib/dailyWord.ts
import { readFileSync } from "fs";
import path from "path";

let POOL: string[] | null = null;

function getPool(): string[] {
  if (POOL) return POOL;

  const filePath = path.join(process.cwd(), "src", "data", "daily_pool.txt");
  const raw = readFileSync(filePath, "utf8");

  const words = raw
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]+$/.test(w) && w.length >= 4);

  POOL = words.length ? words : ["notebooks", "watermelon", "triangle"];
  return POOL;
}

/**
 * Returns a YYYY-MM-DD key where the "day" rolls over at 8:00 PM LOCAL time.
 * Implementation matches client logic: shift time back 20 hours.
 */
function dayKeyLocal8pm(now = new Date()) {
  const d = new Date(now);
  d.setHours(d.getHours() - 20); // 8 PM rollover
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getDailyWord(now = new Date()) {
  const key = dayKeyLocal8pm(now);
  const words = getPool();

  // Deterministic hash from the adjusted date key
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  return words[hash % words.length];
}

export function getDailyKey(now = new Date()) {
  return dayKeyLocal8pm(now)
