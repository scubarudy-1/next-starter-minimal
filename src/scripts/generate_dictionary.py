#!/usr/bin/env python3
from pathlib import Path
import re
import sys

try:
    from wordfreq import top_n_list
except ImportError:
    print("Missing dependency: wordfreq. Run: pip install wordfreq", file=sys.stderr)
    raise

OUT_PATH = Path("src/data/dictionary.txt")

# Tune these:
N = 100000          # try 50_000 or 100_000
MIN_LEN = 4
MAX_LEN = 25        # optional sanity cap (prevents crazy long tokens)
WORDLIST = "large"  # "best" is stricter; "large" is more permissive

alpha = re.compile(r"^[a-z]+$")

def main():
    words = top_n_list("en", N, wordlist=WORDLIST)

    cleaned = []
    seen = set()

    for w in words:
        w = w.strip().lower()
        if w in seen:
            continue
        seen.add(w)

        if not alpha.match(w):
            continue
        if len(w) < MIN_LEN or len(w) > MAX_LEN:
            continue

        cleaned.append(w)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text("\n".join(cleaned) + "\n", encoding="utf-8")

    print(f"Wrote {len(cleaned):,} words to {OUT_PATH}")
    print("Sample:", cleaned[:20])

if __name__ == "__main__":
    main()
