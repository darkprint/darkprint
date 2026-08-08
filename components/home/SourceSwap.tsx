"use client";

/* ============================================================
   A figure that becomes the file it is a picture of.

   The author, 2026-08-08: "when scrolling the blueprint design, get substitute with its
   actual file implementing it (i.e., the blueprint.dot) to give to the user the intuition
   how it is defined."

   That intuition is the whole reason this exists. Everywhere else the site SAYS a blueprint
   is a DOT file and a node is a YAML card; here the drawing turns into the text while a
   reader watches, which is a different kind of claim — you see the two are one thing rather
   than being told.

   ── The no-JS state is both, stacked ──
   A crossfade wants one layer hidden at rest, and this site does not allow that: nothing on
   the landing may ship `opacity-0`, because the static state covers the server, a reader
   with JS off and a reader who asked for reduced motion, and a layer faded out is invisible
   to all three. `components/home/beats.test.ts` fails on it.

   So the pinning and the fade are enhancements, exactly as `CardWalk` does it: without
   motion the two layers are ordinary blocks, one under the other, at full opacity — the
   drawing and then the file, which is a perfectly good way to read this. With motion they
   are stacked in one grid cell and the scroll crossfades them.

   `useScrollProgress` starts at 1 and only measures once motion is confirmed, so the first
   client render matches the server's: both layers, stacked, nothing hidden.

   ── Why a grid and not `absolute` ──
   Both layers sit in grid area `1/1`, so the stack is as tall as the taller of the two and
   the sticky box reserves the right height. An absolutely positioned second layer would
   collapse the container to the first layer's height, and the file listing is the taller of
   the pair on every mount.
   ============================================================ */

import { cx } from "@/lib/format";
import { useReveal } from "@/components/viz/useReveal";
import { clamp01, useScrollProgress } from "@/components/viz/useScrollProgress";

/**
 * The two fades, as fractions of the pin.
 *
 * The drawing holds alone at first — long enough to be read as a drawing before anything
 * happens to it — then turns away while the file turns towards the reader, the two
 * overlapping so the swap reads as one object rotating rather than as a cut.
 *
 * Both windows moved earlier and the track grew to 300vh when the listing became a walk.
 * The file used to be the end of the scroll; it is now the START of a five-block walk that
 * needs the rest of the pin to run in. At the old numbers the swap ate two thirds of the
 * travel and all five blocks fired inside the last 350px, which is faster than a reader can
 * follow — and then the pin released with the last block still on screen and nothing left
 * to do.
 *
 * They moved earlier AGAIN when the box started pinning centred. The author: "make the
 * blueprint design to stick to center of the screen when scrolling and when reached the
 * center, start flipping." Centring is what makes that instruction cheap to keep: sticky
 * locks the box when the wrapper's top passes the offset below, which is 209px at a 950px
 * viewport and therefore BEFORE `useScrollProgress` starts counting at a wrapper top of
 * zero. So the drawing is already centred and still at progress 0, and a hold of 0.16 after
 * that — 304px of scrolling past a picture that has finished arriving — was the dead scroll
 * the instruction is about. 0.06 is a beat, not a wait.
 *
 * The swap now finishes by 0.28 and the walk has the other 0.72: 266px of scroll per block
 * at 1440 × 950, against 230 before.
 */
const FIGURE_OUT = { from: 0.06, to: 0.20 };
const SOURCE_IN = { from: 0.14, to: 0.28 };

/**
 * The pinned box, head to foot, in CSS pixels.
 *
 * Measured on the built page at 1440 x 950 with the walk running: the heading block, the
 * hint, and the 460px cell the two layers share. It is what the centring offset is half of,
 * so it moves whenever the heading gains a line or the cell changes height — and the cell is
 * the taller of the two layers, which is the file panel.
 */
const GROUP = 580;

