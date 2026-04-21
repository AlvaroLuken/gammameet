"use client";

import { DeckViewer } from "./DeckViewer";
import { useMeetingRegen } from "./MeetingRegenContext";

export function DeckWithRegenOverlay({ exportUrl }: { exportUrl: string }) {
  const { regenerating } = useMeetingRegen();

  return (
    <div className="relative">
      <DeckViewer exportUrl={exportUrl} />
      {regenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/85 dark:bg-black/75 backdrop-blur-sm rounded-xl z-20">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <div className="w-10 h-10 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Regenerating your deck…</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">
              Usually 30-90 seconds. The page will refresh automatically when it's ready.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
