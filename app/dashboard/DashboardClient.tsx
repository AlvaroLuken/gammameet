"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  meeting_invites?: { email: string }[];
}

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

async function fetchMeetings() {
  const r = await fetch("/api/meetings");
  return r.json() as Promise<Meeting[]>;
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
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const prevIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((p) => {
        setShowUpcoming(p.showUpcoming ?? false);
        setShowProcessing(p.showProcessing ?? false);
        setShowFailed(p.showFailed ?? false);
        if (p.showUpcoming || p.showProcessing || p.showFailed) setStatusExpanded(true);
        setPrefsLoaded(true);
      })
      .catch(() => setPrefsLoaded(true));
  }, []);

  useEffect(() => {
    fetchMeetings().then((data) => {
      setMeetings(data);
      prevIds.current = new Set(data.map((m) => m.id));
      setLoading(false);
    });
    const interval = setInterval(async () => {
      const data = await fetchMeetings();
      const newOnes = data.filter((m) => !prevIds.current.has(m.id));
      if (newOnes.length > 0) {
        setMeetings(data);
        prevIds.current = new Set(data.map((m) => m.id));
      }
    }, 20000);
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

  // Classify each meeting
  const now = Date.now();
  const classified = meetings.map((m) => {
    const startMs = new Date(m.start_time).getTime();
    const isUpcoming = startMs > now;
    const isStale = !m.gamma_url && !isUpcoming && startMs < now - 90 * 60 * 1000;
    const isFailed = !!m.transcript_error || isStale;
    const isProcessing = !m.gamma_url && !isFailed && !isUpcoming;
    const isReady = !!m.gamma_url;
    return { ...m, _upcoming: isUpcoming, _processing: isProcessing, _failed: isFailed, _ready: isReady };
  });

  // Apply status filter first
  const statusFiltered = classified.filter((m) => {
    if (m._ready) return true;
    if (m._upcoming && showUpcoming) return true;
    if (m._processing && showProcessing) return true;
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
  const hasActiveFilters = dateFilter !== "all" || attendeeFilter.size > 0 || query.trim() || showUpcoming || showProcessing || showFailed;

  const upcomingCount = classified.filter((m) => m._upcoming).length;
  const processingCount = classified.filter((m) => m._processing).length;
  const failedCount = classified.filter((m) => m._failed).length;

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
    setShowUpcoming(false);
    setShowProcessing(false);
    setShowFailed(false);
  };

  const { color, letter } = letterAvatar(user.name || user.email);

  const sidebar = (
    <aside
      ref={sidebarRef}
      className={`
        w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800
        flex flex-col gap-6 px-4 py-6 overflow-y-auto bg-zinc-50 dark:bg-black
        fixed md:static inset-y-0 left-0 z-40 transition-transform duration-300
        ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}
      `}
    >
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

      {/* Status filter */}
      <div className="space-y-2">
        <button
          onClick={() => setStatusExpanded((o) => !o)}
          className="flex items-center justify-between w-full px-1 cursor-pointer group"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">Show more</p>
          <svg className={`w-3 h-3 text-zinc-400 transition-transform ${statusExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {statusExpanded && (
          <div className="flex flex-col gap-1">
            <button onClick={() => setShowUpcoming((o) => !o)} className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${showUpcoming ? "bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Upcoming meetings</span>
              {upcomingCount > 0 && <span className="text-xs text-zinc-400">{upcomingCount}</span>}
            </button>
            <button onClick={() => setShowProcessing((o) => !o)} className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${showProcessing ? "bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Generating</span>
              {processingCount > 0 && <span className="text-xs text-zinc-400">{processingCount}</span>}
            </button>
            <button onClick={() => setShowFailed((o) => !o)} className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${showFailed ? "bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Failed</span>
              {failedCount > 0 && <span className="text-xs text-red-400">{failedCount}</span>}
            </button>
          </div>
        )}
      </div>

      {/* Attendee filter */}
      {allAttendees.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">Attendees</p>
          <div className="flex flex-col gap-1">
            {allAttendees.map((email) => {
              const { color: ac, letter: al } = letterAvatar(email);
              const checked = attendeeFilter.has(email);
              return (
                <button
                  key={email}
                  onClick={() => toggleAttendee(email)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                    checked
                      ? "bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  <span className={`w-6 h-6 shrink-0 rounded-full ${ac} text-white text-xs flex items-center justify-center font-bold`}>
                    {al}
                  </span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate flex-1">{email}</span>
                  {checked && (
                    <svg className="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
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
    </aside>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors flex flex-col">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
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
                    <p className="text-zinc-500 text-sm">Follow these steps to get your first deck.</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                    {/* Step 1 */}
                    <div className="flex items-start gap-4 p-5">
                      <span className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 text-sm flex items-center justify-center shrink-0 font-bold mt-0.5">✓</span>
                      <div>
                        <p className="font-semibold text-sm">Sign in with Google</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">Your Google Calendar is connected and ready.</p>
                      </div>
                    </div>
                    {/* Step 2 */}
                    <div className="flex items-start gap-4 p-5">
                      <span className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 text-sm flex items-center justify-center shrink-0 font-bold mt-0.5">2</span>
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold text-sm">Admit the bot to your meeting</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">
                          A <span className="font-medium text-zinc-700 dark:text-zinc-300">GammaMeet Notetaker</span> bot joins your meetings automatically — just hit <span className="font-medium text-zinc-700 dark:text-zinc-300">Admit</span> when it knocks. For last-minute meetings, use <Link href="/add-bot" className="text-violet-500 hover:underline">+ Add bot</Link>.
                        </p>
                      </div>
                    </div>
                    {/* Step 3 */}
                    <div className="flex items-start gap-4 p-5 opacity-50">
                      <span className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm flex items-center justify-center shrink-0 font-bold mt-0.5">3</span>
                      <div>
                        <p className="font-semibold text-sm">Your deck appears here</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">After the meeting ends, GammaMeet generates your deck and emails it to all attendees automatically.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <>
                {groups.map(({ label, meetings: ms }) => (
                  <div key={label} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                        {label}
                      </h2>
                      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                      <span className="text-xs text-zinc-400 dark:text-zinc-600">{ms.length} deck{ms.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {ms.map((m) => <MeetingCard key={m.id} meeting={m} onDeleted={(id) => setMeetings((prev) => prev.filter((x) => x.id !== id))} />)}
                    </div>
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

function MeetingCard({ meeting, onDeleted }: { meeting: Meeting & { _upcoming?: boolean; _processing?: boolean; _failed?: boolean }; onDeleted: (id: string) => void }) {
  const duration = meeting.end_time ? durationMins(meeting.start_time, meeting.end_time) : null;
  const [deleting, setDeleting] = useState(false);

  const isUpcoming = !!meeting._upcoming;
  const isFailed = !!meeting._failed;
  const isProcessing = !!meeting._processing;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
    onDeleted(meeting.id);
  };

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
          <div className="mt-auto pt-2 flex items-center justify-between">
            <span className="text-xs text-zinc-400">Scheduled · Bot ready</span>
            <button onClick={handleDelete} disabled={deleting} className="text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50">
              {deleting ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Processing: meeting ended, deck being generated
  if (isProcessing) {
    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="w-full aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="flex flex-col gap-1.5 p-4 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{meeting.title}</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">{formatTime(meeting.start_time)}</p>
          <div className="mt-auto pt-2 flex items-center justify-between">
            <span className="text-xs text-violet-400">Generating deck…</span>
            <button onClick={handleDelete} disabled={deleting} className="text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Failed: transcript failed or timed out
  if (isFailed) {
    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/60 rounded-2xl overflow-hidden">
        <div className="w-full aspect-video bg-red-50 dark:bg-red-950/20 flex items-center justify-center">
          <span className="text-3xl opacity-30">✕</span>
        </div>
        <div className="flex flex-col gap-1.5 p-4 flex-1">
          <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{meeting.title}</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">{formatTime(meeting.start_time)}</p>
          <div className="mt-auto pt-2 flex items-center justify-between">
            <span className="text-xs text-red-400">Generation failed</span>
            <button onClick={handleDelete} disabled={deleting} className="text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ready: deck generated
  return (
    <CardMenu id={meeting.id} title={meeting.title} previewImage={meeting.preview_image} duration={duration} onDeleted={onDeleted} />
  );
}

function CardMenu({ id, title, previewImage, duration, onDeleted }: {
  id: string;
  title: string;
  previewImage: string | null;
  duration: number | null;
  onDeleted: (id: string) => void;
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
    onDeleted(id);
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
        {duration && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">{duration}m</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-4 flex-1">
        <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">{title}</p>
        <div className="mt-auto pt-2 flex items-center justify-between">
          <div ref={menuRef} className="relative" onClick={(e) => e.preventDefault()}>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); setConfirming(false); }}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {open && (
              <div className="absolute bottom-full left-0 mb-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
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
      </div>
    </Link>
  );
}
