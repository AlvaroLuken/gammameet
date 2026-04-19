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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold">
            Gamma<span className="text-violet-500">Meet</span>
          </h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-5xl mx-auto px-8 py-12 space-y-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">{meeting.title}</h2>
            <p className="text-zinc-400">
              {new Date(meeting.start_time).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {" · "}
              {new Date(meeting.start_time).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
              {meeting.end_time && (
                <>
                  {" – "}
                  {new Date(meeting.end_time).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </>
              )}
            </p>
          </div>
          {meeting.gamma_url && (
            <a
              href={meeting.gamma_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-violet-400 text-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              Open in Gamma ↗
            </a>
          )}
        </div>

        {attendees.length > 0 && (
          <div className="space-y-2">
            <p className="text-zinc-500 text-sm font-semibold uppercase tracking-widest">
              Invited
            </p>
            <div className="flex flex-wrap gap-2">
              {attendees.map((email) => (
                <span
                  key={email}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm px-3 py-1 rounded-full"
                >
                  {email}
                </span>
              ))}
            </div>
          </div>
        )}

        {meeting.export_url ? (
          <div className="space-y-3">
            <p className="text-zinc-500 text-sm font-semibold uppercase tracking-widest">
              Meeting Recap
            </p>
            <div className="rounded-xl overflow-hidden border border-zinc-800">
              <embed
                src={meeting.export_url}
                type="application/pdf"
                className="w-full"
                style={{ height: "80vh" }}
              />
            </div>
            <a
              href={meeting.export_url}
              download
              className="inline-block text-zinc-500 hover:text-white text-sm transition-colors cursor-pointer"
            >
              ↓ Download PDF
            </a>
          </div>
        ) : meeting.gamma_url ? (
          <div className="space-y-3">
            <p className="text-zinc-500 text-sm font-semibold uppercase tracking-widest">
              Meeting Recap
            </p>
            <a
              href={meeting.gamma_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-zinc-900 border border-violet-800 rounded-xl px-6 py-5 hover:border-violet-500 transition-colors group cursor-pointer"
            >
              <div className="space-y-1">
                <p className="text-white font-semibold text-lg">View on Gamma</p>
                <p className="text-zinc-500 text-sm">AI-generated recap · beautifully designed</p>
              </div>
              <span className="text-violet-400 text-2xl group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-8 text-center space-y-2">
            <p className="text-zinc-400">No recap available yet.</p>
            <p className="text-zinc-600 text-sm">
              A recap will appear here once Fireflies finishes processing the recording.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
