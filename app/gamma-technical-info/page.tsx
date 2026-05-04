import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MadeWithGammaBadge } from "@/components/MadeWithGammaBadge";

export const metadata: Metadata = {
  title: "Gamma API — Technical Info — GammaMeet",
  description: "How GammaMeet integrates with the Gamma public API: endpoints, request/response shapes, and where each call fires in the pipeline.",
};

const REQUEST_BODY = `{
  "inputText": "<meeting title>\\n\\n<Claude-distilled brief or raw transcript>",
  "textMode": "generate",
  "format": "presentation",
  "numCards": 8,
  "exportAs": "pdf",
  "cardOptions": {
    "dimensions": "16x9"
  },
  "imageOptions": {
    "source": "aiGenerated",
    "stylePreset": "abstract",
    "style": "minimal abstract shapes and gradients, no people, no faces, no characters, no office scenes, muted professional colors, editorial"
  },
  "sharingOptions": {
    "externalAccess": "view"
  }
}`;

const REQUEST_HEADERS = `POST https://public-api.gamma.app/v1.0/generations
Content-Type: application/json
X-API-KEY: <GAMMA_API_KEY>`;

const POST_RESPONSE = `{
  "generationId": "01J..."
}`;

const POLL_REQUEST = `GET https://public-api.gamma.app/v1.0/generations/{generationId}
X-API-KEY: <GAMMA_API_KEY>`;

const POLL_RESPONSE = `{
  "status": "completed",
  "gammaUrl": "https://gamma.app/docs/<slug>",
  "exportUrl": "https://assets.api.gamma.app/export/pdf/<slug>/.../<title>.pdf"
}`;

