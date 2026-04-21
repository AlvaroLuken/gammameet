import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const metadata = { title: "Unsubscribed · GammaMeet" };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ email?: string; token?: string }> }) {
  const { email, token } = await searchParams;

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return (
      <Shell>
        <h1 className="text-3xl font-bold">Invalid link</h1>
        <p className="text-zinc-500 dark:text-zinc-400">This unsubscribe link is expired or invalid. If you're still getting GammaMeet emails, reply to one of them and we'll remove you manually.</p>
      </Shell>
    );
  }

  await supabase
    .from("email_opt_outs")
    .upsert({ email: email.toLowerCase() }, { onConflict: "email" });

  return (
    <Shell>
      <h1 className="text-3xl font-bold">You're unsubscribed</h1>
      <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
        <span className="font-medium text-zinc-900 dark:text-white">{email}</span> will no longer receive GammaMeet recap emails.
      </p>
      <p className="text-sm text-zinc-400 dark:text-zinc-500">Changed your mind? Sign in at GammaMeet and we'll handle it.</p>
      <Link href="/" className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors cursor-pointer">
        Back to GammaMeet →
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex items-center justify-center px-6 py-20">
      <div className="max-w-md w-full space-y-5 text-center">{children}</div>
    </main>
  );
}
