import { Children, cloneElement, isValidElement } from "react";

import { cx } from "@/lib/format";

/* ============================================================
   The row → connector → gloss figure.

   It was written for the "One card, five rows" figure that is now
   `/what-a-blueprint-is#the-words`, and the
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
   call site, so a caller cannot forget it or number it wrongly —
   and `still` turns the whole entrance off for a figure that is a
   way in rather than the content, which `/ontology` is. See that
   prop for the argument; it is a list-level switch for the same
   reason the stagger is.
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
  /**
   * A second line about this row, set smaller and dimmer under the gloss.
   *
   * Added for the words section (then `/concepts`, now `/what-a-blueprint-is#the-words`),
   * where these lived in a separate six-box grid under the figure.
   * A grid keyed by field name, sitting under a figure whose rows are keyed by field name,
   * is the same list twice: a reader matched `mcp` in a box against `mcp` in the drawing by
   * eye, and the two disagreed about how many fields there are. Optional, so the ontology
   * and node placements are untouched.
   */
  note?: React.ReactNode;
  /**
   * Make the name cell a link.
   *
   * Added for `/ontology`, where this figure was already shaped like the table of
   * contents that page never had: five named kinds, each one pointing at the section
   * below that holds it. 50 terms over eight viewports and no lookup of any kind, while
   * the two sibling shelves both open with a search panel — so the cheap half of a way in
   * is to let the figure be the index it already looks like.
   *
   * Only the name cell takes the link. The gloss carries prose links of its own, and a
   * row-wide hit target would swallow them.
   */
  href?: string;
  /**
   * The link's accessible name, when the field name does not say where it goes.
   *
   * The cell reads out as its own contents otherwise — "phase 5 terms" — which names the
   * field, not the destination. Ignored when `href` is unset.
   */
  hrefLabel?: string;
  /** Set by `ReachList`; a caller passing it is overridden. */
  index?: number;
  /** Set by `ReachList` from its own `still`. A caller passing it is overridden. */
  still?: boolean;
}

/**
 * The name cell's geometry, shared by the plain and the linked spelling so the two are
 * the same box and a linked figure does not sit a pixel off an unlinked one.
 */
const NAME_CELL = "flex min-w-0 flex-col rounded border border-line bg-surface-2 px-3 py-2 sm:w-auto";

