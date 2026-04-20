"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    ),
    label: "Your meeting",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21a48.309 48.309 0 01-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
    label: "Bot joins",
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    ),
    label: "Transcribed",
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    label: "Deck generated",
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    label: "Emailed to all",
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800",
  },
];

export function FlowAnimation() {
  const [active, setActive] = useState(0);
  const [flowing, setFlowing] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function advance() {
      setActive((prev) => {
        const next = (prev + 1) % STEPS.length;
        // Animate connector before next step
        if (next > 0) {
          setFlowing((f) => [...f, next - 1]);
          setTimeout(() => {
            setFlowing((f) => f.filter((i) => i !== next - 1));
          }, 600);
        }
        return next;
      });
    }

    // Kick off loop: first step immediately, then every 1.4s
    setActive(0);
    timerRef.current = setInterval(advance, 1400);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center gap-0 min-w-max mx-auto w-fit">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center">
            {/* Node */}
            <div
              className={`flex flex-col items-center gap-3 transition-all duration-500 ${
                active === i ? "scale-110" : "scale-100 opacity-60"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 ${
                  active === i
                    ? `${step.bg} ${step.border} shadow-lg`
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <span className={`transition-colors duration-500 ${active === i ? step.color : "text-zinc-400"}`}>
                  {step.icon}
                </span>
              </div>
              <span
                className={`text-xs font-semibold whitespace-nowrap transition-colors duration-500 ${
                  active === i ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-600"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div className="relative w-16 h-1 mx-1 mb-6 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full bg-violet-500 transition-all duration-500 ${
                    flowing.includes(i) ? "w-full" : active > i ? "w-full opacity-40" : "w-0"
                  }`}
                />
                {flowing.includes(i) && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shimmer_0.6s_ease-in-out]" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
