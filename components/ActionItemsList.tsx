"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Parses a flat action-items text (one bullet per line, lines starting with
 * "Name: task") and renders grouped by owner with bold names + per-person
 * bullet lists. Falls back to "General" for lines without a name.
 */
export function ActionItemsList({ text, maxHeight = 180 }: { text: string; maxHeight?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const groups = parseGroups(text);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    setOverflowing(content.scrollHeight > maxHeight + 2);
  }, [text, maxHeight]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div
        ref={wrapperRef}
        className="overflow-hidden transition-all"
        style={expanded ? undefined : { maxHeight }}
      >
        <div ref={contentRef} className="space-y-3">
          {groups.map(({ name, tasks }) => (
            <div key={name}>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{name}</p>
              <ul className="mt-1 space-y-1">
                {tasks.map((task, i) => (
                  <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed flex gap-2">
                    <span className="text-zinc-400 dark:text-zinc-600 shrink-0 mt-0.5">•</span>
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
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

function parseGroups(text: string): { name: string; tasks: string[] }[] {
  const map = new Map<string, string[]>();
  const order: string[] = [];

  for (const raw of text.split("\n")) {
    const stripped = raw.trim().replace(/^[·•\-*]\s*/, "");
    if (!stripped) continue;

    const colonIdx = stripped.indexOf(":");
    let name: string;
    let task: string;

    // Only treat as "Name: task" when the prefix is short enough to be a name
    if (colonIdx > 0 && colonIdx < 40) {
      name = stripped.slice(0, colonIdx).trim();
      task = stripped.slice(colonIdx + 1).trim();
      if (!task) {
        name = "General";
        task = stripped;
      }
    } else {
      name = "General";
      task = stripped;
    }

    if (!map.has(name)) {
      map.set(name, []);
      order.push(name);
    }
    map.get(name)!.push(task);
  }

  return order.map((name) => ({ name, tasks: map.get(name)! }));
}
