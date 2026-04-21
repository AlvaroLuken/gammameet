/**
 * Returns a CSS gradient for the date-based card thumbnail tint, or null for today (no tint).
 * Used on both grid and list views so the same meeting looks the same in either layout.
 */
export function dateTint(startTime: string): string | null {
  const start = new Date(startTime);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysAgo = Math.round((today - startDay) / 86400000);
  if (daysAgo <= 0) return null;
  const palette = [
    "linear-gradient(135deg, rgb(251,146,60), rgb(244,63,94))",       // amber → rose
    "linear-gradient(135deg, rgb(52,211,153), rgb(34,211,238))",      // emerald → cyan
    "linear-gradient(135deg, rgb(167,139,250), rgb(244,114,182))",    // violet → pink
    "linear-gradient(135deg, rgb(96,165,250), rgb(139,92,246))",      // blue → violet
    "linear-gradient(135deg, rgb(251,191,36), rgb(251,146,60))",      // yellow → amber
    "linear-gradient(135deg, rgb(244,114,182), rgb(251,146,60))",     // pink → amber
    "linear-gradient(135deg, rgb(34,211,238), rgb(167,139,250))",     // cyan → violet
  ];
  return palette[(daysAgo - 1) % palette.length];
}
