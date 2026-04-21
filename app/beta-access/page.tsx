import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Request beta access · GammaMeet",
  description: "GammaMeet is in private beta. Request access to try it early.",
  robots: { index: false, follow: false },
};

export default function BetaAccessPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  void searchParams; // we don't surface the raw error code to users
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/" className="text-xl font-bold hover:opacity-80 transition-opacity">
          Gamma<span className="text-violet-500">Meet</span>
        </Link>
      </nav>

      <section className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full space-y-8 text-center">
          <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 text-sm font-semibold px-4 py-1.5 rounded-full">
            ✦ Private beta
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            GammaMeet is in <span className="text-violet-500">private beta</span>
          </h1>

          <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
            We're rolling out access slowly to a small group of testers while we polish the product. Your Google account isn't on the beta list yet — but it can be.
          </p>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-left space-y-4">
            <h2 className="font-semibold text-lg">How to request access</h2>
            <ol className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 text-xs flex items-center justify-center font-bold mt-0.5">1</span>
                <span>Visit <a href="https://www.al-luken.space/" target="_blank" rel="noopener noreferrer" className="text-violet-500 font-medium hover:text-violet-400 transition-colors">al-luken.space</a> and find the contact section.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 text-xs flex items-center justify-center font-bold mt-0.5">2</span>
                <span>Send a quick message with your Google email address. Mention GammaMeet so it goes to the top of the stack.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 text-xs flex items-center justify-center font-bold mt-0.5">3</span>
                <span>You'll get added to the allowlist within a day, then sign in here normally.</span>
              </li>
            </ol>
          </div>

          <a
            href="https://www.al-luken.space/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-full transition-colors cursor-pointer"
          >
            Request access at al-luken.space →
          </a>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-4">
            Already on the list? <Link href="/" className="text-violet-500 hover:text-violet-400 transition-colors">Try signing in again →</Link>
          </p>
        </div>
      </section>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6 text-center text-zinc-400 text-xs space-x-4">
        <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Home</Link>
        <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Privacy</Link>
        <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Terms</Link>
      </footer>
    </main>
  );
}
