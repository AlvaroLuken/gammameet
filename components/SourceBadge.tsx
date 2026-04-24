export type MeetingSource = "meeting" | "recording";

export function sourceOf(m: { recall_bot_id: string | null; meet_link?: string | null }): MeetingSource {
  return !m.recall_bot_id && !m.meet_link ? "recording" : "meeting";
}

/**
 * Small pill indicating whether a card was captured via a meeting bot or
 * an ambient browser recording. Intended for absolute positioning over the
 * card thumbnail.
 */
export function SourceBadge({ source, variant = "thumbnail" }: { source: MeetingSource; variant?: "thumbnail" | "inline" }) {
  const isRecording = source === "recording";
  const label = isRecording ? "Recording" : "Meeting";
  const bg = isRecording
    ? "bg-red-500/90 text-white"
    : "bg-white/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200";
  const ring = variant === "thumbnail" ? "shadow-sm" : "";

  const Icon = isRecording ? (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none" />
    </svg>
  ) : (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );

  return (
    <span className={`inline-flex items-center gap-1 ${bg} ${ring} text-[10px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-sm`}>
      {Icon}
      {label}
    </span>
  );
}