/* `CELL` (460) and `HINT_BLOCK` (36) stood here and were the two terms of the centring
   offset: `50vh - CELL/2 - HINT_BLOCK` put the drawing's middle on the screen's middle.

   The box is heading + hint + drawing now (see `heading`), so there is nothing to centre —
   the group is roughly 700px in a 950px viewport and pinning it at `top-20` is the whole of
   the placement. Recorded because both numbers were measured rather than guessed: the cell
   is 460px at 1024, 1280 and 1440 and at four scroll depths each, and the hint block is one
   line of `text-sm leading-relaxed` plus `mb-4`. If this box ever goes back to holding the
   drawing alone, those are the numbers. */

/** `t` mapped through a window, 0 before it and 1 after. */
function ramp(t: number, from: number, to: number): number {
  return clamp01((t - from) / (to - from));
}

export function SourceSwap({
  figure,
  source,
  hint,
  heading,
  className,
}: {
  /** The drawing. Rendered first, and the thing a reader meets. */
  figure: React.ReactNode;
  /**
   * The file the drawing is a picture of.
   *
   * A function when the file wants the clock: `DotBreakdown` walks its own blocks off the
   * same progress this component is already measuring, so the listing highlights a block
   * and shows that block's note alone. Passing progress down rather than lifting the hook
   * out keeps one measurement per figure.
   */
  source: React.ReactNode | ((progress: number) => React.ReactNode);
  /**
   * One line saying what is about to happen, shown only while it is about to happen.
   *
   * The author, 2026-08-08: this sentence was in the section's deck and "make it appear
   * when scrolling down". A hint under a heading, before a reader has moved, is a caption
   * for something that has not started; the same words arriving as the drawing begins to
   * go are an explanation of what they are watching.
   *
   * It fades out once the swap is done, because by then it is describing the past. What is
   * left on screen is the file, which is the thing the beat is handing over.
   */
  hint?: React.ReactNode;
  /**
   * The section's own heading, rendered INSIDE the pinned box.
   *
   * The author, 2026-08-08, with two screenshots: the unscrolled state is what they want and
   * the scrolled state is not. Both are correct renderings of the arrangement that produced
   * them, which is why this is a structural fix rather than a spacing one.
   *
   * The heading was a sticky SIBLING of this component: two sticky boxes in one scroll
   * container, each with its own offset, and the distance between them therefore depended on
   * which of the two had pinned yet. In flow they sat 40px apart; both pinned, they sat
   * `figureOffset - headingHeight - 64` apart, which is a different number and is the gap in
   * the second screenshot.
   *
   * One box cannot come apart from itself. The heading is inside the sticky element now, so
   * the heading, the hint and the drawing hold the spacing they have at rest at every scroll
   * position, which is what the first screenshot shows.
   */
  heading?: React.ReactNode;
  className?: string;
}) {
  const { ref, progress, motion } = useScrollProgress<HTMLDivElement>({ steps: 60 });

  const figureOpacity = 1 - ramp(progress, FIGURE_OUT.from, FIGURE_OUT.to);
  const sourceOpacity = ramp(progress, SOURCE_IN.from, SOURCE_IN.to);

  /* ── The two layers turn, they do not merely fade ──
     The author, 2026-08-08: "the transition between blueprint graphics and the
     implementation file happens via rotating the blueprint graphics that rotate while
     scrolling."

     So it is a card flip about the vertical axis. The drawing turns away from the reader
     as it goes and the file turns towards them as it arrives, which says the two are the
     same object seen from two sides — which is the claim this whole component exists to
     make. A crossfade said only that one thing replaced another.

     The rotation is tied to the SAME ramp as the opacity, so a layer is edge-on exactly
     when it is invisible: a flip that finished before the fade would show a mirrored
     listing, and one that lagged would show the drawing side-on and solid.

     `perspective` lives on the grid below rather than here, because it has to be the
     parent of both rotating children for them to share a vanishing point.

     `pointer-events` follows opacity so the layer a reader cannot see cannot be selected or
     tabbed into either. A file listing under a drawing at zero opacity is text a mouse can
     still drag-select, which is how a reader ends up copying something invisible. */
  const layer = (opacity: number, turn: number) =>
    motion
      ? ({
          gridArea: "1 / 1",
          opacity,
          transform: `rotateY(${turn}deg)`,
          backfaceVisibility: "hidden",
          pointerEvents: opacity < 0.5 ? "none" : "auto",
        } as const)
      : undefined;

  /* In as the heading starts to leave, out once the file has arrived.
     ------------------------------------------------------------
     The author: make the line appear "once the text 'The drawing / This is a blueprint /
     Which agents run…' start to go up."

     ── Why this cannot come from `progress` ──
     That moment is progress ZERO. `useScrollProgress` reports 0 for the whole of a
     section's approach and only starts counting once the wrapper's top passes the top of
     the viewport — which, with the heading and the section's own padding above it, is a
     good 260px AFTER the heading has gone. So the entire window this instruction is about
     is a single clamped value, and no ramp on it can fire inside the window. The two
     previous attempts are both explained by that one fact: a ramp from 0.02 put the line
     in far too late, and removing the ramp put it in from the section's first pixel.

     ── The signal that does exist ──
     `useReveal` is an IntersectionObserver, so it answers a question about POSITION rather
     than about pin travel, and it is already this codebase's answer to "has this risen far
     enough to speak". `margin` shrinks the root's bottom edge upward, so `shown` turns true
     when this paragraph's top crosses that line rather than when it first appears.

     `amount: 0` because what matters is the box's TOP crossing the line; the default 0.25
     would wait for a quarter of a 460px figure to be inside it, which is most of the way
     to the pin.

     ── Where the line goes, and why it is this high ──
     -42% put it at 58% of the viewport, and the author: the line "is still already visible
     even before the blueprint graphic is in the center — I want to make appear such text
     when [the heading block] is nearly reached the navbar while scrolling."

     So the trigger is the SETTLE, not the entrance. -72% puts the line at 28% of the
     viewport, 266px at 950 — within a few pixels of the offset the sticky box locks at
     (`50vh - CELL/2 - HINT_BLOCK`, 209px there). That is not a coincidence worth hiding
     behind a percentage: this paragraph is the top of the pinned box, so a line just below
     the lock offset fires as the box comes to rest, and the heading above it is passing
     under the 4rem header at the same moment. One gesture, two things arriving.

     A percentage rather than the pixel offset itself, because `rootMargin` is resolved
     against the root once and the offset is a `max()` of two viewport-dependent terms. On a
     short window the percentage fires slightly before the lock instead of at it, which is
     the harmless direction: the line appears a beat early rather than never.

     ── The static state, which is the reason `useReveal` and not a raw observer ──
     It returns `shown: true` on the server, without JS and under reduced motion, so the
     prerendered markup carries the sentence at full opacity and `beats.test.ts`'s rule that
     nothing on the landing may ship hidden holds without an exception.

     The out is unchanged: it goes once the file has arrived, because by then it is
     describing the past. */
  const { ref: hintRef, shown: hintIn } = useReveal<HTMLParagraphElement>({
    amount: 0,
    margin: "0px 0px -72% 0px",
  });
  const hintOpacity = (hintIn ? 1 : 0) * (1 - ramp(progress, SOURCE_IN.to, SOURCE_IN.to + 0.10));

  return (
    <div ref={ref} className={cx(motion && "lg:h-[300vh]", className)}>
      {/* Pinned CENTRED, and this is the fourth arrangement. The first three are recorded
          because two of them failed for one reason and the fix is not what it looks like.

          The author: "make the blueprint design to stick to center of the screen when
          scrolling and when reached the center, start flipping (i.e., the same u do for the
          node card)."

          ── Why centring failed twice before ──
          The two layers were very different heights and the cell was always the taller
          one's. Centring the box under `50vh - 15rem` put the drawing halfway down a box
          sized for something else, with the hint above it off the top of the screen;
          top-aligning inside that same tall cell left the drawing against the ceiling with
          the rest empty beneath. So it was pinned at `top-24` instead, which was honest but
          is not what was asked for.

          ── Why it works now ──
          Two things changed underneath it. The panel shows ONE note at a time rather than
          five, which took the cell from a listing-shaped column to a measured, stable 460px
          (see `CELL`); and the layers centre INSIDE that cell rather than sitting at its
          top. So half the cell is a real number, the box is half a screen less that number
          from the top, and whichever layer is showing lands in the middle of the screen —
          which is exactly how `CardWalk` pins one beat down, as the author points out.

          ── The offset, term by term ──
            50vh          the middle of the screen
            - CELL/2      half the figure, so its centre lands there and not its top
            - HINT_BLOCK  the line above the grid, which is inside this box and would
                          otherwise push the grid down by its own height
            max(4rem, …)  the floor. Half the cell plus the hint is 266px, so the offset
                          turns negative below a 532px viewport and would pin the figure
                          under the sticky header. A window that short cannot hold the whole
                          figure either way; the floor decides which end gets cut, and the
                          top is where the hint and the file's own name are.

          Inline rather than a utility because the two terms are measurements, and `top` is
          inert on a `position: static` box — so this applies at exactly the widths
          `lg:sticky` does, and does nothing below them. */}
      {/* Pinned CENTRED: half a screen, less half the group.
          ------------------------------------------------------------
          The author, with a correct screenshot and two wrong ones: the title and the drawing
          are to "stay central" rather than ride up under the navbar. `top-20` was the wrong
          reading of the previous fix — that fix was about the heading and the figure being
          ONE box, and I took it as a licence to pin the box at the top.

          `GROUP` is that box measured on the built page: 580px at 1440 x 950, heading plus
          hint plus the 460px cell. Half of it is 290, so the box locks with its middle on
          the screen's middle and the group has 80px of air above it rather than sitting
          against the header.

          `max(5rem, …)` is the floor, one rem below where the group would otherwise pin, so
          a short viewport puts it under the header rather than behind it. A window that
          cannot hold 580px is going to cut something either way; the floor decides that it
          is the bottom. */}
      <div
        className={cx(motion && "lg:sticky")}
        style={motion ? { top: `max(5rem, calc(50vh - ${GROUP / 2}px))` } : undefined}
      >
        {heading}
        {hint !== undefined && (
          /* ABOVE the pair, not under it, and the reason is the grid below.
             ------------------------------------------------------------
             Both layers share one cell, so the cell is as tall as the taller of the two —
             the file listing, which runs several times the drawing's height. A hint placed
             after the grid therefore sits below the LISTING's bottom edge, which is off the
             viewport while the drawing is the thing on screen. It was invisible for exactly
             the pixels it exists to speak for.

             Above the pair it is in the reader's eye line the whole time and only its
             opacity moves. `aria-hidden` is deliberately not set: it is a real sentence a
             screen reader should hear, and without motion it simply reads as a caption. */
          <p
            ref={hintRef}
            /* A transition, because the in edge is a boolean rather than a ramp: the fade
               out is scroll-driven and continuous, the fade in is one state change, and
               without this it would snap. 500ms is the site's own `duration-500`, which is
               what `CardWalk`'s reel already eases on. */
            className="mb-4 text-center text-sm leading-relaxed text-dim transition-opacity duration-500"
            style={motion ? { opacity: hintOpacity } : undefined}
          >
            {hint}
          </p>
        )}

        {/* `lg:items-center`, not `items-start`. The row is sized by the taller child and
            neither child stretches, so centring costs nothing and buys the half of the
            author's instruction the sticky offset above cannot: the offset centres the CELL
            on screen, and this centres the drawing inside the cell. Top-aligned, a 405px
            drawing in a 460px row would sit 27px high of the middle it was asked to be in. */}
        <div
          className={cx(motion && "lg:grid lg:items-center")}
          style={motion ? { perspective: "1800px" } : undefined}
        >
          {/* The drawing turns away: 0° at rest, -90° and edge-on by the time it is gone. */}
          <div style={layer(figureOpacity, -90 * (1 - figureOpacity))}>{figure}</div>
          {/* The file turns towards the reader from the other side: +90° while unseen, 0°
              once it has arrived. */}
          <div
            className={cx(!motion && "mt-5")}
            style={layer(sourceOpacity, 90 * (1 - sourceOpacity))}
          >
            {typeof source === "function" ? source(progress) : source}
          </div>
        </div>
      </div>
    </div>
  );
}
