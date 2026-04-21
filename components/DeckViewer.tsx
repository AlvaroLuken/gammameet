"use client";

import { useState } from "react";

// Gamma decks are currently generated with numCards: 8
const SLIDE_COUNT = 8;

export function DeckViewer({ exportUrl }: { exportUrl: string }) {
  const [page, setPage] = useState(1);
  const src = `${exportUrl}#page=${page}&toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=Fit`;

  return (
    <div className="flex gap-3 h-full">
      {/* Slide rail */}
      <div className="hidden md:flex flex-col gap-1.5 w-14 shrink-0 overflow-y-auto py-1">
        {Array.from({ length: SLIDE_COUNT }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => setPage(n)}
            className={`shrink-0 aspect-video rounded-md border text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${
              page === n
                ? "bg-violet-600 border-violet-600 text-white"
                : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-violet-400 dark:hover:border-violet-600"
            }`}
            title={`Slide ${n}`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Main deck */}
      <div className="flex-1 min-w-0">
        <iframe
          src={src}
          className="w-full rounded-xl border-0"
          style={{ height: "min(calc(100vh - 120px), 80vw)" }}
          title="Deck"
        />
      </div>
    </div>
  );
}
