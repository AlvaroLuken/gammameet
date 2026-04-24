"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { dateTint } from "@/lib/dateTint";
import { SourceBadge, sourceOf } from "@/components/SourceBadge";

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  gamma_url: string | null;
  preview_image: string | null;
  recall_bot_id: string | null;
  meet_link: string | null;
  transcript_error: boolean | null;
  bot_status: string | null;
  failure_reason: string | null;
  dismissed_at: string | null;
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
  _botDisabled?: boolean;
  _hidden?: boolean;
};

export function MeetingRow({ meeting, onChange }: { meeting: Classified; onChange: () => void | Promise<void> }) {
  const handleDelete = async () => {
    await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
    await onChange();
  };
  const handleCancelBot = async () => {
    await fetch(`/api/meetings/${meeting.id}/cancel-bot`, { method: "POST" });
    await onChange();
  };
  const handleEnableBot = async () => {
    await fetch(`/api/meetings/${meeting.id}/enable-bot`, { method: "POST" });
    await onChange();
  };
  const handleUnhide = async () => {
    await fetch(`/api/meetings/${meeting.id}/unhide`, { method: "POST" });
    await onChange();
  };

  const status = describeStatus(meeting);
  const clickable = !!meeting._ready;
  const tint = meeting._ready ? dateTint(meeting.start_time) : null;
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
        {tint && (
          <div
            className="absolute inset-0 pointer-events-none mix-blend-color opacity-70 group-hover:opacity-50 transition-opacity duration-300"
            style={{ backgroundImage: tint }}
          />
        )}
      </div>

      {/* Title + time */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate flex-1 min-w-0">{meeting.title}</p>
          <SourceBadge source={sourceOf(meeting)} variant="inline" />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          {formatTime(meeting.start_time)} · <span className={status.labelClass}>{status.label}</span>
        </p>
      </div>

      {/* 3-dot menu with state-aware actions */}
      <RowMenu
        meetingId={meeting.id}
        isReady={clickable}
        isHidden={!!meeting._hidden}
        isUpcoming={!!meeting._upcoming}
        isBotDisabled={!!meeting._botDisabled}
        onDelete={handleDelete}
        onCancelBot={handleCancelBot}
        onEnableBot={handleEnableBot}
        onUnhide={handleUnhide}
      />
    </>
  );

  return clickable ? (
    <Link href={`/meetings/${meeting.id}`} className={rowClass}>{Body}</Link>
  ) : (
    <div className={rowClass}>{Body}</div>
  );
}

function RowMenu({
  meetingId,
  isReady,
  isHidden,
  isUpcoming,
  isBotDisabled,
  onDelete,
  onCancelBot,
  onEnableBot,
  onUnhide,
}: {
  meetingId: string;
  isReady: boolean;
  isHidden: boolean;
  isUpcoming: boolean;
  isBotDisabled: boolean;
  onDelete: () => Promise<void>;
  onCancelBot: () => Promise<void>;
  onEnableBot: () => Promise<void>;
  onUnhide: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const runAction = (fn: () => Promise<void>) => async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    await fn();
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    await onDelete();
  };

  return (
    <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.preventDefault()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
          setConfirming(false);
        }}
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 divide-y divide-zinc-100 dark:divide-zinc-800">
          {isHidden && (
            <button onClick={runAction(onUnhide)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-violet-600 dark:text-violet-400 font-medium hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors cursor-pointer">
              <span>↩</span> Recover meeting
            </button>
          )}
          {isReady && !isHidden && (
            <Link
              href={`/meetings/${meetingId}`}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-violet-500">↗</span> View Deck
            </Link>
          )}
          {isUpcoming && !isHidden && (
            <button onClick={runAction(onCancelBot)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
              <span>🔕</span> Cancel bot
            </button>
          )}
          {isBotDisabled && !isHidden && (
            <button onClick={runAction(onEnableBot)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-violet-600 dark:text-violet-400 font-medium hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors cursor-pointer">
              <span>🔔</span> Enable bot
            </button>
          )}
          {!isHidden && (
            <>
              {confirming ? (
                <div className="flex gap-1.5 p-2">
                  <button
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className="flex-1 text-xs bg-red-600 hover:bg-red-500 text-white font-medium py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {deleting ? "…" : "Confirm"}
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(false); }}
                    className="flex-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                >
                  <span>✕</span> Hide
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
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
  if (m._hidden) return {
    label: "Hidden",
    icon: "👁",
    iconClass: "text-lg opacity-20",
    labelClass: "text-zinc-400",
    thumbBg: "bg-zinc-100 dark:bg-zinc-800",
    borderClass: "border-zinc-200 dark:border-zinc-800",
  };
  if (m._botDisabled) return {
    label: "Bot cancelled",
    icon: "🔕",
    iconClass: "text-lg opacity-30",
    labelClass: "text-zinc-400",
    thumbBg: "bg-zinc-100 dark:bg-zinc-800",
    borderClass: "border-zinc-200 dark:border-zinc-800",
  };
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
