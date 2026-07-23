"use client";

import { useState } from "react";
import { cx } from "@/lib/format";

/** Collapsible DOT-source panel with copy-to-clipboard. */
export function DotSource({
  dot,
  defaultOpen = false,
  className,
}: {
  dot: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(dot);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className={cx("overflow-hidden rounded-lg border border-line bg-surface", className)}>
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 font-mono text-xs text-muted hover:text-fg"
          aria-expanded={open}
        >
          <span className="text-cyan">{open ? "▾" : "▸"}</span>
          DOT source
        </button>
        <button
          onClick={copy}
          className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      {open && (
        <pre className="max-h-80 overflow-auto bg-void/60 p-4 text-xs leading-relaxed">
          <code className="font-mono text-blueprint-ink">{dot}</code>
        </pre>
      )}
    </div>
  );
}
