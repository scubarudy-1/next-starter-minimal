import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import words from "an-array-of-english-words";

const OUT = path.join(process.cwd(), "src", "data", "dictionary.txt");

// Tune these:
const MIN_LEN = 4;
const MAX_LEN = 25;

const filtered = Array.from(
  new Set(
    words
      .map((w) => String(w).trim().toLowerCase())
      .filter(
        (w) => /^[a-z]+$/.test(w) && w.length >= MIN_LEN && w.length <= MAX_LEN
      )
  )
).sort();

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, filtered.join("\n") + "\n", "utf8");

console.log(`Wrote ${filtered.length} words to ${OUT}`);
