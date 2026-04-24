"use client";
import { useState } from "react";

function letterAvatar(str: string) {
  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-pink-500", "bg-orange-500"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return { color: colors[Math.abs(hash) % colors.length], letter: str[0].toUpperCase() };
}

export function AttendeeRow({ email }: { email: string }) {
  const { color, letter } = letterAvatar(email);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="group flex items-center gap-2.5 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg">
      <span className={`w-7 h-7 shrink-0 rounded-full ${color} text-white text-xs flex items-center justify-center font-bold`}>
        {letter}
      </span>
      <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate flex-1">{email}</span>
      <button
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy email"}
        className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
      >
        {copied ? (
          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