export function ReachRow({
  field,
  value,
  barred = false,
  children,
  note,
  href,
  hrefLabel,
  index = 0,
  still = false,
}: ReachRowProps) {
  const name = (
    <>
      <code className={cx("font-mono text-[12px]", barred ? "text-amber" : "text-cyan")}>
        {field}
      </code>
      {/* `truncate` only once there are columns to protect. Stacked, the row is as
          wide as the figure and a clipped path helps nobody — `skills/merge-executor.md`
          was cut with no title and no way to see the rest. */}
      {value !== undefined && (
        <code className="min-w-0 break-all font-mono text-[11px] text-dim sm:truncate sm:break-normal">
          {value}
        </code>
      )}
    </>
  );

  return (
    /* Stacked below `sm`, three columns above it.
       ------------------------------------------------------------
       The row was three columns at every width, and the third one was
       `minmax(0,1fr)` — whatever is left. Measured at 378px that left the gloss
       **66px**: the `skill` row put 169 characters into it at roughly ten characters a
       line, 340px tall, and the whole figure grew to 941px to carry about 300
       characters. It never triggered an overflow warning because a grid squeezes rather
       than spills, so nothing automated could see it.

       Stacking is the honest fix rather than shrinking the name column, because the
       three parts are a name, a pointing and a gloss: on one phone-width line the
       pointing has nowhere to point, and the gloss is the part that has to stay
       readable. */
    /* `still` drops the entrance and the delay with it. The class and the inline
       `animationDelay` are one mechanism, so a row that keeps the delay without the class
       carries a style property nothing reads, and a row that keeps the class without the
       delay draws the whole figure at once — which is the flicker the stagger exists to
       avoid. Both or neither. */
    <li
      className={cx(
        "grid grid-cols-1 items-start gap-1.5 sm:grid-cols-[minmax(0,10.5rem)_auto_minmax(0,1fr)] sm:gap-3",
        still ? undefined : "anim-strip-in",
      )}
      style={still ? undefined : { animationDelay: `${index * STEP}ms` }}
    >
      {href === undefined ? (
        <span className={NAME_CELL}>{name}</span>
      ) : (
        /* A plain `<a>`, not `next/link`: this is a fragment on the page already being
           read, so there is no route to prefetch and nothing to hand the router.

           The press is the 40–200px band's `0.97` — the cell measures 168px — and the
           property list spells `scale` out. Tailwind v4 emits `scale:` as its own CSS
           property, so a hand-written `transition-[transform,…]` does not cover it and
           the press would snap instead of ramping. `hoverable:` gates both the hover and
           the press behind a fine pointer, the way every other pressable surface in
           `components/ui` does, so a tap does not latch the hover until the route
           changes. Focus is deliberately outside the transition: `outline-color` is in
           Tailwind's `transition-colors` set, and a ring that fades in over 180ms is a
           ring a reader tabbing at 80ms never sees at full strength. */
        <a
          href={href}
          aria-label={hrefLabel}
          className={cx(
            NAME_CELL,
            "transition-[transform,scale,color,background-color,border-color] duration-[var(--dur-base)] ease-out hoverable:hover:border-line-bright hoverable:hover:bg-surface-3 hoverable:active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan",
          )}
        >
          {name}
        </a>
      )}

      {/* The pointing. A rule with an arrowhead, or a rule struck through.
          ------------------------------------------------------------
          This is the figure's central device and it was drawn at `--color-line-bright`,
          which measures **1.74:1** on the panel ground, inside a wrapper marked
          `aria-hidden`. So the relation the whole figure exists to draw was invisible to
          a low-vision reader and absent from assistive technology at the same time, while
          the `barred` variant beside it — the refusal — shouted at 10.66:1 in amber. The
          refusal was the only thing anyone could see.

          `--color-dim` is the site's own readable token (its comment: "≥4.5:1 on the dark
          surfaces"), so the rule and the head now sit at roughly 6:1. The mark stays
          decorative to AT, but the row no longer reads as two unrelated halves: an
          `sr-only` word carries the relation instead, which is what the drawing means.

          Hidden when stacked: an arrow pointing right at a block that now sits below it
          is drawing a relation the layout no longer has. */}
      <span className="sr-only">{barred ? " cannot be " : " reaches "}</span>
      <span aria-hidden className="hidden items-center sm:flex sm:pt-[7px]">
        <span className={cx("h-px w-5 sm:w-9", barred ? "bg-amber/60" : "bg-dim")} />
        {/* Fixed width, because `╱` and `→` are not the same width even in a monospace
            face and the connector sits in an `auto` grid column. The barred row's gloss
            started eight pixels left of every other row's, which read as a stray indent on
            the one row whose meaning is that it is different. */}
        <span
          className={cx(
            "-ml-px inline-block w-3.5 text-center font-mono text-[12px]",
            barred ? "text-amber" : "text-dim",
          )}
        >
          {barred ? "╱" : "→"}
        </span>
      </span>

      {/* Indented a step when stacked, so a gloss still reads as belonging to the field
          above it rather than as the next item in the list. `barred` keeps its amber
          edge, which is the only thing carrying the refusal once the struck rule is
          gone. */}
      <span
        className={cx(
          /* Capped: the third column is `1fr`, and in a full-width placement that let a
             gloss run to about 110 characters. */
          "flex min-w-0 max-w-[74ch] flex-col gap-1 border-l pl-3 text-[13px] leading-snug text-muted sm:border-l-0 sm:pl-0",
          barred ? "border-amber/50" : "border-line",
        )}
      >
        <span>{children}</span>
        {note !== undefined && (
          <span className="text-[12px] leading-relaxed text-dim">{note}</span>
        )}
      </span>
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
  frame = true,
  still = false,
  className,
  children,
}: {
  label: string;
  caption?: React.ReactNode;
  /** One line under the rows, for the caveat a gloss cannot carry. */
  footnote?: React.ReactNode;
  /**
   * Draw the figure's own border and ground.
   *
   * Off when the figure is already inside a panel. Framed, it put a bordered box inside
   * a bordered box, and each row's field cell has an edge of its own — three border
   * levels for one figure, which is the nested-card shape a panel exists to avoid. The
   * rows read as a figure on their own; the frame is only there for when nothing else
   * is holding them.
   */
  frame?: boolean;
  /**
   * Draw the rows already there, with no entrance.
   *
   * `anim-strip-in` is a staggered draw whose resting style is the finished one, so it
   * costs a reader nothing and is off under `prefers-reduced-motion`. That is why it is the
   * default, and why `ConceptFigures` — the other importer, on `/spec/card` and
   * `/what-a-blueprint-is` — keeps it: there the figure IS the content, and the rows
   * arriving in order is the reading order being drawn.
   *
   * `/ontology` is the exception, on the author's instruction. That figure is the index to
   * a page of fifty terms and the first thing under the heading, so a reader who arrived
   * holding a word watched five rows draw in one at a time before they could look for it.
   * An entrance is worth its 450ms when the figure is the content; it is not when the
   * figure is a way in.
   *
   * A prop on the list rather than on each row, for the same reason the stagger is: a
   * caller cannot half-apply it.
   */
  still?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  let i = 0;
  const rows = Children.map(children, (child) =>
    isValidElement<ReachRowProps>(child)
      ? cloneElement(child, { index: i++, still })
      : child,
  );

  return (
    <figure
      className={cx(
        "flex flex-col gap-4",
        frame && "rounded-xl border border-line bg-surface/70 p-5 sm:p-6",
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
