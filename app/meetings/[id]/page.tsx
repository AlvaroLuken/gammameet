import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MeetingTime } from "@/components/MeetingTime";
import Image from "next/image";
import { ActionsMenu } from "@/components/ActionsMenu";
import { ExpandableText } from "@/components/ExpandableText";
import { ActionItemsList } from "@/components/ActionItemsList";
import { DeckWithRegenOverlay } from "@/components/DeckWithRegenOverlay";
import { MeetingRegenProvider } from "@/components/MeetingRegenContext";
import { AttendeeRow } from "@/components/AttendeeRow";
import { BriefToggle } from "@/components/BriefToggle";
import { TranscriptToggle } from "@/components/TranscriptToggle";

// Bots created before this deploy don't have audio_mixed_mp3 in their
// Recall recording_config, so the download will always 410. Hide the
// menu entry for them so users don't see a dead button.
const AUDIO_FEATURE_RELEASED_AT = new Date("2026-04-29T09:35:00Z");

function hasAudioRecording(meeting: { recall_bot_id: string | null; created_at?: string | null }): boolean {
  if (!meeting.recall_bot_id) return false;
  if (!meeting.created_at) return false;
  return new Date(meeting.created_at) >= AUDIO_FEATURE_RELEASED_AT;
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
    <MeetingRegenProvider>
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
                {attendees.map((email) => <AttendeeRow key={email} email={email} />)}
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
              <ActionItemsList text={meeting.action_items} />
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">No action items detected in this meeting.</p>
            )}
            {meeting.gamma_brief && <BriefToggle text={meeting.gamma_brief} />}
            {meeting.transcript_text && <TranscriptToggle text={meeting.transcript_text} />}
          </div>

          <ActionsMenu id={id} gammaUrl={meeting.gamma_url} exportUrl={meeting.export_url} title={meeting.title} hasRecording={hasAudioRecording(meeting)} />
        </aside>

        {/* Deck viewer */}
        <main className="flex-1 md:overflow-y-auto bg-zinc-100 dark:bg-zinc-900 p-4">
          {meeting.export_url ? (
            <>
              {/* Desktop: deck viewer with slide rail */}
              <div className="hidden md:block">
                <DeckWithRegenOverlay exportUrl={meeting.export_url} />
              </div>
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
    </MeetingRegenProvider>
  );
}
