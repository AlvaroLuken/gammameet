"use client";

import { useState } from "react";

export function DeleteAccountButton() {
  const [step, setStep] = useState<"idle" | "confirm" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setStep("deleting");
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      window.location.href = "/";
    } else {
      setError("Something went wrong. Please try again or email hello@gamma-meet.com.");
      setStep("confirm");
    }
  };

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="text-sm text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
      >
        Delete account
      </button>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This will permanently delete your account and all associated decks. This cannot be undone.
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            className="text-sm text-white bg-red-600 hover:bg-red-500 font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Yes, delete my account
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

  return <p className="text-sm text-zinc-400">Deleting your account…</p>;
}
