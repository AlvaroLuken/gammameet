"use client";

import { useState } from "react";

interface Props {
  initial: { showUpcoming: boolean; showProcessing: boolean; showFailed: boolean };
}

export function DashboardPreferences({ initial }: Props) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof typeof prefs) =>
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

  const options = [
    { key: "showUpcoming" as const, label: "Upcoming meetings", desc: "Meetings with a bot scheduled that haven't started yet" },
    { key: "showProcessing" as const, label: "Generating", desc: "Meetings currently being transcribed and turned into a deck" },
    { key: "showFailed" as const, label: "Failed", desc: "Meetings where deck generation didn't complete" },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-lg">Dashboard preferences</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Choose what to show on your dashboard by default.</p>
      </div>

      <div className="flex flex-col gap-3">
        {options.map(({ key, label, desc }) => (
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
