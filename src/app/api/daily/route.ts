import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export const runtime = "nodejs"; // IMPORTANT: allow fs

let POOL: string[] | null = null;

function getPool(): string[] {
  if (POOL) return POOL;

  try {
    const filePath = path.join(process.cwd(), "src", "data", "daily_pool.txt");
    const raw = readFileSync(filePath, "utf8");

    const words = raw
      .split(/\r?\n/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => /^[a-z]+$/.test(w) && w.length >= 4);

    POOL = words.length ? words : ["notebooks", "watermelon", "triangle"];
  } catch {
    // fallback so deploy never fails
    POOL = ["notebooks", "watermelon", "triangle"];
  }

  return POOL;
}

function hashKey(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = (searchParams.get("key") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const words = getPool();
  const word = words[hashKey(key) % words.length];

  return NextResponse.json({ key, word });
}
