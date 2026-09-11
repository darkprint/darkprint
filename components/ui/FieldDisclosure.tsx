import { cx } from "@/lib/format";

/* ============================================================
   A field row that opens onto what the field is for.
   ------------------------------------------------------------
   Two surfaces draw the same 22 wire keys of a card and the
   author asked for the same behaviour on both: "on click of the
   field, it shows the details", and then, pointing at the
   blueprint page, "when clicking on the fields listed for a node,
   it opens the field providing more information (like in the node
   webpage card)". `/nodes/<id>`'s field table had it; the
   blueprint page's card skeleton did not.

   This is the half the two can genuinely share: the disclosure
   itself. What each row *says* differs — the node page resolves
   ontology terms and prices risk markers per page, the skeleton
   pane has a serializable string and a line range — and the
   sentences they share live in
   `components/panes/field-notes.ts`. The chrome lives here.

   ── Why not `components/ui/More.tsx` ──
   `More` is the site's other `<details>`, and it is the right
   shape for a paragraph that continues a paragraph: its summary
   is a sentence with an inline marker before it. A field row is a
   grid — key, value, line range — and an inline marker takes a
   column, which pushes the key out of alignment with every other
   row on the surface. Hence the marker here is absolutely
   positioned in a gutter the summary reserves with padding, and
   the summary's layout is the caller's to declare.

   ── Why a native `<details>` ──
   The body is in the prerendered HTML whether or not it is open,
   so a reader without script, a printer, and find-in-page all get
   the prose; the open state is announced by the browser rather
   than by an `aria-expanded` somebody has to remember to update;
   and the summary is a tab stop and a click target without a line
   of JavaScript. That last property is why the skeleton pane's
   field list stopped being a roving-tabindex listbox — see
   `SkeletonPane`'s own note, which records what that cost.
   ============================================================ */

export function FieldDisclosure({
  summary,
  children,
  open,
  onToggle,
  className,
  summaryClassName,
  markerClassName,
  bodyClassName,
}: {
  /** The resting row: everything visible before the disclosure is opened. */
  summary: React.ReactNode;
  /** What the row opens onto. Always rendered; `<details>` hides it, it is not absent. */
  children: React.ReactNode;
  /**
   * Controlled open state, for a caller that keeps the open row and its own selection in
   * one piece of state. Left off, the browser owns the state and the row is an ordinary
   * uncontrolled disclosure — which is what a server component wants.
   */
  open?: boolean;
  onToggle?: React.ComponentProps<"details">["onToggle"];
  className?: string;
  /** The row's own layout. The gutter for the marker is the caller's padding. */
  summaryClassName?: string;
  /** Position and colour of the marker, in the gutter the summary reserved. */
  markerClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <details className={cx("group", className)} open={open} onToggle={onToggle}>
      <summary
        className={cx(
          "relative cursor-pointer list-none [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        {/* Drawn rather than left to the browser: a native triangle sits outside the row's
            layout and pushes the first column out of alignment with its neighbours. 11px
            is the site's mono floor. `pointer-events-none` and absolute, so the glyph can
            neither swallow a click meant for the row nor reflow it. */}
        <span
          aria-hidden
          className={cx(
            "pointer-events-none absolute font-mono text-[11px] transition-transform group-open:rotate-90",
            markerClassName ?? "left-0 top-[0.55rem] text-dim",
          )}
        >
          &#9656;
        </span>
        {summary}
      </summary>
      <div className={bodyClassName}>{children}</div>
    </details>
  );
}
