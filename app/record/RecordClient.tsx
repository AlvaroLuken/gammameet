"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

type Phase = "setup" | "recording" | "uploading" | "processing" | "error";

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function RecordClient({ userName }: { userName: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [consent, setConsent] = useState(false);
  const [captureTab, setCaptureTab] = useState(false);
  const [title, setTitle] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => stopAllTracks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAllTracks() {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    tickTimerRef.current = null;
    for (const s of streamsRef.current) s.getTracks().forEach((t) => t.stop());
    streamsRef.current = [];
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
  }

  async function handleStart() {
    setError(null);
    try {
      // Disable browser-side processing so speakerphone audio (other party) isn't
      // cancelled out as "echo". Raw mic captures everything the room hears.
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamsRef.current.push(micStream);

      let mergedStream = micStream;

      if (captureTab) {
        try {
          // getDisplayMedia requires video:true to request audio. We immediately
          // drop the video tracks; only the tab's audio matters.
          const display = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          streamsRef.current.push(display);
          display.getVideoTracks().forEach((t) => t.stop());

          const tabAudioTracks = display.getAudioTracks();
          if (tabAudioTracks.length === 0) {
            setStatusNote("Tab audio wasn't shared — recording mic only. Pick a tab and check 'Share tab audio' next time.");
          } else {
            // Mix mic + tab audio into a single stream via Web Audio API
            const ctx = new AudioContext();
            audioContextRef.current = ctx;
            const destination = ctx.createMediaStreamDestination();
            ctx.createMediaStreamSource(micStream).connect(destination);
            ctx.createMediaStreamSource(new MediaStream([tabAudioTracks[0]])).connect(destination);
            mergedStream = destination.stream;
          }
        } catch (err) {
          // User cancelled the tab picker — proceed with mic only
          console.warn("Tab audio capture cancelled or denied:", err);
        }
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(mergedStream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => void finalizeAndUpload();
      mediaRecorderRef.current = recorder;
      recorder.start(1000); // 1s timeslice — keeps chunks flushing in case of crash

      startTimeRef.current = Date.now();
      setElapsed(0);
      tickTimerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
      setPhase("recording");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("denied") || msg.includes("NotAllowed")) {
        setError("Microphone access was denied. Enable it in your browser site settings and try again.");
      } else {
        setError(`Couldn't start recording: ${msg}`);
      }
      setPhase("error");
      stopAllTracks();
    }
  }

  function handleStop() {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    tickTimerRef.current = null;
  }

  async function finalizeAndUpload() {
    setPhase("uploading");
    setStatusNote("Uploading audio…");
    try {
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type ?? "audio/webm" });
      stopAllTracks();

      if (blob.size < 10_000) {
        throw new Error("Recording is too short — nothing was captured.");
      }

      // 1. Ask backend for meeting row + signed upload URL
      const startRes = await fetch("/api/record/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!startRes.ok) {
        const body = await startRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create recording");
      }
      const { meetingId, uploadUrl } = await startRes.json();

      // 2. Upload directly to Supabase Storage
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": blob.type || "audio/webm" },
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

      setPhase("processing");
      setStatusNote("Transcribing and generating deck — this can take a minute.");

      // 3. Kick off transcription + deck generation
      const processRes = await fetch(`/api/record/process/${meetingId}`, { method: "POST" });
      if (!processRes.ok) {
        const body = await processRes.json().catch(() => ({}));
        if (body.error === "empty_transcript") {
          throw new Error("No conversation detected in the recording — nothing to summarize.");
        }
        throw new Error(body.error ?? "Transcription failed");
      }

      router.push(`/meetings/${meetingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  function resetToSetup() {
    stopAllTracks();
    setError(null);
    setStatusNote(null);
    setPhase("setup");
    chunksRef.current = [];
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white transition-colors flex flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 md:px-8 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-xl">← GammaMeet</Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-start justify-center p-6 md:p-12">
        <div className="w-full max-w-xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Record any call</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Signed in as {userName}. Capture audio from any call — Signal, WhatsApp, phone, Zoom — and Jim will turn it into a deck.
            </p>
          </div>

          {phase === "setup" && (
            <SetupCard
              consent={consent}
              setConsent={setConsent}
              captureTab={captureTab}
              setCaptureTab={setCaptureTab}
              title={title}
              setTitle={setTitle}
              onStart={handleStart}
            />
          )}

          {phase === "recording" && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 space-y-6 text-center">
              <div className="flex items-center justify-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium text-red-500 uppercase tracking-widest">Recording</span>
              </div>
              <div className="text-6xl font-mono font-bold tabular-nums">{formatElapsed(elapsed)}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {captureTab ? "Mic + tab audio" : "Mic only — put your call on speakerphone"}
              </p>
              <button
                onClick={handleStop}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors cursor-pointer"
              >
                ■ Stop recording
              </button>
            </div>
          )}

          {(phase === "uploading" || phase === "processing") && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 space-y-4 text-center">
              <div className="flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="font-semibold">{phase === "uploading" ? "Uploading audio…" : "Generating your deck…"}</p>
              {statusNote && <p className="text-sm text-zinc-500 dark:text-zinc-400">{statusNote}</p>}
            </div>
          )}

          {phase === "error" && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-6 space-y-4">
              <p className="font-semibold text-red-700 dark:text-red-300">Something went wrong</p>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={resetToSetup}
                className="text-sm font-semibold text-red-700 dark:text-red-300 hover:underline cursor-pointer"
              >
                ← Try again
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SetupCard({
  consent,
  setConsent,
  captureTab,
  setCaptureTab,
  title,
  setTitle,
  onStart,
}: {
  consent: boolean;
  setConsent: (v: boolean) => void;
  captureTab: boolean;
  setCaptureTab: (v: boolean) => void;
  title: string;
  setTitle: (v: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Call with Fabrice"
          className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Audio source</label>
        <label className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 cursor-pointer">
          <input
            type="checkbox"
            checked={captureTab}
            onChange={(e) => setCaptureTab(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm">
            <span className="font-semibold block">Also capture a browser tab&apos;s audio</span>
            <span className="text-zinc-500 dark:text-zinc-400 text-xs">
              For in-browser calls (Signal Web, WhatsApp Web, Meet, Zoom Web). You&apos;ll pick the tab when recording starts. Chrome/Edge desktop only.
            </span>
          </span>
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 px-1">
          For phone or native-app calls: put the call on speakerphone — the mic will pick it up.
        </p>
      </div>

      <div className="space-y-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-xs text-amber-900 dark:text-amber-200">
            I confirm every person on this call has agreed to be recorded. Recording without consent is illegal in many US states and most of the EU.
          </span>
        </label>
      </div>

      <button
        onClick={onStart}
        disabled={!consent}
        className="w-full py-3 bg-violet-500 hover:bg-violet-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors cursor-pointer"
      >
        ● Start recording
      </button>
    </div>
  );
}
