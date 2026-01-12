import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "src", "data", "dictionary.txt");

// Tune these:
const MIN_LEN = 4;
const MAX_LEN = 25;

// Read the JSON file from the installed package instead of importing it
const jsonPath = path.join(
  process.cwd(),
  "node_modules",
  "an-array-of-english-words",
  "index.json"
);

const raw = await readFile(jsonPath, "utf8");
const words = JSON.parse(raw);

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
