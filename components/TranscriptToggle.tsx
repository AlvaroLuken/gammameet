"use client";
import { useState } from "react";

export function TranscriptToggle({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors cursor-pointer inline-flex items-center gap-1"
      >
        {open ? "▾" : "▸"} {open ? "Hide" : "Show"} raw transcript
      </button>
      {open && (
        <pre className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono">
          {text}
        </pre>
      )}
    </div>
  );
}
