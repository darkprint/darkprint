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
  className,
}: {
  /** The drawing. Rendered first, and the thing a reader meets. */
  figure: React.ReactNode;
  /** The file the drawing is a picture of. */
  source: React.ReactNode;
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

  return (
    <div ref={ref} className={cx(motion && "lg:h-[200vh]", className)}>
      <div className={cx(motion && "lg:sticky lg:top-[max(5rem,calc(50vh_-_15rem))]")}>
        <div className={cx(motion && "lg:grid")}>
          <div style={layer(figureOpacity)}>{figure}</div>
          <div className={cx(!motion && "mt-5")} style={layer(sourceOpacity)}>
            {source}
          </div>
        </div>
      </div>
    </div>
  );
}
