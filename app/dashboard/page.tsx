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
  meeting_invites?: { email: string }[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function durationMins(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

async function fetchMeetings() {
  const r = await fetch("/api/meetings");
  return r.json() as Promise<Meeting[]>;
}

export default function Dashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-8 py-5 flex items-center justify-between">
        <Link href="/dashboard" className="text-2xl font-bold hover:opacity-80 transition-opacity">
          Gamma<span className="text-violet-500">Meet</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/profile"
            className="inline-flex items-center text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-full transition-colors cursor-pointer"
          >
            Profile
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

      <main className="max-w-5xl mx-auto px-8 py-12 space-y-8">
        {loading ? (
          <div className="text-zinc-400 text-center py-20">Loading your recaps...</div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-zinc-500 text-lg">No recaps yet.</p>
            <p className="text-zinc-400 text-sm">
              Add <span className="font-mono bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded">fred@fireflies.ai</span> to a meeting to get your first recap.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-zinc-500 dark:text-zinc-400 text-sm font-semibold uppercase tracking-widest">
                {meetings.length} Recap{meetings.length !== 1 ? "s" : ""}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {meetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} />
              ))}
            </div>
          </>
        )}
      </main>
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
      {/* Preview image */}
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

      {/* Card body */}
      <div className="flex flex-col gap-2 p-4">
        <p className="font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2">
          {meeting.title}
        </p>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs">
          {formatDate(meeting.start_time)} · {formatTime(meeting.start_time)}
        </p>
        <span className="mt-1 inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 text-xs font-semibold">
          View Deck →
        </span>
      </div>
    </Link>
  );
}
