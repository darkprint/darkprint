import { cx } from "@/lib/format";

/* ============================================================
   The sticky jump row above a grouped shelf.

   ── What it is for ──
   A shelf grouped into panels answers "what am I looking at" by being panels. It does not
   answer the two questions a reader asks while scrolling one: *what else is there*, and
   *how far through am I*. `/nodes` answered the first with a pinned group heading, which
   could only ever name the band under the reader's eye — 53 cards, five bands, and the
   only way to learn that a sixth kind existed was to reach it.

   So the spine lists every group the shelf can hold, in the shelf's own order, with the
   count each one would return, and marks the one the reader is inside.

   ── Why it is a component of its own, and generic ──
   `components/nodes/NodeBrowser.tsx` mounts it; `GalleryBrowser` has the same grouping
   problem and is deliberately not changed in this pass. Nothing in here knows what a node
   card is: the caller passes rows with a label, a count, an href and a sentence for the
   dead state, and keeps its own facet arithmetic. That is the same split
   `RegistryFilterBar` makes, and for the same reason — chrome is shared, and which
   dimensions exist is not.

   It is NOT inside `RegistryFilterBar`, and the decision is worth writing down. That bar is
   `role="search"`, and below `sm` its panel hides behind a disclosure button labelled
   "Filter". A jump list is navigation, not a filter: putting it in there would file "where
   am I in the shelf" under a control a reader opens to narrow the shelf, and hide it on the
   viewport where a long scroll hurts most. They also pin at different offsets and on
   different rungs of the z ladder, and the spine has a condition the shared bar knows
   nothing about — it exists only under a grouping sort.
   ============================================================ */

/**
 * One row of the spine.
 *
 * `count` is the caller's own facet count — the number of rows this group would return
 * given every *other* filter. The spine never computes one: two numbers for the same group
 * that disagree is worse than no number, so only one place in the app holds them.
 */
export interface GroupSpineItem {
  id: string;
  label: string;
  count: number;
  /** Where the panel is. A fragment, so the row works before any script runs. */
  href: string;
  /**
   * What has narrowed the shelf far enough that this group can only be empty.
   *
   * Read only when `count` is 0, and it is the whole point of the dead state: a row that
   * has gone quiet without saying which filter silenced it is a dead end the reader has to
   * solve by trial. Same sentence, same `title`, same treatment as a dead `FilterChip`.
   */
  deadReason: string;
}

/**
 * Which pole the current row is filled with.
 *
 * `cyan` is the site default, because `app/globals.css` spends cyan on what a reader can
 * act on and every row here is a link. A caller whose shelf has a register of its own
 * passes that instead — `/nodes` is a shelf of node cards and node cards are copper, so the
 * mark that says "you are here" wears the subject's colour rather than the site's.
 *
 * Filled rather than tinted, which is the mock's own treatment: this is the one row of the
 * eight that is a statement about the reader's position, and a 10% wash is what the site
 * uses for a filter that is merely on.
 */
const ACCENT = {
  cyan: { pill: "border-cyan bg-cyan text-void", count: "text-void/70" },
  copper: { pill: "border-copper-line bg-copper-line text-void", count: "text-void/70" },
} as const;

/**
 * The shape a row takes, live or dead.
 *
 * Lifted verbatim off `FilterChip` in `NodeBrowser`, including `py-1`: at `py-0.5` these
 * are 22.5px standalone controls, under the 24px floor of WCAG 2.2 SC 2.5.8, and a chip row
 * is not a block of text so the inline exception does not apply. Two families of chip on
 * one page that differ by a pixel would read as a mistake.
 */
const PILL =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors";

