import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getDailyWord } from "../../../utils/dailyWord";

// --- letter counting ---
function countLetters(word: string) {
  return word.split("").reduce((acc: Record<string, number>, ch) => {
    acc[ch] = (acc[ch] || 0) + 1;
    return acc;
  }, {});
}

// --- dictionary loading (cached) ---
let WORDS: Set<string> | null = null;

async function getWordsSet(): Promise<Set<string>> {
  if (WORDS) return WORDS;

  // NOTE: adjust path if your enable.txt is NOT under src/data
  const filePath = path.join(process.cwd(), "src", "data", "enable.txt");
  const raw = await readFile(filePath, "utf8");

  const words = raw
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]+$/.test(w) && w.length >= 4 && w.length <= 7);

  WORDS = new Set(words);
  return WORDS;
}

function passesPluralRule(guess: string, dict: Set<string>) {
  // Plurals allowed only if singular exists
  if (guess.endsWith("s") && guess.length > 4) {
    const singular = guess.slice(0, -1);
    return dict.has(singular);
  }
  return true;
}

function lettersFit(guess: string, dailyWord: string) {
  const dailyCount = countLetters(dailyWord);
  const guessCount = countLetters(guess);

  for (const ch in guessCount) {
    if (!dailyCount[ch] || guessCount[ch] > dailyCount[ch]) return false;
  }
  return true;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const guessRaw = String(body.guess ?? "");
  const guess = guessRaw.trim().toLowerCase();

  const dailyWord = getDailyWord().toLowerCase();

  // Basic checks
  if (!guess) return NextResponse.json({ valid: false, reason: "empty" });
  if (!/^[a-z]+$/.test(guess))
    return NextResponse.json({ valid: false, reason: "nonalpha" });
  if (guess.length < 4 || guess.length > 7)
    return NextResponse.json({ valid: false, reason: "length" });
  if (guess === dailyWord)
    return NextResponse.json({ valid: false, reason: "daily_word_disallowed" });
  if (!lettersFit(guess, dailyWord))
    return NextResponse.json({ valid: false, reason: "letters_dont_fit" });

  // Dictionary checks
  const dict = await getWordsSet();
  if (!dict.has(guess))
    return NextResponse.json({ valid: false, reason: "not_in_dictionary" });
  if (!passesPluralRule(guess, dict))
    return NextResponse.json({
      valid: false,
      reason: "plural_requires_singular",
    });

  return NextResponse.json({ valid: true });
}

