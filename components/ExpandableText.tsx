"use client";

import { useEffect, useRef, useState } from "react";

export function ExpandableText({ text, lines = 3 }: { text: string; lines?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text, lines]);

  return (
    <div className="space-y-1.5">
      <p
        ref={ref}
        className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed"
        style={expanded ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {text}
      </p>
      {overflowing && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-xs font-semibold text-violet-500 hover:text-violet-400 transition-colors cursor-pointer"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