export function GroupSpine({
  ariaLabel,
  items,
  activeId,
  results,
  total,
  accent = "cyan",
}: {
  /** What a screen reader calls this landmark: "Jump to a card type". */
  ariaLabel: string;
  /** Every group the shelf can hold, in the shelf's own order. */
  items: readonly GroupSpineItem[];
  /** The group the reader is inside, or `null` before anything has been observed. */
  activeId: string | null;
  /** How many rows survive the filters, and how many there are. */
  results: number;
  total: number;
  accent?: keyof typeof ACCENT;
}) {
  const tone = ACCENT[accent];
  return (
    /* `top-[65px]`, measured rather than stepped to.
       ------------------------------------------------------------
       The page header is `position: sticky; top: 0` and 65px tall on the built page, so
       that is where the underside of it is. The scale's neighbours both miss: `top-16` is
       64 and leaves a 1px sliver of shelf running between the two bars, and `top-15` is 60
       and tucks five pixels of this row under the header. The heading this replaces carried
       `top-15` with a comment claiming it "clears the 65px header exactly", which it did
       not — it was invisible because that band was `bg-void/95` and so was the header.

       `z-30` is the section-chrome rung of the ladder in `RegistryFilterBar`'s note (header
       50 · page chrome 40 · section chrome 30 · card furniture 20 · a card's stretched hit
       target 10). It is the rung the group heading used to hold, and it is here for the
       same reason the heading needed it: a card's star chip sits at `z-20` and floated over
       that band mid-scroll.

       `-mx-1 px-1` so the row's ground reaches past the pills at both ends, and the tiles
       scrolling under it do not show through a one-pixel gutter. */
    <nav
      aria-label={ariaLabel}
      className="sticky top-[65px] z-30 -mx-1 flex items-center gap-3 border-b border-line bg-void/95 px-1 py-3 backdrop-blur-sm"
    >
      <span
        aria-hidden
        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-dim"
      >
        Jump to
      </span>

      {/* One line at every width, scrolled sideways rather than wrapped.
          ------------------------------------------------------------
          The mock wraps, which costs nothing in a 1180px frame that fits all eight rows on
          one line. On a phone it costs four lines of pinned chrome over a shelf the reader
          came to scroll — and it would make the row's height a function of the viewport,
          which the panels' `scroll-mt` has to know in advance and cannot.

          The scroller is its own box so `ms-auto` on the total still means the right edge
          of the SPINE. Inside a single nowrap flex row it would have meant the right edge
          of the scrolled content, which is off-screen exactly when the reader most needs
          to see how much of the shelf is left. */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {items.map((item) => {
          const active = item.id === activeId;
          /* Dead when the group is empty AND the reader is not standing in it. The second
             half cannot happen from a scroll — an empty group draws no panel to be inside —
             but it is the same condition `FilterChip` uses, and stating it means the row
             can never be both filled and struck through. */
          const dead = item.count === 0 && !active;
          if (dead) {
            /* A `<span>`, not an `<a href="#type-…">`. `FilterChip` neutralises a dead
               chip's `onClick` and keeps the button, because a button with no handler goes
               nowhere; a link with a fragment goes somewhere whether or not React is
               listening, and the panel it names is not on the page. Offering it as a link
               would be a promise the markup breaks with script disabled, which is the one
               state this row is built to survive.

               `aria-disabled` and not `hidden`: the reader should see that `human-gate`
               exists and has nothing left in it, which is a different fact from it not
               existing — the same ruling as the `<option disabled>` in the type select. */
            return (
              <span
                key={item.id}
                aria-disabled="true"
                title={item.deadReason}
                className={cx(PILL, "cursor-not-allowed border-line text-dim opacity-70")}
              >
                {item.label}
                <span className="tabular-nums">{item.count}</span>
              </span>
            );
          }
          return (
            <a
              key={item.id}
              href={item.href}
              /* `aria-current="true"`, so the current row is not marked by colour alone.
                 `"true"` rather than `"location"`: the panel is a section of this page and
                 not a page in a set, and `location` is the value for the latter. */
              aria-current={active ? "true" : undefined}
              className={cx(
                PILL,
                active
                  ? tone.pill
                  : "border-line text-muted hover:border-line-bright hover:text-fg",
              )}
            >
              {item.label}
              <span className={cx("tabular-nums", active ? tone.count : "text-dim")}>
                {item.count}
              </span>
            </a>
          );
        })}
      </div>

      {/* The running total, and `aria-hidden` on purpose.
          The same pair is already a `role="status"` live region above the shelf, which is
          what announces a change. This is the visual half of it, kept on screen after that
          line has scrolled away; announcing the number twice would read it out on every
          keystroke of the search field and then read it out again. */}
      <span aria-hidden className="shrink-0 font-mono text-[11px] tabular-nums text-dim">
        <span className="text-fg">{results}</span> of {total}
      </span>
    </nav>
  );
}
