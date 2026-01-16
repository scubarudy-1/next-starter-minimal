import { readFile, writeFile } from "fs/promises";
import path from "path";

async function run() {
  const dictPath = path.join(process.cwd(), "src/data/dictionary.txt");
  const outPath = path.join(process.cwd(), "src/data/daily_pool.txt");

  const raw = await readFile(dictPath, "utf8");

  const words = raw
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]+$/.test(w))
    .filter((w) => w.length >= 8 && w.length <= 11) // sweet spot
    .filter((w) => {
      // must have some letter variety
      const unique = new Set(w.split(""));
      return unique.size >= 6;
    });

  // Optional: shuffle
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }

  // Take first N (tune this)
  const FINAL = words.slice(0, 2000);

  await writeFile(outPath, FINAL.join("\n"), "utf8");

  console.log(`Wrote ${FINAL.length} daily pool words.`);
}

run();
