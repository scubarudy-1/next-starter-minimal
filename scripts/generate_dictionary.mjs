import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// We'll use wordfreq-like behavior via word list package? No.
// Instead: use word-list-english (ships as JSON), no filesystem paths.
import words from "word-list-english";

const OUT = path.join(process.cwd(), "src", "data", "dictionary.txt");

// Tune these:
const MIN_LEN = 4;
const MAX_LEN = 25;

// word-list-english exports an object with arrays by category.
// "english/10" is a great default coverage list.
const base = words["english/10"] ?? words["english"] ?? [];

const filtered = Array.from(
  new Set(
    base
      .map((w) => String(w).trim().toLowerCase())
      .filter((w) => /^[a-z]+$/.test(w) && w.length >= MIN_LEN && w.length <= MAX_LEN)
  )
).sort();

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, filtered.join("\n") + "\n", "utf8");

console.log(`Wrote ${filtered.length} words to ${OUT}`);
