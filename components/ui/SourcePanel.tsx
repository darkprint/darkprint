"use client";

import { useState } from "react";
import { cx } from "@/lib/format";

/**
 * Wraps the panel's label in an `<h2>` when the caller asked for one, and in nothing
 * at all otherwise.
 *
 * A fragment rather than a `<div>` in the plain case: the header is a flex row and an
 * extra box would take part in its layout. The heading carries no visual style of its
 * own for the same reason — the label inside it already has it.
 */
function Heading({ id, children }: { id?: string; children: React.ReactNode }) {
  if (id === undefined) return <>{children}</>;
  /* No type styling here on purpose: Tailwind's preflight already resets a heading's
     `font-size` and `font-weight` to `inherit`, so the only thing this element needs to
     do is not disturb the flex row it sits in. The label inside carries the style, which
     keeps one decision (`labelClass`) in one place. */
  return (
    <h2 id={id} className="m-0 flex min-w-0 items-center">
      {children}
    </h2>
  );
}

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
  headingId,
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
  /**
   * Promote this panel's own label to the section heading, carrying this id.
   *
   * Without it a caller that needs a heading has to put an `sr-only` one above the
   * panel, which is what `/nodes/[...id]` did — so the words "Card source" were
   * announced twice in a row, and the visible title was a `<span>` at a size no other
   * heading on the page used. With it, the label a reader sees and the heading a screen
   * reader announces are the same element.
   */
  headingId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);
  const [copied, setCopied] = useState(false);

  const label = title ?? `${language} source`;

  /**
   * A panel label when it is only a label; a section heading when it is one.
   *
   * On `/nodes/[...id]` this panel's label carries the section's `<h2>`, and it rendered
   * at 12px `text-muted` beside nine sibling headings at 13px `text-fg` — the smallest
   * heading on the page, and the one an audit flagged as a third size at a single level.
   * Where no `headingId` is passed the panel is furniture inside somebody else's section,
   * as on the blueprint pages, and it keeps the quieter code-panel register it had.
   */
  const labelClass =
    headingId === undefined
      ? "font-mono text-xs text-muted"
      : "font-mono text-[13px] uppercase tracking-[0.18em] text-fg";

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
        <Heading id={headingId}>
          {collapsible ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              /* `py-1` puts the disclosure at 26px. At `py-0.5` it measured 23.5px —
                 half a pixel under WCAG 2.2 SC 2.5.8, and unlike the breadcrumb and the
                 table chips it is a standalone control, so it cannot claim the
                 in-a-block-of-text exception. */
              className={cx(
                "flex items-center gap-2 py-1 transition-colors",
                labelClass,
                "hover:text-fg",
              )}
            >
              <span className="text-cyan" aria-hidden>
                {open ? "▾" : "▸"}
              </span>
              {label}
            </button>
          ) : (
            <span className={cx("flex items-center gap-2", labelClass)}>
              <span className="text-cyan" aria-hidden>
                ▤
              </span>
              {label}
            </span>
          )}
        </Heading>

        <div className="flex items-center gap-2">
          {meta !== undefined && meta !== "" && (
            <span className="font-mono text-[11px] text-dim">{meta}</span>
          )}
          {downloadName !== undefined && (
            <a
              href={href}
              download={downloadName}
              aria-label={`Download ${downloadName}`}
              /* `py-1`, not `py-0.5`: at 22.5px tall these two were standalone controls under
               the 24px minimum of WCAG 2.2 SC 2.5.8, and being adjacent to each other in
               one header bar they cannot claim the spacing exception either. */
            className="rounded border border-line px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
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
            /* `py-1`, not `py-0.5`: at 22.5px tall these two were standalone controls under
               the 24px minimum of WCAG 2.2 SC 2.5.8, and being adjacent to each other in
               one header bar they cannot claim the spacing exception either. */
            className="rounded border border-line px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
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
          aria-label={`${label}, scrollable`}
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
