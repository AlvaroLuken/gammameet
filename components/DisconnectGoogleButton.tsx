"use client";

import { useState } from "react";

export function DisconnectGoogleButton() {
  const [step, setStep] = useState<"idle" | "confirm" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleDisconnect = async () => {
    setStep("working");
    setError(null);
    const res = await fetch("/api/auth/google/disconnect", { method: "POST" });
    if (res.ok) {
      window.location.reload();
    } else {
      setError("Something went wrong. Please try again or email hello@gamma-meet.com.");
      setStep("confirm");
    }
  };

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="text-sm text-zinc-500 hover:text-red-500 transition-colors cursor-pointer font-medium"
      >
        Disconnect
      </button>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This revokes GammaMeet&apos;s access to your Google account and stops it from scheduling
          the notetaker on your meetings. Any bot already queued on a meeting where you&apos;re the
          only attendee is cancelled. You can reconnect anytime by signing in again.
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDisconnect}
            className="text-sm text-white bg-red-600 hover:bg-red-500 font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Yes, disconnect
          </button>
          <button
            onClick={() => { setStep("idle"); setError(null); }}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return <p className="text-sm text-zinc-400">Disconnecting…</p>;
}
