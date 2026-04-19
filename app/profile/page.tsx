import type { Metadata } from "next";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "Profile" };

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/");

  const { user } = session;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm cursor-pointer">
            ← Dashboard
          </Link>
          <Link href="/dashboard" className="text-2xl font-bold hover:opacity-80 transition-opacity">
            Gamma<span className="text-violet-500">Meet</span>
          </Link>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-2xl mx-auto px-8 py-16 space-y-10">
        {/* Avatar + name */}
        <div className="flex items-center gap-5">
          {user.image && (
            <Image
              src={user.image}
              alt={user.name ?? ""}
              width={72}
              height={72}
              className="rounded-full"
            />
          )}
          <div>
            <p className="text-2xl font-bold">{user.name}</p>
            <p className="text-zinc-400 text-sm">{user.email}</p>
          </div>
        </div>

        {/* Setup instructions */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">Fireflies setup</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
            To get meeting decks, add{" "}
            <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-violet-500">
              fred@fireflies.ai
            </span>{" "}
            as a participant to any Google Calendar event. Fireflies will join, record, and transcribe — then GammaMeet will automatically generate your deck.
          </p>
          <div className="flex flex-col gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Google Calendar connected
            </div>
            <div className="flex items-center gap-2">
              <span className="text-violet-400">✦</span> Decks emailed to all attendees after each meeting
            </div>
          </div>
        </div>

        {/* Sign out */}
        <form action={handleSignOut}>
          <button
            type="submit"
            className="text-sm text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}
