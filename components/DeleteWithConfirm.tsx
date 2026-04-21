"use client";

import { useState } from "react";

/**
 * Two-step delete button: first click expands into "Delete now" + "Cancel"
 * so users can't nuke a meeting in a single accidental click.
 */
export function DeleteWithConfirm({
  onConfirm,
  label = "Delete",
  compact = false,
}: {
  onConfirm: () => void | Promise<void>;
  label?: string;
  compact?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setWorking(true);
            try {
              await onConfirm();
            } finally {
              setWorking(false);
            }
          }}
          disabled={working}
          className="text-xs font-semibold text-red-500 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
        >
          {working ? "…" : "Delete now"}
        </button>
        <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(false);
          }}
          disabled={working}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirming(true);
      }}
      className={
        compact
          ? "text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
          : "text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
      }
    >
      {label}
    </button>
  );
}
