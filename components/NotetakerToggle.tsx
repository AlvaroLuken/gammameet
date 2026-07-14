"use client";

import { useState } from "react";

export function NotetakerToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStateTo = async (next: boolean) => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/notetaker", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setSaving(false);
    if (res.ok) {
      setEnabled(next);
    } else {
      setError("Something went wrong. Please try again or email hello@gamma-meet.com.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {enabled ? "Notetaker is on" : "Notetaker is off"}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
            {enabled
              ? "GammaMeet schedules the notetaker to join your calendar meetings with a Google Meet link."
              : "GammaMeet won't schedule the notetaker for any of your meetings. Turning it off also cancels any bot already queued on a meeting where you're the only attendee."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle meeting notetaker"
          disabled={saving}
          onClick={() => setStateTo(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 cursor-pointer ${
            enabled ? "bg-violet-600" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
