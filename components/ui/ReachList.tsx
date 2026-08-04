import { Children, cloneElement, isValidElement } from "react";

import { cx } from "@/lib/format";

/* ============================================================
   The row → connector → gloss figure.

   It was written for `/concepts` ("One card, five rows") and the
   author asked for it elsewhere: "I really liked the graphic u
   used here; this is what I intended when making more clear a
   concept. Apply this also in the ontology and node webpages
   where it can help to restructure the organization of the
   pages."

   What it is for, stated so it does not spread to lists it does
   not fit: **a fixed set of named things, each of which points at
   something else.** The left cell is the name as it is written in
   a file, the right cell is what it means or reaches, and the rule
   between them is the pointing. It replaces a stack of paragraphs
   that each open by repeating a field name.

   It is not a table (no shared column meaning across rows beyond
   "name" and "what it reaches"), not a definition list of prose,
   and not for anything of unbounded length: past about six rows
   the vertical rhythm stops reading as a figure.

   Motion is `anim-strip-in`, whose resting style is the finished
   one and which only runs under `prefers-reduced-motion:
   no-preference`. The stagger is applied here rather than at every
   call site, so a caller cannot forget it or number it wrongly.
   Server component: no hooks, no client bundle.
   ============================================================ */

/** Milliseconds between one row drawing in and the next. */
const STEP = 90;

export interface ReachRowProps {
  /** The name as it appears in the file being described. Rendered as code. */
  field: string;
  /** What it currently holds, if the figure is describing a real document. */
  value?: string;
  /**
   * The row is a refusal or an absence, so the connector is struck through and the
   * right-hand side reads as what is kept out. Amber, this site's colour for a limit.
   */
  barred?: boolean;
  /** What the field reaches, means, or draws from. */
  children: React.ReactNode;
  /** Set by `ReachList`; a caller passing it is overridden. */
  index?: number;
}

export function ReachRow({
  field,
  value,
  barred = false,
  children,
  index = 0,
}: ReachRowProps) {
  return (
    <li
      className="anim-strip-in grid grid-cols-[minmax(0,10.5rem)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3"
      style={{ animationDelay: `${index * STEP}ms` }}
    >
      <span className="flex min-w-0 flex-col rounded border border-line bg-surface-2 px-3 py-2">
        <code className={cx("font-mono text-[12px]", barred ? "text-amber" : "text-cyan")}>
          {field}
        </code>
        {value !== undefined && (
          <code className="min-w-0 truncate font-mono text-[11px] text-dim">{value}</code>
        )}
      </span>

      {/* The pointing. A rule with an arrowhead, or a rule struck through. */}
      <span aria-hidden className="flex items-center">
        <span className={cx("h-px w-5 sm:w-9", barred ? "bg-amber/50" : "bg-line-bright")} />
        <span
          className={cx(
            "-ml-px font-mono text-[12px]",
            barred ? "text-amber" : "text-line-bright",
          )}
        >
          {barred ? "╱" : "→"}
        </span>
      </span>

      <span className="min-w-0 text-[13px] leading-snug text-muted">{children}</span>
    </li>
  );
}

/**
 * Frames a set of `ReachRow`s and numbers them for the stagger.
 *
 * `label` and `caption` sit on one line above the rows, left and right. Keep the label
 * short: it is the figure's name, not the section's heading, and printing the section's
 * eyebrow here says the same word twice on one screen.
 */
export function ReachList({
  label,
  caption,
  footnote,
  className,
  children,
}: {
  label: string;
  caption?: React.ReactNode;
  /** One line under the rows, for the caveat a gloss cannot carry. */
  footnote?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  let i = 0;
  const rows = Children.map(children, (child) =>
    isValidElement<ReachRowProps>(child)
      ? cloneElement(child, { index: i++ })
      : child,
  );

  return (
    <figure
      className={cx(
        "flex flex-col gap-4 rounded-xl border border-line bg-surface/70 p-5 sm:p-6",
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          {label}
        </span>
        {caption !== undefined && (
          <span className="text-[13px] text-muted">{caption}</span>
        )}
      </figcaption>

      <ul className="flex flex-col gap-2">{rows}</ul>

      {footnote !== undefined && (
        <p className="border-t border-line pt-3 text-xs leading-relaxed text-dim">
          {footnote}
        </p>
      )}
    </figure>
  );
}
