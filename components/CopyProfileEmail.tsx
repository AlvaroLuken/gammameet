"use client";
import { useState } from "react";

interface Props {
  text?: string;
  label?: string;
}

export function CopyProfileEmail({ text = "fred@fireflies.ai", label = "Copy address" }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 text-sm font-medium bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900 px-4 py-2 rounded-xl transition-colors cursor-pointer"
    >
      {copied ? "✓ Copied!" : label}
    </button>
  );
}
