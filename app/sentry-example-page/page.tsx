"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  const [serverStatus, setServerStatus] = useState<string>("");
  const [clientStatus, setClientStatus] = useState<string>("");

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white p-8">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Sentry test page</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Trigger sample errors to verify Sentry is receiving events. Remove this page after verification.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold">Client error</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Throws a handled error via Sentry.captureException.
          </p>
          <button
            onClick={() => {
              try {
                throw new Error("Sentry client test — " + new Date().toISOString());
              } catch (err) {
                const id = Sentry.captureException(err);
                setClientStatus(`Sent. Event ID: ${id}`);
              }
            }}
            className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Trigger client error
          </button>
          {clientStatus && <p className="text-xs text-emerald-600 dark:text-emerald-400 break-all">{clientStatus}</p>}
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold">Server error</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Hits an API route that throws on the server.
          </p>
          <button
            onClick={async () => {
              setServerStatus("Firing…");
              const res = await fetch("/api/sentry-example-api");
              setServerStatus(`Response status: ${res.status} (expect 500 if it worked)`);
            }}
            className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Trigger server error
          </button>
          {serverStatus && <p className="text-xs text-zinc-500 dark:text-zinc-400">{serverStatus}</p>}
        </div>

        <p className="text-xs text-zinc-400">
          After firing, check your Sentry Issues tab. Both errors should appear within ~60s.
        </p>
      </div>
    </main>
  );
}
