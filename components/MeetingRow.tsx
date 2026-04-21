"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  gamma_url: string | null;
  preview_image: string | null;
  recall_bot_id: string | null;
  transcript_error: boolean | null;
  bot_status: string | null;
  failure_reason: string | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type Classified = Meeting & {
  _upcoming?: boolean;
  _joining?: boolean;
  _inProgress?: boolean;
  _generating?: boolean;
  _failed?: boolean;
  _ready?: boolean;
};

export function MeetingRow({ meeting, onDeleted }: { meeting: Classified; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
    onDeleted(meeting.id);
  };

  const status = describeStatus(meeting);
  const clickable = meeting._ready;
  const rowClass = `group flex items-center gap-4 bg-white dark:bg-zinc-900 border ${status.borderClass} rounded-xl px-4 py-3 transition-colors ${
    clickable ? "hover:border-violet-400 dark:hover:border-violet-600 cursor-pointer" : ""
  }`;

  const Body = (
    <>
      {/* Thumbnail */}
      <div className={`relative w-20 h-12 shrink-0 rounded-md overflow-hidden ${status.thumbBg} flex items-center justify-center`}>
        {meeting._ready && meeting.preview_image ? (
          <Image src={meeting.preview_image} alt={meeting.title} fill sizes="80px" className="object-cover" />
        ) : (
          <span className={status.iconClass}>{status.icon}</span>
        )}
      </div>

      {/* Title + time */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{meeting.title}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {formatTime(meeting.start_time)} · <span className={status.labelClass}>{status.label}</span>
        </p>
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
      >
        {deleting ? "…" : "✕"}
      </button>
    </>
  );

  return clickable ? (
    <Link href={`/meetings/${meeting.id}`} className={rowClass}>{Body}</Link>
  ) : (
    <div className={rowClass}>{Body}</div>
  );
}

function describeStatus(m: Classified): {
  label: string;
  icon: string;
  iconClass: string;
  labelClass: string;
  thumbBg: string;
  borderClass: string;
} {
  if (m._ready) return {
    label: "Deck ready",
    icon: "✦",
    iconClass: "text-2xl opacity-20",
    labelClass: "text-violet-500",
    thumbBg: "bg-zinc-100 dark:bg-zinc-800",
    borderClass: "border-zinc-200 dark:border-zinc-800",
  };
  if (m._upcoming) return {
    label: "Scheduled",
    icon: "📅",
    iconClass: "text-xl opacity-40",
    labelClass: "text-zinc-400",
    thumbBg: "bg-zinc-100 dark:bg-zinc-800",
    borderClass: "border-zinc-200 dark:border-zinc-800",
  };
  if (m._joining) return {
    label: "Jim is joining",
    icon: "…",
    iconClass: "text-lg text-zinc-400",
    labelClass: "text-zinc-500 dark:text-zinc-400",
    thumbBg: "bg-zinc-100 dark:bg-zinc-800",
    borderClass: "border-zinc-200 dark:border-zinc-800",
  };
  if (m._inProgress) return {
    label: "Meeting in progress",
    icon: "●",
    iconClass: "text-emerald-500 text-lg animate-pulse",
    labelClass: "text-emerald-600 dark:text-emerald-400",
    thumbBg: "bg-emerald-50 dark:bg-emerald-950/20",
    borderClass: "border-emerald-200 dark:border-emerald-900/60",
  };
  if (m._generating) return {
    label: "Generating deck",
    icon: "○",
    iconClass: "text-violet-500 text-lg animate-pulse",
    labelClass: "text-violet-500",
    thumbBg: "bg-zinc-100 dark:bg-zinc-800",
    borderClass: "border-zinc-200 dark:border-zinc-800",
  };
  if (m._failed) return {
    label: "Generation failed",
    icon: "✕",
    iconClass: "text-lg text-red-400 opacity-60",
    labelClass: "text-red-500 dark:text-red-400",
    thumbBg: "bg-red-50 dark:bg-red-950/20",
    borderClass: "border-red-200 dark:border-red-900/60",
  };
  return {
    label: "",
    icon: "",
    iconClass: "",
    labelClass: "",
    thumbBg: "bg-zinc-100 dark:bg-zinc-800",
    borderClass: "border-zinc-200 dark:border-zinc-800",
  };
}
