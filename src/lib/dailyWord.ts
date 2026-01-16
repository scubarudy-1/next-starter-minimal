// src/lib/dailyWord.ts
const WORDS = [
  "notebooks",
  "watermelon",
  "triangle",
  // ...
];

function dayKeyUTC() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getDailyWord() {
  const key = dayKeyUTC();

  // Simple deterministic hash from the date string
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;

  return WORDS[hash % WORDS.length];
}

export function getDailyKey() {
  return dayKeyUTC();
}
