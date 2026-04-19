"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteMeetingButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  };

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? "Deleting…" : "Confirm delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="inline-flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm px-3 py-2 rounded-xl transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center justify-center text-zinc-400 hover:text-red-500 dark:hover:text-red-400 text-sm transition-colors cursor-pointer"
    >
      Delete deck
    </button>
  );
}
