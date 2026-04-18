"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  gamma_url: string | null;
  meet_link: string | null;
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

export default function Dashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((data) => {
        setMeetings(data);
        setLoading(false);
      });
  }, []);

  const withRecap = meetings.filter((m) => m.gamma_url);
  const withoutRecap = meetings.filter((m) => !m.gamma_url);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 px-8 py-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Gamma<span className="text-violet-400">Meet</span>
        </h1>
        <form action="/api/auth/signout" method="POST">
          <button className="text-zinc-500 hover:text-white text-sm transition-colors">
            Sign out
          </button>
        </form>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-12 space-y-12">
        {loading ? (
          <div className="text-zinc-500 text-center py-20">Loading your meetings...</div>
        ) : (
          <>
            {withRecap.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-zinc-400 text-sm font-semibold uppercase tracking-widest">
                  Recaps Ready ({withRecap.length})
                </h2>
                <div className="space-y-3">
                  {withRecap.map((m) => (
                    <MeetingCard key={m.id} meeting={m} />
                  ))}
                </div>
              </section>
            )}

            {withoutRecap.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-zinc-400 text-sm font-semibold uppercase tracking-widest">
                  All Meetings ({withoutRecap.length})
                </h2>
                <div className="space-y-3">
                  {withoutRecap.map((m) => (
                    <MeetingCard key={m.id} meeting={m} />
                  ))}
                </div>
              </section>
            )}

            {meetings.length === 0 && (
              <div className="text-center py-20 space-y-3">
                <p className="text-zinc-400 text-lg">No meetings found in the last 3 months.</p>
                <p className="text-zinc-600 text-sm">
                  Make sure Fireflies is connected to your calendar to start generating recaps.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4 hover:border-zinc-700 transition-colors">
      <div className="space-y-1">
        <p className="font-medium text-white">{meeting.title}</p>
        <p className="text-zinc-500 text-sm">
          {formatDate(meeting.start_time)} · {formatTime(meeting.start_time)} – {formatTime(meeting.end_time)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {meeting.gamma_url ? (
          <Link
            href={`/meetings/${meeting.id}`}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            View Recap →
          </Link>
        ) : (
          <span className="text-zinc-600 text-sm">No recap yet</span>
        )}
      </div>
    </div>
  );
}
