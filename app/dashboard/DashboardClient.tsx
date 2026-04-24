"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MeetingRow } from "@/components/MeetingRow";
import { DeleteWithConfirm } from "@/components/DeleteWithConfirm";
import { dateTint } from "@/lib/dateTint";

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  gamma_url: string | null;
  export_url: string | null;
  preview_image: string | null;
  recall_bot_id: string | null;
  transcript_error: boolean | null;
  bot_status: string | null;
  failure_reason: string | null;
  dismissed_at: string | null;
  meeting_invites?: { email: string }[];
}

const FAILURE_COPY: Record<string, string> = {
  not_admitted: "Jim wasn't admitted to the meeting",
  bot_fatal: "The notetaker bot hit an error",
  transcript_failed: "Transcript couldn't be generated",
  timeout: "No recording received in time",
  no_attendees: "No one joined the meeting",
  empty_transcript: "Not enough conversation to summarize",
};
// Failures where retry has a chance of working
const RETRYABLE = new Set(["transcript_failed", "timeout"]);

interface User {
  name: string;
  email: string;
  image: string | null;
}

type DateFilter = "all" | "week" | "month";

function letterAvatar(str: string) {
  const colors = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500",
    "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-pink-500", "bg-orange-500",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return { color: colors[Math.abs(hash) % colors.length], letter: str[0].toUpperCase() };
}

