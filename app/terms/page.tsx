import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Service — GammaMeet" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 md:px-8 py-5">
        <Link href="/" className="text-xl font-bold hover:opacity-80 transition-opacity">
          Gamma<span className="text-violet-500">Meet</span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 md:px-8 py-12 md:py-16 space-y-8 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Terms of Service</h1>
          <p className="text-zinc-400">Last updated: April 19, 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Acceptance of Terms</h2>
          <p>By accessing or using GammaMeet, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Description of Service</h2>
          <p>GammaMeet is a service that automatically joins your scheduled video meetings, generates a transcript, and uses that transcript to create an AI-powered presentation deck that is shared with all meeting attendees.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">User Responsibilities</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>You are responsible for obtaining consent from all meeting participants before admitting the GammaMeet Notetaker bot to any meeting.</li>
            <li>You must comply with all applicable laws regarding recording and transcription in your jurisdiction.</li>
            <li>You may not use GammaMeet for any unlawful purpose or in violation of any third-party rights.</li>
            <li>You must not attempt to reverse engineer, disrupt, or gain unauthorized access to the service.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Content and Data</h2>
          <p>You retain ownership of all content generated from your meetings. By using GammaMeet, you grant us a limited license to process your meeting audio and transcript solely to provide the service. We do not sell your data or use it to train AI models.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Third-Party Services</h2>
          <p>GammaMeet integrates with third-party services including Recall.ai, Gladia, Gamma AI, Resend, and Supabase. Your use of GammaMeet is also subject to the terms of these providers. We are not responsible for the actions or omissions of third-party services.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Disclaimers</h2>
          <p>GammaMeet is provided "as is" without warranties of any kind. We do not guarantee that the service will be uninterrupted, error-free, or that transcripts and decks will be accurate. AI-generated content may contain errors — always review generated decks before relying on them.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, GammaMeet shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Account Termination</h2>
          <p>You may delete your account at any time from your <Link href="/profile" className="text-violet-500 hover:underline">profile page</Link>. We reserve the right to suspend or terminate accounts that violate these terms.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Contact</h2>
          <p>Questions? Email us at <a href="mailto:hello@gamma-meet.com" className="text-violet-500 hover:underline">hello@gamma-meet.com</a>.</p>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6 text-center text-zinc-400 text-sm space-x-4">
        <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Privacy Policy</Link>
        <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Home</Link>
      </footer>
    </div>
  );
}
