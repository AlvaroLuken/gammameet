import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/lib/auth";

export const metadata: Metadata = {
  title: "FAQ — GammaMeet",
  description: "Everything you need to know about GammaMeet — the bot, the decks, privacy, pricing, and more.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ — GammaMeet",
    description: "Everything you need to know about GammaMeet.",
    url: "https://www.gamma-meet.com/faq",
  },
};

const SECTIONS = [
  {
    heading: "Getting started",
    items: [
      {
        q: "What is GammaMeet?",
        a: "GammaMeet joins your Google Meet calls as a notetaker, transcribes the conversation, and automatically generates a polished Gamma AI presentation deck that lands in every attendee's inbox the moment the meeting ends.",
      },
      {
        q: "How do I get started?",
        a: "Sign in with Google, approve calendar access, and you're done. GammaMeet will automatically join your scheduled meetings. No extensions, no installs, no configuration.",
      },
      {
        q: "Is it free?",
        a: "Yes — GammaMeet is free to use. You'll need a Google account. No credit card required to start.",
      },
    ],
  },
  {
    heading: "How the bot works",
    items: [
      {
        q: "Will everyone see the bot in my meeting?",
        a: "Yes — a participant called \"Jim from GammaMeet\" joins the call about 2 minutes before start time. Just admit it when it knocks. It's silent, doesn't speak, and shows the GammaMeet logo as its camera.",
      },
      {
        q: "Can I use GammaMeet for a meeting I didn't schedule?",
        a: "Yes. Click \"+ Add bot\" in the dashboard and paste any Google Meet link — GammaMeet will join within seconds, even for meetings that are already in progress.",
      },
      {
        q: "What happens if the bot can't join?",
        a: "If no one admits Jim within a few minutes, the bot leaves gracefully and the meeting won't be processed. You'll see the meeting marked as \"Failed\" in your dashboard so you know to retry.",
      },
      {
        q: "Can I skip a specific meeting?",
        a: "Yes. Delete the scheduled bot from your dashboard before the meeting starts and GammaMeet won't join.",
      },
    ],
  },
  {
    heading: "The deck",
    items: [
      {
        q: "How long does it take to generate a deck?",
        a: "Usually under 2 minutes after the meeting ends. You'll receive an email with a link to your deck as soon as it's ready.",
      },
      {
        q: "Can I edit the deck after it's generated?",
        a: "Absolutely — every deck opens in Gamma, where you can restyle slides, rewrite copy, add images, or change the template. Your edits are saved in your Gamma workspace.",
      },
      {
        q: "What if my meeting has no action items?",
        a: "That's totally fine. Your deck will still cover the key discussion, and the Action Items section will simply note that none were detected. Not every conversation ends with a to-do list.",
      },
      {
        q: "Can I download the deck as a PDF?",
        a: "Yes. Every deck has a one-click \"Download PDF\" action in the sidebar. You can also share a public link with anyone, even people who weren't in the meeting.",
      },
      {
        q: "Who receives the deck by email?",
        a: "Everyone who was actually in the meeting. GammaMeet uses the participant list from the call itself — not just the calendar invite — so only real attendees get the recap.",
      },
    ],
  },
  {
    heading: "Privacy & data",
    items: [
      {
        q: "Is my meeting data private?",
        a: "Yes. Your transcripts and decks are only accessible to you and the people in your meeting. We never train models on your content, and we never share it with third parties for marketing.",
      },
      {
        q: "Where are my recordings stored?",
        a: "Audio is transcribed in real time and not retained after processing. Transcripts and decks are stored securely on our infrastructure (Supabase + Gamma) and are accessible only to authenticated attendees.",
      },
      {
        q: "Can I delete a deck?",
        a: "Yes — click the 3-dot menu on any deck card in your dashboard and hit Delete. The deck and its transcript are removed immediately.",
      },
      {
        q: "Can I delete my account?",
        a: "Yes. Go to Profile → Danger zone → Delete account. This removes your data, decks, and all associations. It's immediate and permanent.",
      },
    ],
  },
  {
    heading: "Compatibility",
    items: [
      {
        q: "Which meeting platforms do you support?",
        a: "GammaMeet currently supports Google Meet. Zoom, Microsoft Teams, and Webex support is on the roadmap — if you need them, reach out.",
      },
      {
        q: "What about meetings without a video link?",
        a: "GammaMeet needs a meeting URL to join — audio-only calls (like Zoom phone or regular phone calls) aren't supported today.",
      },
    ],
  },
];

async function handleSignIn() {
  "use server";
  await signIn("google", { redirectTo: "/dashboard" });
}

export default async function FaqPage() {
  const session = await auth();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SECTIONS.flatMap((s) =>
      s.items.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a },
      }))
    ),
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/" className="text-xl font-bold hover:opacity-80 transition-opacity">
          Gamma<span className="text-violet-500">Meet</span>
        </Link>
        {session ? (
          <Link href="/dashboard" className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2.5 text-sm rounded-full transition-colors cursor-pointer">
            Go to dashboard →
          </Link>
        ) : (
          <form action={handleSignIn}>
            <button type="submit" className="inline-flex items-center gap-2 bg-white text-black font-semibold px-5 py-2.5 text-sm rounded-full hover:bg-zinc-100 transition-colors cursor-pointer">
              Sign in
            </button>
          </form>
        )}
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-8 pt-20 pb-10 text-center space-y-5">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-500">Frequently asked</p>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-none">
          Questions,<br /><span className="text-violet-500">answered.</span>
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
          Everything you need to know about how GammaMeet turns your meetings into beautiful decks — automatically.
        </p>
      </section>

      {/* FAQ sections */}
      <section className="max-w-3xl mx-auto px-8 py-12 space-y-16">
        {SECTIONS.map(({ heading, items }) => (
          <div key={heading} className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">{heading}</h2>
            <div className="space-y-3">
              {items.map(({ q, a }) => (
                <details
                  key={q}
                  className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden"
                >
                  <summary className="flex items-start justify-between gap-4 px-5 py-4 cursor-pointer list-none">
                    <span className="font-semibold text-sm md:text-base text-zinc-900 dark:text-white">{q}</span>
                    <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs flex items-center justify-center group-open:bg-violet-100 dark:group-open:bg-violet-950 group-open:text-violet-500 transition-colors">
                      <span className="group-open:hidden">+</span>
                      <span className="hidden group-open:inline">−</span>
                    </span>
                  </summary>
                  <div className="px-5 pb-5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 py-20 px-8 text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Still have questions?</h2>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          The fastest way to find out is to try GammaMeet on your next meeting. It's free, and you'll have your first deck in minutes.
        </p>
        <form action={handleSignIn}>
          <button type="submit" className="inline-flex items-center gap-3 bg-white text-black font-semibold px-8 py-4 text-lg rounded-full hover:bg-zinc-100 transition-colors cursor-pointer">
            Get started free
          </button>
        </form>
        <p className="text-zinc-400 text-sm">No credit card · Connects to Google Calendar</p>
      </section>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6 text-center text-zinc-400 text-sm space-x-4">
        <span>© {new Date().getFullYear()} GammaMeet</span>
        <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Home</Link>
        <a href="https://www.al-luken.space/#contact" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Feedback</a>
        <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Privacy</Link>
        <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Terms</Link>
      </footer>
    </main>
  );
}
