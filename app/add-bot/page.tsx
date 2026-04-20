"use client";

import { useState } from "react";
import Link from "next/link";

export default function AddBotPage() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/add-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUrl: url.trim(), title: title.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Something went wrong");
      }

      setStatus("success");
      setUrl("");
      setTitle("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 md:px-8 py-5 flex items-center gap-4">
        <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm cursor-pointer">
          ← Dashboard
        </Link>
        <Link href="/dashboard" className="text-xl font-bold hover:opacity-80 transition-opacity">
          Gamma<span className="text-violet-500">Meet</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Add bot to meeting</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Paste a Google Meet or Zoom link and the GammaMeet Notetaker will join immediately.
            </p>
          </div>

          {status === "success" ? (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl p-6 space-y-4 text-center">
              <p className="text-2xl">✓</p>
              <p className="font-semibold text-green-700 dark:text-green-400">Bot is on its way!</p>
              <p className="text-sm text-green-600 dark:text-green-500">
                GammaMeet Notetaker will join your meeting in the next minute. Admit it when it knocks.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="text-sm text-green-600 dark:text-green-400 hover:underline cursor-pointer"
              >
                Add another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Meeting link <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Meeting title <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Q4 Planning, Design Review…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-violet-400 dark:focus:border-violet-600 transition-colors"
                />
              </div>

              {status === "error" && (
                <p className="text-sm text-red-500">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === "loading" || !url.trim()}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer"
              >
                {status === "loading" ? "Sending bot…" : "Add GammaMeet Notetaker →"}
              </button>
            </form>
          )}

          <p className="text-xs text-center text-zinc-400 dark:text-zinc-600">
            The bot appears as <span className="font-medium text-zinc-500 dark:text-zinc-500">GammaMeet Notetaker</span> in your meeting. Your deck will be emailed after the call ends.
          </p>
        </div>
      </main>
    </div>
  );
}
