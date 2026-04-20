import type { Metadata } from "next";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { DashboardPreferences } from "@/components/DashboardPreferences";

export const metadata: Metadata = { title: "Profile — GammaMeet" };

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/");

  const { user } = session;

  const { data: invites } = await supabase
    .from("meeting_invites")
    .select("meeting_id")
    .eq("email", user.email!);

  const meetingIds = [...new Set((invites ?? []).map((r) => r.meeting_id))];

  const { count: deckCount } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .in("id", meetingIds.length > 0 ? meetingIds : ["none"])
    .not("gamma_url", "is", null);

  const { data: userData } = await supabase
    .from("users")
    .select("dashboard_prefs")
    .eq("email", user.email!)
    .single();

  const dashboardPrefs = {
    showUpcoming: false,
    showProcessing: false,
    showFailed: false,
    ...(userData?.dashboard_prefs ?? {}),
  };

  const { count: upcomingCount } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .in("id", meetingIds.length > 0 ? meetingIds : ["none"])
    .not("recall_bot_id", "is", null)
    .is("gamma_url", null);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 md:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm cursor-pointer">
            ← Dashboard
          </Link>
          <Link href="/dashboard" className="text-xl md:text-2xl font-bold hover:opacity-80 transition-opacity">
            Gamma<span className="text-violet-500">Meet</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <form action={handleSignOut}>
            <button
              type="submit"
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </form>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 md:px-8 py-12 md:py-16 space-y-8">
        {/* Avatar + name */}
        <div className="flex items-center gap-5">
          {user.image && (
            <Image src={user.image} alt={user.name ?? ""} width={72} height={72} className="rounded-full" />
          )}
          <div>
            <p className="text-2xl font-bold">{user.name}</p>
            <p className="text-zinc-400 text-sm">{user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-1">
            <p className="text-3xl font-bold text-violet-500">{deckCount ?? 0}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Decks generated</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-1">
            <p className="text-3xl font-bold text-violet-500">{upcomingCount ?? 0}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Meetings queued</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-1">
            <p className="text-3xl font-bold text-violet-500">✦</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Powered by Gamma AI</p>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-lg">How recording works</h2>
          <div className="flex flex-col gap-4">
            {[
              {
                icon: "✓",
                color: "text-green-500",
                title: "Google Calendar connected",
                desc: "GammaMeet watches your calendar for upcoming meetings with video links.",
              },
              {
                icon: "✓",
                color: "text-green-500",
                title: "Bot joins automatically",
                desc: "A \"GammaMeet Notetaker\" bot joins each meeting 2 minutes before it starts. Admit it when it knocks.",
              },
              {
                icon: "✦",
                color: "text-violet-400",
                title: "Deck appears after the meeting",
                desc: "Once the meeting ends, GammaMeet generates your deck and emails it to all attendees.",
              },
            ].map(({ icon, color, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <span className={`${color} font-bold mt-0.5 shrink-0`}>{icon}</span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Google connection */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Google</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-800">
              ✓ Connected
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Signed in as {user.email}</p>
        </div>

        <DashboardPreferences initial={dashboardPrefs} />

        {/* Sign out */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg">Sign out</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">End your current session on this device.</p>
          </div>
          <form action={handleSignOut}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 text-sm font-semibold px-5 py-2.5 rounded-full transition-colors cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Sign out
            </button>
          </form>
        </div>

        {/* Danger zone */}
        <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900 rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold text-lg text-red-600 dark:text-red-400">Danger zone</h2>
          <DeleteAccountButton />
        </div>

        {/* Feedback */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-2">
          <h2 className="font-semibold text-lg">Feedback</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            To submit feedback, go to the contact section of{" "}
            <a
              href="https://www.al-luken.space/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-500 hover:text-violet-400 transition-colors font-medium"
            >
              al-luken.space ↗
            </a>
            .
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
          <Link href="/faq" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">FAQ</Link>
          <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Terms of Service</Link>
        </div>
      </main>
    </div>
  );
}
