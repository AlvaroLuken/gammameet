"use client";

import { useState } from "react";

type ShareMode = "all_attendees" | "me_only";

interface Props {
  initial: { showUpcoming: boolean; showProcessing: boolean; showFailed: boolean; showHidden: boolean; shareMode: ShareMode };
}

export function DashboardPreferences({ initial }: Props) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key: "showUpcoming" | "showProcessing" | "showFailed" | "showHidden") =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const visibilityOptions = [
    { key: "showUpcoming" as const, label: "Upcoming meetings", desc: "Meetings with a bot scheduled that haven't started yet" },
    { key: "showProcessing" as const, label: "Generating", desc: "Meetings currently being transcribed and turned into a deck" },
    { key: "showFailed" as const, label: "Failed", desc: "Meetings where deck generation didn't complete" },
    { key: "showHidden" as const, label: "Hidden", desc: "Meetings you've dismissed — toggle on to see them and unhide" },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Dashboard preferences</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Choose what to show on your dashboard by default.</p>
      </div>

      <div className="flex flex-col gap-3">
        {visibilityOptions.map(({ key, label, desc }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="flex items-start gap-3 text-left w-full group cursor-pointer"
          >
            <span className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
              prefs[key]
                ? "bg-violet-600 border-violet-600"
                : "border-zinc-300 dark:border-zinc-600 group-hover:border-violet-400"
            }`}>
              {prefs[key] && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">{label}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
        <div>
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">Who receives the deck</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            By default we send to everyone on the call. Switch to "Just me" to keep recaps private.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["all_attendees", "me_only"] as const).map((mode) => {
            const isActive = prefs.shareMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setPrefs((p) => ({ ...p, shareMode: mode }))}
                className={`text-sm font-medium px-3 py-2.5 rounded-xl transition-colors cursor-pointer border ${
                  isActive
                    ? "bg-violet-50 dark:bg-violet-950 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-violet-300 dark:hover:border-violet-700"
                }`}
              >
                {mode === "all_attendees" ? "All attendees" : "Just me"}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl transition-colors cursor-pointer"
      >
        {saving ? "Saving…" : saved ? "Saved!" : "Save preferences"}
      </button>
    </div>
  );
}
