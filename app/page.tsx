import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

async function handleSignIn() {
  "use server";
  await signIn("google", { redirectTo: "/dashboard" });
}

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xl font-bold">
          Gamma<span className="text-violet-500">Meet</span>
        </span>
        <form action={handleSignIn}>
          <button type="submit" className="inline-flex items-center gap-2 bg-white text-black font-semibold px-5 py-2.5 text-sm rounded-full hover:bg-zinc-100 transition-colors cursor-pointer">
            <GoogleIcon />
            Sign in
          </button>
        </form>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 py-28 text-center space-y-8">
        <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 text-sm font-semibold px-4 py-1.5 rounded-full">
          ✦ Powered by Gamma AI
        </div>
        <h1 className="text-6xl sm:text-7xl font-bold tracking-tight leading-none">
          Every meeting,<br />
          <span className="text-violet-500">beautifully decked.</span>
        </h1>
        <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
          GammaMeet turns your meeting recordings into stunning AI-generated presentation decks — automatically, the moment your meeting ends.
        </p>
        <form action={handleSignIn}>
          <button type="submit" className="inline-flex items-center gap-3 bg-white text-black font-semibold px-8 py-4 text-lg rounded-full hover:bg-zinc-100 transition-colors cursor-pointer">
            <GoogleIcon />
            Get started free
          </button>
        </form>
        <p className="text-zinc-400 text-sm">Connects to Google Calendar · No credit card required</p>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-24 px-8">
        <div className="max-w-4xl mx-auto space-y-14">
          <h2 className="text-3xl font-bold text-center">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            {[
              {
                step: "01",
                title: "Sign in with Google",
                desc: "Connect your Google account so GammaMeet can see which meetings you attend.",
              },
              {
                step: "02",
                title: "Fireflies records your meeting",
                desc: "Add fred@fireflies.ai to any meeting. Fireflies transcribes it when it ends.",
              },
              {
                step: "03",
                title: "Your deck appears instantly",
                desc: "GammaMeet generates a beautiful Gamma presentation and emails it to all attendees.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="space-y-3">
                <span className="text-violet-500 font-mono text-sm font-bold">{step}</span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-8 text-center space-y-6">
        <h2 className="text-4xl font-bold">Ready to recap smarter?</h2>
        <p className="text-zinc-500 dark:text-zinc-400">Join and get your first deck after your next meeting.</p>
        <form action={handleSignIn}>
          <button type="submit" className="inline-flex items-center gap-3 bg-white text-black font-semibold px-8 py-4 text-lg rounded-full hover:bg-zinc-100 transition-colors cursor-pointer">
            <GoogleIcon />
            Start for free
          </button>
        </form>
      </section>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6 text-center text-zinc-400 text-sm">
        © {new Date().getFullYear()} GammaMeet · Built with Gamma AI
      </footer>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z" />
    </svg>
  );
}
