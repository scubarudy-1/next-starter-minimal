import { NextResponse } from "next/server";
import { getDailyWord } from "@/utils/dailyWord";

export async function GET() {
  return NextResponse.json({ word: getDailyWord().toUpperCase() });
}
