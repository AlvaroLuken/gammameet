import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/");

  const { id } = await params;

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, meeting_invites(email)")
    .eq("id", id)
    .single();

  if (!meeting) redirect("/dashboard");

  const attendees: string[] = meeting.meeting_invites?.map(
    (i: { email: string }) => i.email
  ) ?? [];

  const formattedDate = new Date(meeting.start_time).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedTime = new Date(meeting.start_time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white overflow-hidden">
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
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col gap-6 p-6 overflow-y-auto bg-white dark:bg-zinc-950">
          <div className="space-y-1">
            <h2 className="text-lg font-bold leading-snug">{meeting.title}</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">{formattedDate}</p>
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">{formattedTime}</p>
          </div>

          {attendees.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Attendees
              </p>
              <div className="flex flex-col gap-1.5">
                {attendees.map((email) => (
                  <span
                    key={email}
                    className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg truncate"
                  >
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
            {meeting.gamma_url && (
              <a
                href={meeting.gamma_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Open in Gamma ↗
              </a>
            )}
            {meeting.export_url && (
              <a
                href={meeting.export_url}
                download
                className="inline-flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                ↓ Download PDF
              </a>
            )}
          </div>
        </aside>

        {/* Deck viewer */}
        <main className="flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          {meeting.export_url ? (
            <embed
              src={meeting.export_url}
              type="application/pdf"
              className="w-full h-full"
            />
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
                <p className="text-zinc-500 text-sm">Check back after Fireflies finishes processing.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
