// src/app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl py-10 sm:py-14">
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Words in Words
        </h1>
        <p className="mt-4 text-lg opacity-80">
          Make as many real words as you can using today’s word.
        </p>
        <p className="mt-1 opacity-70">
          New word drops at <span className="font-semibold">8 PM</span> local time.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">How it works</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 opacity-90">
          <li>You get one big word each day.</li>
          <li>Use its letters to form words (letters can’t be overused).</li>
          <li>Words must be valid (4+ letters), and you can’t repeat guesses.</li>
          <li>Longer words score more points. Build a streak over time.</li>
        </ol>
      </div>

      <div className="mt-10 flex justify-center">
        <Link href="/play">
          <button className="rounded-full px-6 py-3 font-bold border shadow-sm hover:shadow transition">
            Enter Words in Words →
          </button>
        </Link>
      </div>
    </main>
  );
}
