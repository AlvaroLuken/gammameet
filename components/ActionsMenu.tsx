"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  gammaUrl: string | null;
  exportUrl: string | null;
}

export function ActionsMenu({ id, gammaUrl, exportUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1800);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  };

  return (
    <div ref={menuRef} className="relative mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
      <button
        onClick={() => { setOpen((o) => !o); setConfirming(false); }}
        className="w-full inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
      >
        Actions
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
          {gammaUrl && (
            <a
              href={gammaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="text-violet-500">↗</span>
              Open in Gamma
            </a>
          )}
          {exportUrl && (
            <a
              href={exportUrl}
              download
              className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800"
            >
              <span>↓</span>
              Download PDF
            </a>
          )}
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800 cursor-pointer"
          >
            <span>{copied ? "✓" : "⎘"}</span>
            {copied ? "Link copied!" : "Copy share link"}
          </button>

          <div className="border-t border-zinc-100 dark:border-zinc-800">
            {confirming ? (
              <div className="flex gap-2 p-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 inline-flex items-center justify-center bg-red-600 hover:bg-red-500 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="inline-flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <span>✕</span>
                Delete deck
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