function groupByDate(meetings: Meeting[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const map = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const d = new Date(m.start_time);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries()).map(([key, ms]) => {
    const t = new Date(key).getTime();
    let label: string;
    if (t === today) label = "Today";
    else if (t === yesterday) label = "Yesterday";
    else label = new Date(key).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    return { label, meetings: ms };
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function durationMins(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  return mins > 0 && mins < 600 ? mins : null;
}

async function fetchMeetings(): Promise<Meeting[]> {
  try {
    const r = await fetch("/api/meetings");
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900 px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0"
    >
      {copied ? "✓ Copied!" : label}
    </button>
  );
}

export default function DashboardClient({ user }: { user: User }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [attendeeFilter, setAttendeeFilter] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  const [showFailed, setShowFailed] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Load view preference from localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("gm-view-mode") : null;
    if (saved === "grid" || saved === "list") setViewMode(saved);
  }, []);

  const changeViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    if (typeof window !== "undefined") window.localStorage.setItem("gm-view-mode", mode);
  };

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((p) => {
        setShowUpcoming(p.showUpcoming ?? false);
        setShowProcessing(p.showProcessing ?? false);
        setShowFailed(p.showFailed ?? false);
        setShowHidden(p.showHidden ?? false);
      })
      .catch(() => {});
  }, []);

  const refresh = async () => {
    const data = await fetchMeetings();
    setMeetings(data);
  };

  useEffect(() => {
    // Include bot_status + dismissed_at so live state transitions trigger a re-render.
    const hash = (data: Meeting[]) =>
      data
        .map((m) => `${m.id}:${m.gamma_url ?? ""}:${m.transcript_error ? "1" : "0"}:${m.bot_status ?? ""}:${m.dismissed_at ?? ""}`)
        .join("|");
    let prev = "";

    const poll = async () => {
      const data = await fetchMeetings();
      const next = hash(data);
      if (next !== prev) {
        setMeetings(data);
        prev = next;
      } else {
        setMeetings((prev) => [...prev]);
      }
    };

    fetchMeetings().then((data) => {
      setMeetings(data);
      prev = hash(data);
      setLoading(false);
    });
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile sidebar when clicking outside
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [sidebarOpen]);

  // Classify each meeting.
  // Truth source: bot_status (updated by Recall webhooks). Time-based checks are fallbacks.
  const now = Date.now();
  const classified = meetings.map((m) => {
    const startMs = new Date(m.start_time).getTime();
    const endMs = m.end_time ? new Date(m.end_time).getTime() : startMs + 10 * 60 * 1000;
    const status = m.bot_status ?? "scheduled";

    const isReady = !!m.gamma_url;
    const botFailed = status === "failed" || !!m.transcript_error;
    const hasBot = !!m.recall_bot_id;
    const isHidden = !!m.dismissed_at;
    const isBotDisabled = !isReady && !botFailed && status === "disabled";

    // Bot-status is the only reliable signal for "generating" — a scheduled
    // end time tells us nothing because meetings run over. We only switch to
    // "generating" once Recall tells us the bot actually left the call ("ended")
    // OR our pipeline has started processing the transcript ("processing").
    const isGenerating =
      !isReady && !botFailed && hasBot && (status === "ended" || status === "processing");

    // In progress: bot confirmed recording, OR we're past start_time with a
    // bot scheduled and webhook hasn't caught up yet. Stays "in progress"
    // indefinitely — never auto-flipped to "generating" by time alone.
    const isInProgress =
      !isReady && !botFailed && hasBot && !isGenerating && (status === "recording" || now >= startMs);

    // Bot hasn't reached "recording" yet
    const botEverJoined = status === "recording" || status === "ended";

    // Before meeting start, not yet joining (treat "claiming" same as scheduled — transient state during bot creation)
    const isUpcoming =
      !isReady && !botFailed && !isBotDisabled && !botEverJoined && startMs > now && (status === "scheduled" || status === "claiming");

    // Bot is en route (joining, in waiting room) before meeting or at its start
    const isJoining = !isReady && !botFailed && status === "joining";

    // After meeting end window passed + bot never joined → no-show
    const noShowCutoff = endMs + 10 * 60 * 1000;
    const isNoShow = !isReady && !botFailed && !botEverJoined && !isJoining && now > noShowCutoff;

    // Stale catch-all: very old meetings with no resolution
    const isStale = !isReady && !botFailed && now > endMs + 90 * 60 * 1000;

    const isFailed = botFailed || isStale || isNoShow;

    return {
      ...m,
      _upcoming: isUpcoming,
      _joining: isJoining,
      _inProgress: isInProgress,
      _generating: isGenerating,
      _failed: isFailed,
      _ready: isReady,
      _botDisabled: isBotDisabled,
      _hidden: isHidden,
    };
  });

  // Apply status filter first. Hidden meetings are excluded unless showHidden is on.
  const statusFiltered = classified.filter((m) => {
    if (m._hidden && !showHidden) return false;
    if (m._ready) return true;
    if ((m._upcoming || m._joining || m._botDisabled) && showUpcoming) return true;
    if ((m._inProgress || m._generating) && showProcessing) return true;
    if (m._failed && showFailed) return true;
    return false;
  });

  // Then apply search/date/attendee filters
  let filtered = statusFiltered;
  if (query.trim()) {
    filtered = filtered.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()));
  }
  if (dateFilter !== "all") {
    const cutoff = Date.now() - (dateFilter === "week" ? 7 : 30) * 86400000;
    filtered = filtered.filter((m) => new Date(m.start_time).getTime() >= cutoff);
  }
  if (attendeeFilter.size > 0) {
    filtered = filtered.filter((m) =>
      m.meeting_invites?.some((i) => attendeeFilter.has(i.email))
    );
  }

  const groups = groupByDate(filtered);
  // Only show attendees from meetings currently visible under the status filter
  const allAttendees = Array.from(
    new Set(statusFiltered.flatMap((m) => m.meeting_invites?.map((i) => i.email) ?? []))
  ).sort();
  const hasActiveFilters = dateFilter !== "all" || attendeeFilter.size > 0 || !!query.trim();

  const toggleAttendee = (email: string) => {
    setAttendeeFilter((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  const clearFilters = () => {
    setQuery("");
    setDateFilter("all");
    setAttendeeFilter(new Set());
  };

  const { color, letter } = letterAvatar(user.name || user.email);

  const sidebar = (
    <aside
      ref={sidebarRef}
      className={`
        w-[85vw] max-w-sm md:w-72 md:max-w-none shrink-0 border-r border-zinc-200 dark:border-zinc-800
        flex flex-col overflow-y-auto bg-zinc-50 dark:bg-black
        fixed md:static inset-y-0 left-0 z-[60] md:z-40 transition-transform duration-300
        ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}
      `}
    >
      {/* Mobile-only header row (close + title) — desktop uses normal px/py */}
      <div className="md:hidden flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-zinc-50 dark:bg-black z-10">
        <button
          onClick={() => setSidebarOpen(false)}
          className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Close filters"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-900 dark:text-white">Filters</span>
        <span className="w-9" aria-hidden />
      </div>

      {/* Content padding — desktop gets normal spacing, mobile inherits from header above */}
      <div className="flex flex-col gap-6 px-4 py-6 md:py-6">

      {/* Search */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">Search</p>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search decks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Date filter */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">Date</p>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "week", "month"] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
                dateFilter === f
                  ? "bg-violet-600 text-white"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-violet-400 dark:hover:border-violet-600"
              }`}
            >
              {f === "all" ? "All time" : f === "week" ? "This week" : "This month"}
            </button>
          ))}
        </div>
      </div>

      {/* Attendee filter */}
      {allAttendees.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">Attendees</p>
          <div className="flex flex-col gap-1">
            {allAttendees.map((email) => (
              <AttendeeFilterRow
                key={email}
                email={email}
                checked={attendeeFilter.has(email)}
                onToggle={() => toggleAttendee(email)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="text-xs text-zinc-400 hover:text-red-400 transition-colors text-left px-1 cursor-pointer"
        >
          ✕ Clear all filters
        </button>
      )}
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors flex flex-col">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 md:px-8 py-4 flex items-center justify-between shrink-0 relative z-50">
        <div className="flex items-center gap-3">
          {/* Mobile filter toggle */}
          <button
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 12h12M9 17h6" />
            </svg>
          </button>
          <Link href="/dashboard" className="text-xl md:text-2xl font-bold hover:opacity-80 transition-opacity">
            Gamma<span className="text-violet-500">Meet</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/record"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-full transition-colors cursor-pointer"
          >
            ● Record
          </Link>
          <Link
            href="/add-bot"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-full transition-colors cursor-pointer"
          >
            + Add bot
          </Link>
          <ThemeToggle />
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 pl-2 pr-3 md:pr-4 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            {user.image ? (
              <Image src={user.image} alt={user.name} width={24} height={24} className="rounded-full" />
            ) : (
              <span className={`w-6 h-6 rounded-full ${color} text-white text-xs flex items-center justify-center font-bold`}>{letter}</span>
            )}
            <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {sidebar}

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8 md:py-10">
          <div className="max-w-4xl space-y-10">
            {loading ? (
              <div className="space-y-10">
                {[0, 1].map((g) => (
                  <div key={g} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
                      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                          <div className="w-full aspect-video bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                          <div className="p-4 space-y-2">
                            <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse w-3/4" />
                            <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              hasActiveFilters ? (
                <div className="text-center py-20 space-y-4">
                  <p className="text-zinc-500 text-lg">No decks match your filters.</p>
                  <button onClick={clearFilters} className="text-sm text-violet-500 hover:text-violet-400 transition-colors cursor-pointer">
                    Clear filters
                  </button>
                </div>
              ) : (
                /* Onboarding empty state */
                <div className="max-w-lg mx-auto py-12 space-y-6">
                  <div className="text-center space-y-2">
                    <p className="text-2xl font-bold">Welcome to GammaMeet</p>
                    <p className="text-zinc-500 text-sm">Your next Meet call will appear here as it happens.</p>
                  </div>

                  {/* Live listening banner */}
                  <div className="bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/40 dark:to-zinc-900 border border-violet-200 dark:border-violet-900/60 rounded-2xl p-5 flex items-start gap-4">
                    <span className="relative flex items-center justify-center mt-1 shrink-0">
                      <span className="absolute w-2.5 h-2.5 rounded-full bg-violet-500 animate-ping opacity-60" />
                      <span className="relative w-2.5 h-2.5 rounded-full bg-violet-500" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">Listening for your next meeting</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        We're watching your Google Calendar. Any meeting with a Meet or Zoom link will show up here the moment it's added — and a deck will generate after it ends.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                    {/* Step 1 */}
                    <div className="flex items-start gap-4 p-5">
                      <span className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 text-sm flex items-center justify-center shrink-0 font-bold mt-0.5">✓</span>
                      <div>
                        <p className="font-semibold text-sm">Sign in with Google</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">Your Google Calendar is connected.</p>
                      </div>
                    </div>
                    {/* Step 2 */}
                    <div className="flex items-start gap-4 p-5">
                      <span className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 text-sm flex items-center justify-center shrink-0 font-bold mt-0.5">2</span>
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold text-sm">Admit Jim when he knocks</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Jim from GammaMeet</span> joins each call 2 minutes before it starts. Need it for a meeting happening right now? Use <Link href="/add-bot" className="text-violet-500 hover:underline font-medium">+ Add bot</Link>.
                        </p>
                      </div>
                    </div>
                    {/* Step 3 */}
                    <div className="flex items-start gap-4 p-5 opacity-50">
                      <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm flex items-center justify-center shrink-0 font-bold mt-0.5">3</span>
                      <div>
                        <p className="font-semibold text-sm">Your deck appears here</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">GammaMeet generates the deck and emails it to everyone on the call.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                    <Link href="/add-bot" className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors cursor-pointer">
                      + Add bot to a meeting now
                    </Link>
                    <Link href="/profile" className="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-violet-400 dark:hover:border-violet-600 text-zinc-700 dark:text-zinc-300 text-sm font-semibold px-5 py-2.5 rounded-full transition-colors cursor-pointer">
                      ⚙ Set your preferences
                    </Link>
                  </div>
                </div>
              )
            ) : (
              <>
                {/* Grid/List toggle — aligned top-right above the deck grid */}
                <div className="flex justify-end -mt-2 mb-2">
                  <div className="inline-flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-full p-0.5">
                    <button
                      onClick={() => changeViewMode("grid")}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                        viewMode === "grid"
                          ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
                      </svg>
                      Grid
                    </button>
                    <button
                      onClick={() => changeViewMode("list")}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                        viewMode === "list"
                          ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      List
                    </button>
                  </div>
                </div>
                {groups.map(({ label, meetings: ms }) => (
                  <div key={label} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                        {label}
                      </h2>
                      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                      <span className="text-xs text-zinc-400 dark:text-zinc-600">{ms.length} deck{ms.length !== 1 ? "s" : ""}</span>
                    </div>
                    {viewMode === "grid" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ms.map((m) => <MeetingCard key={m.id} meeting={m} onChange={refresh} />)}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {ms.map((m) => <MeetingRow key={m.id} meeting={m} onChange={refresh} />)}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function MeetingCard({ meeting, onChange }: { meeting: Meeting & { _upcoming?: boolean; _joining?: boolean; _inProgress?: boolean; _generating?: boolean; _failed?: boolean; _botDisabled?: boolean; _hidden?: boolean }; onChange: () => void | Promise<void> }) {
  const duration = meeting.end_time ? durationMins(meeting.start_time, meeting.end_time) : null;
  const [deleting, setDeleting] = useState(false);

  const isUpcoming = !!meeting._upcoming;
  const isJoining = !!meeting._joining;
  const isFailed = !!meeting._failed;
  const isInProgress = !!meeting._inProgress;
  const isGenerating = !!meeting._generating;
  const isBotDisabled = !!meeting._botDisabled;
  const isHidden = !!meeting._hidden;

  const handleConfirmedDelete = async () => {
    setDeleting(true);
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
  void deleting;

  // Hidden: user previously dismissed this meeting (only shown when showHidden is on)
  if (isHidden) {
    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden opacity-60 hover:opacity-100 transition-opacity">
        <div className="w-full aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <span className="text-3xl opacity-20">👁</span>
        </div>
        <div className="flex flex-col gap-1.5 p-4 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{meeting.title}</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">{formatTime(meeting.start_time)}</p>
          <div className="mt-auto pt-2 flex items-center justify-between">
            <span className="text-xs text-zinc-400">Hidden</span>
            <button onClick={(e) => { e.preventDefault(); handleUnhide(); }} className="text-xs font-semibold text-violet-500 hover:text-violet-400 transition-colors cursor-pointer">
              Recover meeting
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Bot disabled: user cancelled the bot but kept the meeting
  if (isBotDisabled) {
    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden opacity-80">
        <div className="w-full aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <span className="text-3xl opacity-20">🔕</span>
        </div>
        <div className="flex flex-col gap-1.5 p-4 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{meeting.title}</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">{formatTime(meeting.start_time)}</p>
          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            <button onClick={(e) => { e.preventDefault(); handleEnableBot(); }} className="text-xs font-semibold text-violet-500 hover:text-violet-400 transition-colors cursor-pointer">
              Enable bot
            </button>
            <DeleteWithConfirm onConfirm={handleConfirmedDelete} label="Hide" />
          </div>
        </div>
      </div>
    );
  }

  // Upcoming: bot scheduled, meeting hasn't started yet
  if (isUpcoming) {
    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden opacity-80">
        <div className="w-full aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <span className="text-3xl opacity-20">📅</span>
        </div>
        <div className="flex flex-col gap-1.5 p-4 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{meeting.title}</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">{formatTime(meeting.start_time)}</p>
          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-400">Scheduled · Bot ready</span>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.preventDefault(); handleCancelBot(); }} className="text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer">
                Cancel bot
              </button>
              <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
              <DeleteWithConfirm onConfirm={handleConfirmedDelete} label="Hide" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Joining: bot en route (joining_call, in waiting room, in call but not yet recording)
  if (isJoining) {
    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="w-full aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[pulse_1.4s_ease-in-out_infinite]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 p-4 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{meeting.title}</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">{formatTime(meeting.start_time)}</p>
          <div className="mt-auto pt-2 flex items-center justify-between">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Jim is joining — please admit</span>
            <DeleteWithConfirm onConfirm={handleConfirmedDelete} label="Remove" />
          </div>
        </div>
      </div>
    );
  }

  // In progress: meeting is currently happening
  if (isInProgress) {
    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl overflow-hidden">
        <div className="w-full aspect-video bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center">
          <span className="relative flex items-center justify-center">
            <span className="absolute w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-60" />
            <span className="relative w-3 h-3 rounded-full bg-emerald-500" />
          </span>
        </div>
        <div className="flex flex-col gap-1.5 p-4 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{meeting.title}</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">{formatTime(meeting.start_time)}</p>
          <div className="mt-auto pt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Meeting in progress</span>
            <DeleteWithConfirm onConfirm={handleConfirmedDelete} label="Remove" />
          </div>
        </div>
      </div>
    );
  }

  // Generating: meeting ended <10min ago, deck actively being generated
  if (isGenerating) {
    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="w-full aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="flex flex-col gap-1.5 p-4 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{meeting.title}</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">{formatTime(meeting.start_time)}</p>
          <div className="mt-auto pt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-violet-500">Generating deck · ~1 min</span>
            <DeleteWithConfirm onConfirm={handleConfirmedDelete} label="Delete" />
          </div>
        </div>
      </div>
    );
  }


  // Failed: transcript failed or timed out
  if (isFailed) {
    return <FailedCard meeting={meeting} onChange={onChange} />;
  }

  // Ready: deck generated
  return (
    <CardMenu id={meeting.id} title={meeting.title} startTime={meeting.start_time} previewImage={meeting.preview_image} duration={duration} tint={dateTint(meeting.start_time)} onChange={onChange} />
  );
}

function AttendeeFilterRow({ email, checked, onToggle }: { email: string; checked: boolean; onToggle: () => void }) {
  const { color, letter } = letterAvatar(email);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
        checked
          ? "bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
      }`}
    >
      <span className={`w-6 h-6 shrink-0 rounded-full ${color} text-white text-xs flex items-center justify-center font-bold`}>
        {letter}
      </span>
      <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate flex-1">{email}</span>
      <button
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy email"}
        className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
      {checked && (
        <svg className="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

function FailedCard({ meeting, onChange }: { meeting: Meeting & { failure_reason: string | null }; onChange: () => void | Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const reason = meeting.failure_reason ?? "";
  const reasonCopy = FAILURE_COPY[reason] ?? "Generation failed";
  const canRetry = RETRYABLE.has(reason) && !!meeting.recall_bot_id;

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
    await onChange();
  };

  const handleRetry = async () => {
    setRetryError(null);
    setRetrying(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/regenerate`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRetryError(body.error ?? "Retry failed");
      }
    } catch {
      setRetryError("Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/60 rounded-2xl overflow-hidden">
      <div className="w-full aspect-video bg-red-50 dark:bg-red-950/20 flex items-center justify-center">
        <span className="text-3xl opacity-30">✕</span>
      </div>
      <div className="flex flex-col gap-1.5 p-4 flex-1">
        <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{meeting.title}</p>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs">{formatTime(meeting.start_time)}</p>
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">{reasonCopy}</p>
        {retryError && <p className="text-xs text-zinc-400 mt-1">{retryError}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          {canRetry ? (
            <button onClick={handleRetry} disabled={retrying || deleting} className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors cursor-pointer disabled:opacity-50">
              {retrying ? "Retrying…" : "↻ Retry"}
            </button>
          ) : (
            <span className="text-xs text-zinc-400">Can't retry this one</span>
          )}
          <DeleteWithConfirm onConfirm={handleDelete} label="Delete" />
        </div>
      </div>
    </div>
  );
}

function CardMenu({ id, title, startTime, previewImage, duration, tint, onChange }: {
  id: string;
  title: string;
  startTime: string;
  previewImage: string | null;
  duration: number | null;
  tint: string | null;
  onChange: () => void | Promise<void>;
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

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    await onChange();
  };

  return (
    <Link
      href={`/meetings/${id}`}
      className="group flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-lg transition-all cursor-pointer"
    >
      <div className="relative w-full aspect-video bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        {previewImage ? (
          <Image src={previewImage} alt={title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl opacity-20">✦</span>
          </div>
        )}
        {tint && (
          <div
            className="absolute inset-0 pointer-events-none mix-blend-color opacity-70 group-hover:opacity-50 transition-opacity duration-300"
            style={{ backgroundImage: tint }}
          />
        )}
        {duration && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full z-10">{duration}m</span>
        )}
      </div>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{title}</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">{formatTime(startTime)}</p>
        </div>
        <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.preventDefault()}>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); setConfirming(false); }}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
            {open && (
              <div className="absolute bottom-full right-0 mb-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                <Link
                  href={`/meetings/${id}`}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-violet-500">↗</span> View Deck
                </Link>
                <div className="border-t border-zinc-100 dark:border-zinc-800">
                  {confirming ? (
                    <div className="flex gap-1.5 p-2">
                      <button onClick={handleDelete} disabled={deleting} className="flex-1 text-xs bg-red-600 hover:bg-red-500 text-white font-medium py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                        {deleting ? "…" : "Confirm"}
                      </button>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(false); }} className="flex-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 py-1.5 rounded-lg transition-colors cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                    >
                      <span>✕</span> Delete
                    </button>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    </Link>
  );
}
