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

  // Fallback safety
  POOL = words.length ? words : ["notebooks", "watermelon", "triangle"];
  return POOL;
}

function dayKeyUTC() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getDailyWord() {
  const key = dayKeyUTC();
  const words = getPool();

  // Deterministic hash from the date string
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;

  return words[hash % words.length];
}

export function getDailyKey() {
  return dayKeyUTC();
}
