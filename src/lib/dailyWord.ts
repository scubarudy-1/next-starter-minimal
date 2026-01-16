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
 */
function dayKeyLocal8pm() {
  const now = new Date();

  // If it's before 8pm, treat it as "yesterday"
  if (now.getHours() < 20) {
    now.setDate(now.getDate() - 1);
  }

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

export function getDailyWord() {
  const key = dayKeyLocal8pm();
  const words = getPool();

  // Deterministic hash from the adjusted date key
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  return words[hash % words.length];
}

export function getDailyKey() {
  return dayKeyLocal8pm();
}
