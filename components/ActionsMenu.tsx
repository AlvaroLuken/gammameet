"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMeetingRegen } from "./MeetingRegenContext";

interface Props {
  id: string;
  gammaUrl: string | null;
  exportUrl: string | null;
  title?: string;
  hasRecording?: boolean;
}

export function ActionsMenu({ id, gammaUrl, exportUrl, title, hasRecording }: Props) {
  const { setRegenerating: setCtxRegenerating } = useMeetingRegen();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingAudio, setDownloadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
        setConfirmingRegen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1800);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenError(null);
    setRegenerating(true);
    setOpen(false);
    setCtxRegenerating(true);
    try {
      const res = await fetch(`/api/meetings/${id}/regenerate`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRegenError(body.error ?? "Regenerate failed");
        setRegenerating(false);
        // Reload so the old deck shows again instead of the loading state
        window.location.reload();
        return;
      }
      // Success — reload to show the fresh deck + summary/action items
      router.refresh();
      window.location.reload();
    } catch {
      setRegenError("Regenerate failed");
      setRegenerating(false);
      window.location.reload();
    }
  };

  const handleDownloadAudio = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (downloadingAudio) return;
    setAudioError(null);
    setDownloadingAudio(true);
    try {
      const res = await fetch(`/api/meetings/${id}/audio`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setAudioError(body.reason ?? "Recording is no longer available.");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${(title ?? "recording").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error("Audio download failed:", err);
      setAudioError("Recording download failed.");
    } finally {
      setDownloadingAudio(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!exportUrl || downloading) return;
    setDownloading(true);
    try {
      // Fetch through our proxy so the PDF is same-origin → browser respects
      // the `download` attribute instead of navigating the page to the PDF.
      const res = await fetch(`/api/deck-proxy?url=${encodeURIComponent(exportUrl)}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${(title ?? "deck").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a tick to start the download, then revoke
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
      setOpen(false);
    }
  };

  return (
    <div ref={menuRef} className="relative mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
      <button
        onClick={() => { setOpen((o) => !o); setConfirming(false); }}
        className="w-full inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
      >
        Actions
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
          {gammaUrl && (
            <a
              href={gammaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="text-violet-500">↗</span>
              Open in Gamma
            </a>
          )}
          {exportUrl && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800 cursor-pointer disabled:opacity-50"
            >
              <span>↓</span>
              {downloading ? "Downloading…" : "Download PDF"}
            </button>
          )}
          {hasRecording && (
            <>
              <button
                onClick={handleDownloadAudio}
                disabled={downloadingAudio}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800 cursor-pointer disabled:opacity-50"
              >
                <span>♪</span>
                {downloadingAudio ? "Downloading…" : "Download audio"}
              </button>
              {audioError && (
                <p className="px-4 pb-2 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">{audioError}</p>
              )}
            </>
          )}
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800 cursor-pointer"
          >
            <span>{copied ? "✓" : "⎘"}</span>
            {copied ? "Link copied!" : "Copy share link"}
          </button>

          <div className="border-t border-zinc-100 dark:border-zinc-800">
            {confirmingRegen ? (
              <div className="flex gap-2 p-2">
                <button
                  onClick={() => { setConfirmingRegen(false); handleRegenerate(); }}
                  disabled={regenerating}
                  className="flex-1 inline-flex items-center justify-center bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {regenerating ? "Regenerating…" : "Confirm regenerate"}
                </button>
                <button
                  onClick={() => setConfirmingRegen(false)}
                  disabled={regenerating}
                  className="inline-flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setConfirmingRegen(true); setConfirming(false); }}
                disabled={regenerating}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="text-violet-500">↻</span>
                {regenerating ? "Regenerating…" : "Regenerate deck"}
              </button>
            )}
          </div>
          {regenError && (
            <p className="px-4 pb-2 text-xs text-red-500 border-t border-zinc-100 dark:border-zinc-800">{regenError}</p>
          )}

          <div className="border-t border-zinc-100 dark:border-zinc-800">
            {confirming ? (
              <div className="flex gap-2 p-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 inline-flex items-center justify-center bg-red-600 hover:bg-red-500 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="inline-flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <span>✕</span>
                Delete deck
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
