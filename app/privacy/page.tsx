import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy — GammaMeet" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 md:px-8 py-5">
        <Link href="/" className="text-xl font-bold hover:opacity-80 transition-opacity">
          Gamma<span className="text-violet-500">Meet</span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 md:px-8 py-12 md:py-16 space-y-8 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Privacy Policy</h1>
          <p className="text-zinc-400">Last updated: April 19, 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">What is GammaMeet?</h2>
          <p>GammaMeet is a service that automatically records your meetings, generates a transcript, and turns it into an AI-powered presentation deck that is shared with all meeting attendees.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Information we collect</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong className="text-zinc-700 dark:text-zinc-300">Google account info</strong> — your name, email address, and profile photo when you sign in.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Google Calendar data</strong> — we read your calendar to find upcoming meetings with video links so we can schedule a recording bot. We only read event titles, times, attendees, and meet links.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Meeting recordings and transcripts</strong> — audio is recorded and transcribed during meetings where GammaMeet Notetaker has been admitted. Transcripts are used solely to generate your presentation deck.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Meeting metadata</strong> — titles, dates, attendee email addresses.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">How we use your information</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>To identify upcoming meetings and schedule a recording bot.</li>
            <li>To generate an AI presentation deck from the meeting transcript.</li>
            <li>To email the deck to all meeting attendees.</li>
            <li>We do not sell your data to third parties.</li>
            <li>We do not use your data to train AI models.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Third-party services</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong className="text-zinc-700 dark:text-zinc-300">Recall.ai</strong> — provides the meeting bot infrastructure that joins and records meetings.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Gladia</strong> — provides speech-to-text transcription of meeting audio.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Gamma AI</strong> — generates the presentation deck from the meeting transcript.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Resend</strong> — sends recap emails to attendees.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Supabase</strong> — stores meeting metadata and user accounts.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Data retention</h2>
          <p>Meeting transcripts are used to generate your deck and are not stored by GammaMeet beyond what is necessary to provide the service. Generated decks are stored and accessible via your dashboard until you delete them.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Your rights</h2>
          <p>You can delete your account and associated data at any time by contacting us. You can revoke GammaMeet's access to your Google account at any time via your <a href="https://myaccount.google.com/permissions" className="text-violet-500 hover:underline" target="_blank" rel="noopener noreferrer">Google account settings</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Contact</h2>
          <p>Questions? Email us at <a href="mailto:hello@gamma-meet.com" className="text-violet-500 hover:underline">hello@gamma-meet.com</a>.</p>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6 text-center text-zinc-400 text-sm space-x-4">
        <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Terms of Service</Link>
        <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Home</Link>
      </footer>
    </div>
  );
}
