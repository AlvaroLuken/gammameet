import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MeetingTime } from "@/components/MeetingTime";
import Image from "next/image";
import { ActionsMenu } from "@/components/ActionsMenu";
import { ExpandableText } from "@/components/ExpandableText";

function letterAvatar(str: string) {
  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-pink-500", "bg-orange-500"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return { color: colors[Math.abs(hash) % colors.length], letter: str[0].toUpperCase() };
}

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  // Non-authed visitors — send them to the public share view so email links still work
  if (!session) redirect(`/share/${id}`);

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, meeting_invites(email)")
    .eq("id", id)
    .single();

  if (!meeting) redirect("/dashboard");

  const attendees: string[] = meeting.meeting_invites?.map((i: { email: string }) => i.email) ?? [];

  // Authed but not an attendee — fall back to the public share view
  const isAttendee = !!session.user.email && attendees.includes(session.user.email);
  if (!isAttendee) redirect(`/share/${id}`);

  return (
    <div className="min-h-screen md:h-screen flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white md:overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            ← Back
          </Link>
          <Link href="/dashboard" className="text-xl font-bold hover:opacity-80 transition-opacity">
            Gamma<span className="text-violet-500">Meet</span>
          </Link>
        </div>
        <ThemeToggle />
      </header>

      {/* Body: sidebar + deck */}
      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 flex flex-col gap-5 p-6 md:overflow-y-auto bg-white dark:bg-zinc-950">
          <div className="space-y-1">
            <h2 className="text-lg font-bold leading-snug">{meeting.title}</h2>
            <MeetingTime startTime={meeting.start_time} />
          </div>

          {attendees.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Attendees</p>
              <div className="flex flex-col gap-1.5">
                {attendees.map((email) => {
                  const { color, letter } = letterAvatar(email);
                  return (
                    <div key={email} className="flex items-center gap-2.5 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg">
                      <span className={`w-7 h-7 shrink-0 rounded-full ${color} text-white text-xs flex items-center justify-center font-bold`}>
                        {letter}
                      </span>
                      <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{email}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {meeting.summary && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Summary</p>
              <ExpandableText text={meeting.summary} lines={3} />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Action Items</p>
            {meeting.action_items?.trim() ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">{meeting.action_items}</p>
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">No action items detected in this meeting.</p>
            )}
          </div>

          <ActionsMenu id={id} gammaUrl={meeting.gamma_url} exportUrl={meeting.export_url} />
        </aside>

        {/* Deck viewer */}
        <main className="flex-1 md:overflow-y-auto bg-zinc-100 dark:bg-zinc-900 p-4">
          {meeting.export_url ? (
            <>
              {/* Desktop: inline PDF embed */}
              <embed
                src={`${meeting.export_url}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0`}
                type="application/pdf"
                className="hidden md:block w-full rounded-xl"
                style={{ height: "min(calc(100vh - 120px), 80vw)" }}
              />
              {/* Mobile: tap-to-open preview (PDF <embed> can't scroll pages on iOS Safari) */}
              <a
                href={meeting.export_url}
                target="_blank"
                rel="noopener noreferrer"
                className="md:hidden block relative rounded-xl overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg"
              >
                {meeting.preview_image ? (
                  <div className="relative aspect-video">
                    <Image
                      src={meeting.preview_image}
                      alt={meeting.title}
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                    <span className="text-4xl opacity-20">✦</span>
                  </div>
                )}
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    Open full deck
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    The deck opens in your browser so you can swipe through every slide.
                  </p>
                </div>
              </a>
            </>
          ) : meeting.gamma_url ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <p className="text-zinc-400 text-lg">Preview not available</p>
                <a
                  href={meeting.gamma_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer"
                >
                  Open in Gamma ↗
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <p className="text-zinc-400">No deck available yet.</p>
                <p className="text-zinc-500 text-sm">Your deck will appear here once the meeting ends.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