export default function GammaTechnicalInfoPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 md:px-8 py-5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold hover:opacity-80 transition-opacity">
          Gamma<span className="text-violet-500">Meet</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-8 py-12 md:py-16 space-y-10 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-500">Technical Info</p>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">How GammaMeet uses the Gamma API</h1>
          <p>
            GammaMeet&apos;s entire output is a Gamma deck — generated automatically the moment a meeting ends. This page documents
            exactly how that integration works: which endpoints we hit, what JSON we send, and where in the pipeline each call fires.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Endpoints used</h2>
          <p>We use two endpoints from the public Gamma API at <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">public-api.gamma.app/v1.0</code>:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">POST /generations</code> — kicks off a deck generation from a text brief.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">GET /generations/&#123;id&#125;</code> — polls until the generation is <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">completed</code> or <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">failed</code>.</li>
          </ul>
          <p>Both calls live in <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">lib/gamma.ts</code>, behind a single <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">generateGammaPage(title, content, numCards)</code> helper. Authentication is the <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">X-API-KEY</code> header on every request.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Where it fires in the pipeline</h2>
          <p><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">generateGammaPage</code> is called from four entry points:</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li><strong className="text-zinc-700 dark:text-zinc-300">Recall webhook</strong> (<code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">app/api/webhook/recall/route.ts</code>) — when Recall.ai notifies us that the bot has finished and the transcript is ready.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Ambient recording processing</strong> (<code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">app/api/record/process/[id]/route.ts</code>) — when a user&apos;s browser-recorded audio finishes uploading and Deepgram returns the transcript.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Regenerate</strong> (<code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">app/api/meetings/[id]/regenerate/route.ts</code>) — when the user clicks &quot;Regenerate deck&quot; in the actions menu.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Fathom webhook</strong> (<code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">app/api/webhook/fathom/route.ts</code>) — for users who connect Fathom as the meeting source.</li>
          </ol>
          <p>In every case the input passed to Gamma is a structured markdown brief produced by Claude (the <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">gammaBrief</code> field of the meeting brief), with a fallback to the raw transcript if Claude&apos;s call fails.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">1. Kick off a generation</h2>
          <p>The full request:</p>
          <pre className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 overflow-x-auto whitespace-pre font-mono">{REQUEST_HEADERS}</pre>
          <pre className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 overflow-x-auto whitespace-pre font-mono">{REQUEST_BODY}</pre>
          <p>Field-by-field:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">inputText</code> — the title and Claude-generated structured brief, joined with a blank line. Gamma uses this as the source material for the deck.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">textMode: &quot;generate&quot;</code> — tells Gamma to <em>compose</em> slide content from the input rather than treating the input as final slide text verbatim.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">format: &quot;presentation&quot;</code> — produces a deck (vs. document or webpage).</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">numCards</code> — the slide count. Claude recommends 4–14 dynamically based on meeting density (default fallback is 8). We clamp to 4–14 in <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">lib/gamma.ts</code> because anything outside that range produces visibly bad meeting decks even though Gamma accepts 1–60.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">exportAs: &quot;pdf&quot;</code> — asks Gamma to also produce a PDF on completion. We surface this as the &quot;Download PDF&quot; action in the meeting view.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">cardOptions.dimensions: &quot;16x9&quot;</code> — widescreen, the standard for shareable decks.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">imageOptions</code> — AI-generated images, abstract preset, with a free-form <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">style</code> string that explicitly forbids people/faces/office scenes. The preset alone wasn&apos;t enough to keep Gamma from inventing fake stock photos of fake meeting participants — the negative-prompt-style guidance fixed that.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">sharingOptions.externalAccess: &quot;view&quot;</code> — non-Gamma users (anyone with the share link) can view the deck without signing into Gamma. Required for the public <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">/share/[id]</code> view to work.</li>
          </ul>
          <p>The response is short — a generation ID we&apos;ll poll on:</p>
          <pre className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 overflow-x-auto whitespace-pre font-mono">{POST_RESPONSE}</pre>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">2. Poll until done</h2>
          <p>Gamma generations are async. We poll every 5 seconds for up to 24 attempts (2 minutes total) before surfacing a timeout error:</p>
          <pre className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 overflow-x-auto whitespace-pre font-mono">{POLL_REQUEST}</pre>
          <p>The successful response gives us the two URLs we persist on the meeting row:</p>
          <pre className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 overflow-x-auto whitespace-pre font-mono">{POLL_RESPONSE}</pre>
          <ul className="list-disc list-inside space-y-1.5">
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">gammaUrl</code> → stored in <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">meetings.gamma_url</code>. Used for the &quot;Open in Gamma&quot; action and as the share-link target.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">exportUrl</code> → stored in <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">meetings.export_url</code>. Used for the in-app PDF viewer (<code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">DeckViewer</code>) and the &quot;Download PDF&quot; button.</li>
          </ul>
          <p>Status values we handle:</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">completed</code> with a <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">gammaUrl</code> — done, return the result.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">failed</code> — throw immediately. The outer pipeline catches it, marks the meeting as failed, and surfaces a retry button.</li>
            <li>Anything else (typically <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">processing</code> / pending) — wait 5 seconds and poll again.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">3. Preview image</h2>
          <p>Gamma doesn&apos;t return a thumbnail directly in the API response. We fetch <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">gammaUrl</code> server-side, parse the <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">og:image</code> meta tag from the HTML, and store that as <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">meetings.preview_image</code>. The dashboard cards, the recap email, and the mobile fallback all use this image. If parsing fails the field stays null and the UI falls back to a generic placeholder.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Failure handling</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-zinc-700 dark:text-zinc-300">Non-2xx on POST</strong> — throws with the response body. Caller marks the meeting <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">failed</code>, releases its processing claim, and exits.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Generation status: failed</strong> — same treatment.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Polling timeout</strong> — after 2 minutes we throw a timeout error. Same treatment.</li>
            <li><strong className="text-zinc-700 dark:text-zinc-300">Sentry capture</strong> — every throw bubbles to <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">process_meeting_throw</code> in Sentry with the meeting id and source pipeline tagged.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Where to look in the code</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">lib/gamma.ts</code> — the entire integration: the POST request body, the polling loop, and the og:image scrape.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">lib/recall.ts</code> — produces the structured <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">gammaBrief</code> markdown that becomes Gamma&apos;s <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">inputText</code>, plus the dynamic <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">numCards</code> recommendation.</li>
            <li><code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">app/api/webhook/recall/route.ts</code>, <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">app/api/record/process/[id]/route.ts</code>, <code className="text-xs bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">app/api/meetings/[id]/regenerate/route.ts</code> — the call sites.</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6 text-center text-zinc-400 text-sm space-y-3">
        <div className="space-x-4">
          <Link href="/profile" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Profile</Link>
          <Link href="/faq" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">FAQ</Link>
          <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Terms</Link>
        </div>
        <div className="flex justify-center">
          <MadeWithGammaBadge />
        </div>
      </footer>
    </div>
  );
}
