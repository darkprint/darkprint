"use client";

import { useState } from "react";
import { cx } from "@/lib/format";

/**
 * A verbatim source document — DOT, YAML, JSON — with line numbers, a copy button
 * and an optional download. The registry's whole claim is that a blueprint can be
 * read rather than trusted, so the raw bytes are always one click away.
 */
export function SourcePanel({
  source,
  language,
  title,
  meta,
  downloadName,
  collapsible = false,
  defaultOpen = true,
  className,
}: {
  source: string;
  /** Shown in the panel header, e.g. "DOT" or "YAML". */
  language: string;
  /** Optional header label, defaults to `${language} source`. */
  title?: string;
  /** Optional mono metadata shown right-aligned in the header, e.g. a digest. */
  meta?: string;
  /** Filename offered by the download button; omit for no download. */
  downloadName?: string;
  /** Render the header label as a disclosure toggle. */
  collapsible?: boolean;
  /** Only meaningful when `collapsible`. */
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);
  const [copied, setCopied] = useState(false);

  const label = title ?? `${language} source`;
  const lines = source.split("\n");
  const href = `data:text/plain;charset=utf-8,${encodeURIComponent(source)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className={cx("overflow-hidden rounded-lg border border-line bg-surface", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-2 font-mono text-xs text-muted transition-colors hover:text-fg"
          >
            <span className="text-cyan" aria-hidden>
              {open ? "▾" : "▸"}
            </span>
            {label}
          </button>
        ) : (
          <span className="flex items-center gap-2 font-mono text-xs text-muted">
            <span className="text-cyan" aria-hidden>
              ▤
            </span>
            {label}
          </span>
        )}

        <div className="flex items-center gap-2">
          {meta !== undefined && meta !== "" && (
            <span className="font-mono text-[11px] text-dim">{meta}</span>
          )}
          {downloadName !== undefined && (
            <a
              href={href}
              download={downloadName}
              aria-label={`Download ${downloadName}`}
              className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
            >
              download
            </a>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label={
              copied
                ? `${language} source copied to the clipboard`
                : `Copy the ${language} source`
            }
            className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
      </div>

      {open && (
        /* The source is taller than the box on almost every card, and nothing inside
           it is focusable, so without a tab stop of its own a keyboard-only reader
           cannot scroll it at all (WCAG 2.1.1). The group carries a name so the stop
           announces what it is rather than landing on an anonymous box. */
        <div
          tabIndex={0}
          role="group"
          aria-label={`${label} — scrollable`}
          className="max-h-80 overflow-auto bg-void/60"
        >
          <pre className="w-max min-w-full p-4 text-xs leading-relaxed">
            <code className="font-mono text-blueprint-ink">
              {lines.map((line, i) => (
                <span key={i} className="flex">
                  <span
                    className="w-10 shrink-0 select-none pr-4 text-right text-dim"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </span>
              ))}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}
