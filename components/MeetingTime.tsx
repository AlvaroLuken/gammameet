"use client";

export function MeetingTime({ startTime }: { startTime: string }) {
  const d = new Date(startTime);

  const date = d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="space-y-0.5">
      <p className="text-zinc-500 dark:text-zinc-400 text-sm">{date}</p>
      <p className="text-zinc-400 dark:text-zinc-500 text-sm">
        {time} <span className="text-xs">({tz})</span>
      </p>
    </div>
  );
}
