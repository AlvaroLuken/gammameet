import type { Metadata } from "next";
import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FlowAnimation } from "@/components/FlowAnimation";

export const metadata: Metadata = {
  title: "GammaMeet — Every meeting, beautifully decked",
  description: "GammaMeet turns your meeting recordings into stunning AI-generated presentation decks — automatically, the moment your meeting ends.",
  openGraph: {
    title: "GammaMeet — Every meeting, beautifully decked",
    description: "GammaMeet turns your meeting recordings into stunning AI-generated presentation decks — automatically, the moment your meeting ends.",
  },
};

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
      <section className="relative overflow-hidden">
        {/* Ambient glow */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-3xl" style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)" }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-8 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12 lg:gap-20 items-center">
            {/* Left: hero text */}
            <div className="space-y-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 text-sm font-semibold px-4 py-1.5 rounded-full">
                ✦ Powered by Gamma AI
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-none">
                Every meeting,<br />
                <span className="text-violet-500">beautifully decked.</span>
              </h1>
              <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto lg:mx-0">
                GammaMeet turns your meeting recordings into stunning AI-generated presentation decks — automatically, the moment your meeting ends.
              </p>
              <div className="flex flex-col items-center lg:items-start gap-3 pt-2">
                <form action={handleSignIn}>
                  <button type="submit" className="inline-flex items-center gap-3 bg-white text-black font-semibold px-8 py-4 text-lg rounded-full hover:bg-zinc-100 transition-colors cursor-pointer shadow-xl shadow-violet-500/10">
                    <GoogleIcon />
                    Get started free
                  </button>
                </form>
                <p className="text-zinc-400 text-sm">Connects to Google Calendar · No credit card required</p>
              </div>
            </div>

            {/* Right: flow animation */}
            <div className="relative">
              <div className="relative rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-sm px-6 py-8">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-50 dark:bg-black px-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-500">Meeting → Deck</p>
                </div>
                <FlowAnimation orientation="vertical" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Insight strip */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 py-20 px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              icon: "💡",
              headline: "Unlock hidden insights",
              body: "You never know what insights you can unlock from a deck full of organized visuals of the discussions that happened in your meeting.",
            },
            {
              icon: "🚀",
              headline: "Brainstorms with exponential impact",
              body: "Creative brainstorms now have exponential impact — every idea is captured, structured, and shareable before the day is over.",
            },
            {
              icon: "✦",
              headline: "From call to clarity",
              body: "Stop losing decisions in scattered notes. GammaMeet turns every conversation into a polished narrative your whole team can act on.",
            },
          ].map(({ icon, headline, body }) => (
            <div
              key={headline}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-3"
            >
              <span className="text-3xl">{icon}</span>
              <h3 className="text-lg font-bold">{headline}</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* App preview */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-500">See it in action</p>
            <h2 className="text-3xl font-bold">This is what your next meeting becomes.</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md mx-auto">
              A polished presentation — generated in seconds, emailed to every attendee.
            </p>
          </div>

          {/* Replica of the in-app meeting detail view */}
          <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-2xl bg-white dark:bg-zinc-950 flex flex-col">
            {/* Header */}
            <div className="border-b border-zinc-200 dark:border-zinc-800 px-5 py-3 flex items-center gap-4 bg-white dark:bg-zinc-950 shrink-0">
              <span className="text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-3 py-1.5 rounded-full">← Back</span>
              <span className="text-sm font-bold">Gamma<span className="text-violet-500">Meet</span></span>
            </div>

            {/* Body */}
            <div className="flex flex-col md:flex-row" style={{ minHeight: 680 }}>
              {/* Sidebar */}
              <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-5 bg-white dark:bg-zinc-950">
                <div>
                  <p className="font-bold text-sm text-zinc-900 dark:text-white leading-snug">GammaMeet Demo Call</p>
                  <p className="text-xs text-zinc-400 mt-1">Today · 10:00 AM · 18m</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Attendees</p>
                  {[
                    { name: "Alex Chen", color: "bg-violet-500" },
                    { name: "Maria Santos", color: "bg-blue-500" },
                  ].map(({ name, color }) => (
                    <div key={name} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg">
                      <span className={`w-6 h-6 shrink-0 rounded-full ${color} text-white text-xs flex items-center justify-center font-bold`}>{name[0]}</span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate">{name}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Summary</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">Walked through GammaMeet's core flow — bot joins, transcribes, and generates a Gamma deck automatically sent to all attendees.</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Action Items</p>
                  <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                    <li>· Try GammaMeet on your next call</li>
                    <li>· Share deck with your team</li>
                  </ul>
                </div>
              </div>

              {/* Deck — real Gamma-generated PDF */}
              <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 p-3 flex items-start">
                <embed
                  src="https://assets.api.gamma.app/export/pdf/x88ri04n589zwla/a6351862baac166bfb4401d5674269c1/GammaMeet-Every-Meeting-Beautifully-Decked.pdf#toolbar=0&navpanes=0&scrollbar=0&statusbar=0"
                  type="application/pdf"
                  className="w-full rounded-xl"
                  style={{ height: 650 }}
                />
              </div>
            </div>
          </div>
        </div>
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
                title: "GammaMeet Notetaker joins",
                desc: "A bot joins your Google Meet automatically — just hit Admit when it knocks. For last-minute calls, add it manually.",
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

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6 text-center text-zinc-400 text-sm space-x-4">
        <span>© {new Date().getFullYear()} GammaMeet</span>
        <a href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Privacy</a>
        <a href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Terms</a>
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
