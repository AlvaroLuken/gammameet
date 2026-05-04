import type { Metadata } from "next";
import Link from "next/link";
import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MadeWithGammaBadge } from "@/components/MadeWithGammaBadge";

export const metadata: Metadata = {
  title: "Sign in · GammaMeet",
  description: "GammaMeet is in private beta. Request access or sign in if you've been invited.",
  robots: { index: false, follow: false },
};

async function handleSignIn() {
  "use server";
  await signIn("google", { redirectTo: "/dashboard" });
}

export default async function BetaAccessPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // If the user is already authenticated, skip straight to dashboard
  const session = await auth();
  if (session) redirect("/dashboard");

  const { error } = await searchParams;
  const hasError = !!error;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/" className="text-xl font-bold hover:opacity-80 transition-opacity">
          Gamma<span className="text-violet-500">Meet</span>
        </Link>
        <ThemeToggle />
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
            {hasError
              ? "Looks like your Google account isn't on the beta list yet — here's how to get added."
              : "While we polish the product, we're inviting testers one at a time. Pick the option that fits you."}
          </p>

          <div className="grid gap-3">
            {/* Not yet approved */}
            <a
              href="https://www.al-luken.space/"
              target="_blank"
              rel="noopener noreferrer"
              className="group block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-violet-400 dark:hover:border-violet-600 rounded-2xl p-5 text-left transition-all hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-base">I need beta access</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Use the contact form at al-luken.space. Include your preferred email + mention GammaMeet. Usually approved within a few hours!
                  </p>
                </div>
                <span className="text-violet-500 text-xl group-hover:translate-x-0.5 transition-transform shrink-0">→</span>
              </div>
            </a>

            {/* Already approved */}
            <form action={handleSignIn}>
              <button
                type="submit"
                className="w-full group block bg-violet-600 hover:bg-violet-500 text-white rounded-2xl p-5 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex items-center gap-3">
                    <GoogleIcon />
                    <div>
                      <p className="font-semibold text-base">I'm on the beta list — sign in</p>
                      <p className="text-sm text-violet-100 mt-0.5">
                        Continue with Google. Your email must match the one you gave us.
                      </p>
                    </div>
                  </div>
                  <span className="text-xl group-hover:translate-x-0.5 transition-transform shrink-0">→</span>
                </div>
              </button>
            </form>
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-2">
            Not sure if you've been added? Click Sign in — if Google lets you through, you're on the list.
          </p>
        </div>
      </section>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6 text-center text-zinc-400 text-xs space-y-3">
        <div className="space-x-4">
          <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Terms</Link>
        </div>
        <div className="flex justify-center">
          <MadeWithGammaBadge />
        </div>
      </footer>
    </main>
  );
}

function GoogleIcon() {
  return (
    <span className="w-8 h-8 bg-white rounded-full flex items-center justify-center shrink-0">
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z" />
      </svg>
    </span>
  );
}
