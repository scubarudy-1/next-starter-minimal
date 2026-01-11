import { NextResponse } from "next/server";

import { getDailyWord } from "@/utils/dailyWord";

const dailyCount = countLetters(DAILY_WORD);

// Helper: count letters
function countLetters(word: string) {
  return word.split("").reduce((acc: Record<string, number>, letter) => {
    acc[letter] = (acc[letter] || 0) + 1;
    return acc;
  }, {});
}

// Validation rules
function isValidGuess(guess: string) {
  guess = guess.toLowerCase();

  // Reject if same as daily word
  if (guess === DAILY_WORD) return false;

  // Minimum 4 letters
  if (guess.length < 4) return false;

  // Must be alphabetical
  if (!/^[a-z]+$/.test(guess)) return false;

  // Letter count check
  const dailyCount = countLetters(DAILY_WORD);
  const guessCount = countLetters(guess);

  for (const letter in guessCount) {
    if (!dailyCount[letter] || guessCount[letter] > dailyCount[letter]) {
      return false;
    }
  }

  // NOTE: ENABLE dictionary check will come later
  // For now, just return true if it fits letters
  return true;
}

export async function POST(request: Request) {
  const { guess } = await request.json();
  const valid = isValidGuess(guess);
  return NextResponse.json({ valid });
}

