"use client";
import { useState } from "react";

export function CopyShareButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/share/${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="inline-flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
    >
      {copied ? "✓ Link copied!" : "Share link"}
    </button>
  );
}
