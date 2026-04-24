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

  const [micLevel, setMicLevel] = useState(0);
  const [tabLevel, setTabLevel] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const tabAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => stopAllTracks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAllTracks() {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    tickTimerRef.current = null;
    if (meterRafRef.current !== null) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    for (const s of streamsRef.current) s.getTracks().forEach((t) => t.stop());
    streamsRef.current = [];
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    micAnalyserRef.current = null;
    tabAnalyserRef.current = null;
    setMicLevel(0);
    setTabLevel(null);
  }

  /** RMS of time-domain data, normalized 0–1 then soft-knee mapped to feel louder at low volume. */
  function readLevel(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
    analyser.getByteTimeDomainData(buf);
    let sumSq = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / buf.length);
    // Perceptual curve — linear RMS looks dead at normal speech levels
    return Math.min(1, Math.pow(rms, 0.5) * 1.8);
  }

  function startMeterLoop() {
    const micBuf = new Uint8Array(new ArrayBuffer(1024));
    const tabBuf = new Uint8Array(new ArrayBuffer(1024));
    const tick = () => {
      if (micAnalyserRef.current) setMicLevel(readLevel(micAnalyserRef.current, micBuf));
      if (tabAnalyserRef.current) setTabLevel(readLevel(tabAnalyserRef.current, tabBuf));
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);
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

      // Single AudioContext used for both metering (analysers) and stream mixing
      // when tab audio is enabled.
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const destination = ctx.createMediaStreamDestination();

      const micSource = ctx.createMediaStreamSource(micStream);
      const micAnalyser = ctx.createAnalyser();
      micAnalyser.fftSize = 2048;
      micSource.connect(micAnalyser);
      micSource.connect(destination);
      micAnalyserRef.current = micAnalyser;

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
            setStatusNote("Tab audio wasn't shared — recording mic only. Next time, pick a Chrome Tab and check 'Share tab audio' at the bottom of the picker.");
          } else {
            const tabStream = new MediaStream([tabAudioTracks[0]]);
            const tabSource = ctx.createMediaStreamSource(tabStream);
            const tabAnalyser = ctx.createAnalyser();
            tabAnalyser.fftSize = 2048;
            tabSource.connect(tabAnalyser);
            tabSource.connect(destination);
            tabAnalyserRef.current = tabAnalyser;
            setTabLevel(0); // initialize so the meter UI renders
          }
        } catch (err) {
          // User cancelled the tab picker — proceed with mic only
          console.warn("Tab audio capture cancelled or denied:", err);
        }
      }

      const mergedStream = destination.stream;
      startMeterLoop();

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

              <div className="space-y-3 text-left">
                <LevelMeter label="Mic" level={micLevel} hint="Should move when anyone talks — including speaker audio reaching your mic." />
                {tabLevel !== null && (
                  <LevelMeter label="Tab audio" level={tabLevel} hint="Should move when the shared tab plays sound." />
                )}
                {micLevel < 0.03 && elapsed > 3 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                    ⚠ Mic is silent. Check macOS mic input (Control Center → Mic Mode → Standard) and that the right input device is selected.
                  </p>
                )}
              </div>

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

function LevelMeter({ label, level, hint }: { label: string; level: number; hint: string }) {
  const pct = Math.round(level * 100);
  const barColor =
    level < 0.05 ? "bg-zinc-300 dark:bg-zinc-700"
    : level < 0.6 ? "bg-emerald-500"
    : "bg-amber-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{label}</span>
        <span className="text-zinc-400 dark:text-zinc-500 tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-[width] duration-75`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-500">{hint}</p>
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
