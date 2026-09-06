import { cx } from "@/lib/format";

/**
 * The hairline key/value list: a name in a fixed column, what it means beside it.
 *
 * Four surfaces drew this by hand before it lived anywhere: `components/skill/SkillSetup.tsx`,
 * `app/skill/page.tsx`, `app/mcp/page.tsx` and `app/spec/ontology/page.tsx`. Each spelled
 * its own rules, padding and column track, and the tracks had already drifted to 148, 200
 * and 120 for what a reader sees as one figure. The width is the one thing a caller really
 * varies, so it is the one thing the row takes as a prop.
 *
 * A `<ul>` and not a `<table>`: the term is the item's own name rather than a header over
 * a column of values, so there is no second axis and a table would promise a grid that is
 * not there. `SkillSetup.tsx` records the same reasoning where this shape was first
 * written, and it holds for every caller since.
 */
export function KeyValueList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul className={cx("flex min-w-0 flex-col border-t border-line", className)}>
      {children}
    </ul>
  );
}

/**
 * One row: the term in the fixed column, the body in what is left of the width.
 *
 * The track arrives as a custom property because Tailwind reads arbitrary values as static
 * strings out of the source at build time: a `grid-cols` track of 240px compiles only
 * where a file writes those characters, and a width chosen per caller never does. So the
 * class stays constant and the number rides in on `--kv-key`. The cast is the standard
 * one: `CSSProperties` carries no index signature for custom properties.
 *
 * The collapse below `sm` is not optional, and `SkillSetup.tsx` records what a fixed track
 * costs without it: at a 390px viewport a 148px column leaves about 170px, where a
 * fifteen-word sentence wraps to four lines beside a two-word label. Aligned from `sm` up,
 * stacked below it.
 *
 * Both cells are wrapped here rather than left to the caller, since the row only keeps its
 * tracks while it has exactly two grid items and a caller passing a fragment or a bare
 * string would hand it three or one. They are `<div>` rather than `<span>` because
 * `app/mcp/page.tsx` puts a `<p>` in the value cell. `items-baseline` sits the mono term on
 * the body's first baseline: the two cells run at different sizes, so aligning their boxes
 * leaves the term riding high above the sentence it names.
 */
export function KeyValueRow({
  keyWidth,
  term,
  aside,
  children,
  className,
}: {
  /** The fixed first-column width in px, from `sm` up. Callers need 240, 168 and 132. */
  keyWidth: number;
  /**
   * The name. This sets no colour on it, so a caller can mark one row differently from
   * the next: `app/skill/page.tsx` paints two of its three terms amber and the third
   * blueprint ink, which is the row saying which of them is built.
   */
  term: React.ReactNode;
  /**
   * A third cell at the right edge, on rows that carry one.
   *
   * A prop and not a third child, because the row wraps its cells to keep the track count
   * fixed (see below): a caller that simply put a third element inside `children` would
   * find it laid out INSIDE the value cell, in the flow of the sentence, which is what
   * `/capabilities`' status column did before this existed. Absent on most callers, and
   * absent means two tracks rather than an empty third.
   */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cx(
        "grid min-w-0 grid-cols-[minmax(0,1fr)] items-baseline gap-1 border-b border-line py-[11px] sm:gap-5",
        aside === undefined
          ? "sm:grid-cols-[var(--kv-key)_minmax(0,1fr)]"
          : "sm:grid-cols-[var(--kv-key)_minmax(0,1fr)_var(--kv-aside)]",
        className,
      )}
      style={
        {
          "--kv-key": `${keyWidth}px`,
          /* Wide enough for the longest status word plus its tracking, and fixed so the
             value column's right edge does not move from row to row. */
          "--kv-aside": "88px",
        } as React.CSSProperties
      }
    >
      <div>{term}</div>
      <div className="min-w-0">{children}</div>
      {aside === undefined ? null : <div className="min-w-0">{aside}</div>}
    </li>
  );
}
