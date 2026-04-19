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
}

interface User {
  name: string;
  email: string;
  image: string | null;
}

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

export default function DashboardClient({ user }: { user: User }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const prevIds = useRef<Set<string>>(new Set());

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

  const filtered = query.trim()
    ? meetings.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()))
    : meetings;
  const groups = groupByDate(filtered);
  const { color, letter } = letterAvatar(user.name || user.email);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-8 py-4 flex items-center justify-between shrink-0">
        <Link href="/dashboard" className="text-2xl font-bold hover:opacity-80 transition-opacity">
          Gamma<span className="text-violet-500">Meet</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 pl-2 pr-4 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            {user.image ? (
              <Image src={user.image} alt={user.name} width={24} height={24} className="rounded-full" />
            ) : (
              <span className={`w-6 h-6 rounded-full ${color} text-white text-xs flex items-center justify-center font-bold`}>{letter}</span>
            )}
            {user.name.split(" ")[0]}
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="inline-flex items-center text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-950 text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 px-4 py-2 rounded-full transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col gap-6 px-4 py-6 overflow-y-auto">
          {/* Search */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">
              Search
            </p>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
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
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Filters — coming soon */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">
              Filters
            </p>
            <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 px-3 py-4 text-center space-y-1">
              <p className="text-xs text-zinc-400 dark:text-zinc-600">Coming soon</p>
              <p className="text-xs text-zinc-300 dark:text-zinc-700">Filter by type, attendee, and more</p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-8 py-10">
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
              <div className="text-center py-20 space-y-3">
                {query ? (
                  <p className="text-zinc-500 text-lg">No decks match &ldquo;{query}&rdquo;</p>
                ) : (
                  <>
                    <p className="text-zinc-500 text-lg">No decks yet.</p>
                    <p className="text-zinc-400 text-sm">
                      Add <span className="font-mono bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded">fred@fireflies.ai</span> to a meeting to get your first deck.
                    </p>
                  </>
                )}
              </div>
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
                      {ms.map((m) => <MeetingCard key={m.id} meeting={m} />)}
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

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const duration = meeting.end_time ? durationMins(meeting.start_time, meeting.end_time) : null;

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-lg transition-all cursor-pointer"
    >
      <div className="relative w-full aspect-video bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        {meeting.preview_image ? (
          <Image
            src={meeting.preview_image}
            alt={meeting.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl opacity-20">✦</span>
          </div>
        )}
        {duration && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
            {duration}m
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-4 flex-1">
        <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">
          {meeting.title}
        </p>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs">
          {formatTime(meeting.start_time)}
        </p>
        <div className="mt-auto pt-2 flex justify-end">
          <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 text-xs font-semibold">
            View Deck →
          </span>
        </div>
      </div>
    </Link>
  );
}
