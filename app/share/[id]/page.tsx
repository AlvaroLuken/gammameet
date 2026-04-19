import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MeetingTime } from "@/components/MeetingTime";

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .single();

  if (!meeting || !meeting.gamma_url) notFound();

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white overflow-hidden">
      <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold hover:opacity-80 transition-opacity">
          Gamma<span className="text-violet-500">Meet</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-full transition-colors cursor-pointer"
        >
          Get GammaMeet free →
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col gap-5 p-6 overflow-y-auto bg-white dark:bg-zinc-950">
          <div className="space-y-1">
            <h2 className="text-lg font-bold leading-snug">{meeting.title}</h2>
            <MeetingTime startTime={meeting.start_time} />
          </div>

          {meeting.summary && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Summary</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{meeting.summary}</p>
            </div>
          )}

          {meeting.action_items && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Action Items</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">{meeting.action_items}</p>
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Generated automatically by GammaMeet</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Get your own decks →
            </Link>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-zinc-100 dark:bg-zinc-900 p-4">
          {meeting.export_url ? (
            <embed
              src={`${meeting.export_url}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0`}
              type="application/pdf"
              className="w-full rounded-xl"
              style={{ height: "calc(100vh - 120px)" }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <a
                href={meeting.gamma_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer"
              >
                Open in Gamma ↗
              </a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
