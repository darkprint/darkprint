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
import { clamp01, useScrollProgress } from "@/components/viz/useScrollProgress";

/**
 * The two fades, as fractions of the pin.
 *
 * The drawing holds alone for the first third — long enough to be read as a drawing before
 * anything happens to it — then goes out while the file comes in, with the two overlapping
 * for a tenth of the travel so the swap reads as one thing becoming another rather than as
 * a cut. The file then holds alone to the end, so a reader who stops scrolling at the
 * bottom is left with the artefact rather than mid-dissolve.
 */
const FIGURE_OUT = { from: 0.34, to: 0.56 };
const SOURCE_IN = { from: 0.46, to: 0.68 };

/** `t` mapped through a window, 0 before it and 1 after. */
function ramp(t: number, from: number, to: number): number {
  return clamp01((t - from) / (to - from));
}

export function SourceSwap({
  figure,
  source,
  hint,
  className,
}: {
  /** The drawing. Rendered first, and the thing a reader meets. */
  figure: React.ReactNode;
  /** The file the drawing is a picture of. */
  source: React.ReactNode;
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
  className?: string;
}) {
  const { ref, progress, motion } = useScrollProgress<HTMLDivElement>({ steps: 60 });

  const figureOpacity = 1 - ramp(progress, FIGURE_OUT.from, FIGURE_OUT.to);
  const sourceOpacity = ramp(progress, SOURCE_IN.from, SOURCE_IN.to);

  /* `pointer-events` follows opacity so the layer a reader cannot see cannot be selected
     or tabbed into either. A file listing under a drawing at zero opacity is text a mouse
     can still drag-select, which is how a reader ends up copying something invisible. */
  const layer = (opacity: number) =>
    motion
      ? ({ gridArea: "1 / 1", opacity, pointerEvents: opacity < 0.5 ? "none" : "auto" } as const)
      : undefined;

  /* In as the drawing starts to go, out once the file has arrived. Both edges are inside
     the crossfade's own window so the line is never the only thing moving. */
  const hintOpacity =
    ramp(progress, 0.10, 0.22) * (1 - ramp(progress, SOURCE_IN.to, SOURCE_IN.to + 0.10));

  return (
    <div ref={ref} className={cx(motion && "lg:h-[200vh]", className)}>
      {/* Pinned near the top, not centred, and this is the third arrangement — the first
          two are worth recording because the reason is the same both times.

          The two layers are very different heights: the drawing is about 300px and the file
          listing about three times that. They share one grid cell, so the cell is ALWAYS the
          listing's height. Centring the cell under `50vh - 15rem` therefore put the drawing
          halfway down a box sized for something else, with the hint above it off the top of
          the screen; top-aligning it inside that same tall cell left the drawing against the
          ceiling with the rest of the cell empty beneath.

          Pinning the box itself just under the header fixes both: whichever layer is showing
          starts at the same place, the hint above it is always in view, and the listing runs
          downward from there instead of being centred against a height nothing shares. */}
      <div className={cx(motion && "lg:sticky lg:top-24")}>
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
            className="mb-4 text-center text-sm leading-relaxed text-dim"
            style={motion ? { opacity: hintOpacity } : undefined}
          >
            {hint}
          </p>
        )}

        <div className={cx(motion && "lg:grid lg:items-start")}>
          <div style={layer(figureOpacity)}>{figure}</div>
          <div className={cx(!motion && "mt-5")} style={layer(sourceOpacity)}>
            {source}
          </div>
        </div>
      </div>
    </div>
  );
}
