/* ============================================================
   Where everything sits, in pixels, computed rather than measured.

   The choreography spec §3.2 asks for has three moving parts that
   have to agree with each other to the pixel: a listing that scrolls
   inside a window, a rail of nine annotation heads beside it, and a
   leader line drawn between the two. The obvious way to connect them
   is to read `getBoundingClientRect()` off the live DOM, and the
   obvious way is wrong here for three reasons: the measurement has to
   happen after layout, so the first painted frame is drawn against
   stale numbers; it has to be re-run on every font load and resize,
   which is a second observer on top of the one the scroll already
   needs; and none of it exists on the server, so the markup that ends
   up in `.next/server/app/index.html` would be the un-positioned one.

   So the layout is arithmetic instead. Every quantity below is a
   number the CSS is *told*, never one it is asked for: the listing
   sets `NC.line` as its row height, the rail sets `NC.head` as its
   head height, and both endpoints of the leader follow from those two
   without anybody looking at the page. `nodecard.test.ts` checks the
   arithmetic, which is only possible because it is arithmetic.

   All of it is inert below `lg`. The classes that consume these
   numbers carry the `lg:` prefix and are only emitted when motion is
   allowed, so a phone and a reader who asked for no motion get the
   stacked listing at its natural height and none of this runs.
   ============================================================ */

import { clamp01 } from "@/components/viz/useScrollProgress";

export const NC = {
  /** Row height of one line of the listing. Set on the row, so it holds whatever the
      mono face's own metrics are. */
  line: 22,
  /**
   * Height of the window the listing scrolls inside while the reel is running.
   *
   * 504, and it is not a free number: it is exactly what `head`, `gap` and `body` come to
   * for the count of steps in `annotations.ts` (9 × 36 + 8 × 6 + 132), which is what keeps
   * the listing and the notes column level at every step. It was 420 when there were seven
   * steps. `NodeCardStage` carries the same figure twice as a Tailwind arbitrary value,
   * because v4 scans source text and cannot read a constant; those two literals and this
   * one move together or the leader is drawn into a box it is taller than.
   */
  window: 504,
  /** Lines of head-room kept above the run being annotated, so the reader sees what
      comes before it rather than the run arriving at the top edge. */
  park: 6,
  /** Height of one collapsed annotation head. */
  head: 36,
  /** Gap between heads. `head + gap` is the rail's pitch. */
  gap: 6,
  /** Height of the one expanded body. Fixed for two reasons: the rail below it does not
      shift as the copy changes length, and nine heads plus one body then come to exactly
      `window`, so the notes and the listing are the same height at every step. */
  body: 132,
  /**
   * Width of the column the leader line is drawn in.
   *
   * 28, not 44. This number is spent twice: once as the elbow's own width, and once as
   * width taken away from the listing beside it. At 44 the listing had 708px of column
   * for a file whose longest row measures 784px, so sixteen of the fifty-two rows lost
   * their last characters, and the runs the annotations are *about* are exactly the long
   * ones. At 28 the listing has 756px and two rows overflow instead of sixteen. The elbow
   * still has room to bend: `leaderPath` puts its corner at `gutter / 2` with a 9px
   * radius, which leaves 5px of straight run at each end.
   */
  gutter: 28,
} as const;

/** Pitch of the rail: what one attached-and-collapsed step costs vertically. */
export const RAIL_PITCH = NC.head + NC.gap;

/**
 * How far the listing is shifted up, in px, to bring a run into the window.
 *
 * Negative or zero. Clamped at both ends: never above the first line, never past the
 * point where the last line reaches the bottom edge, because a window showing blank
 * space under the end of the file reads as a rendering fault rather than as an ending.
 */
export function reelShift(from: number, totalLines: number): number {
  const wanted = (from - 1 - NC.park) * NC.line;
  const furthest = Math.max(0, totalLines * NC.line - NC.window);
  const y = Math.min(Math.max(wanted, 0), furthest);
  // Negating zero gives -0, which stringifies into `translateY(-0px)`. Valid CSS and a
  // puzzling thing to find in a style attribute.
  return y === 0 ? 0 : -y;
}

/** Vertical centre of an annotated run inside the window, given the shift applied. */
export function bandCentre(range: { from: number; to: number }, shift: number): number {
  const top = (range.from - 1) * NC.line + shift;
  return top + ((range.to - range.from + 1) * NC.line) / 2;
}

/** Vertical centre of a rail head, by 0-based position. */
export function railCentre(index: number): number {
  return index * RAIL_PITCH + NC.head / 2;
}

/**
 * The leader, as an elbow with rounded corners.
 *
 * Drawn rather than implied: spec §3.2 asks for each annotation to be "connected to its
 * own line of the YAML by a drawn leader line", and a bracket or a shared colour would be
 * a weaker claim about which line is meant. Both endpoints are horizontal, so the run
 * leaves the listing and arrives at the head on the flat, which is how a leader is drawn
 * on a real sheet.
 */
export function leaderPath(fromY: number, toY: number, width: number): string {
  const r = (value: number): number => Math.round(value * 10) / 10;
  const mid = width / 2;
  const drop = toY - fromY;
  const radius = Math.min(9, Math.abs(drop) / 2);
  if (radius < 1) return `M 0 ${r(fromY)} H ${r(width)}`;
  const step = drop > 0 ? radius : -radius;
  return [
    `M 0 ${r(fromY)}`,
    `H ${r(mid - radius)}`,
    `Q ${r(mid)} ${r(fromY)} ${r(mid)} ${r(fromY + step)}`,
    `V ${r(toY - step)}`,
    `Q ${r(mid)} ${r(toY)} ${r(mid + radius)} ${r(toY)}`,
    `H ${r(width)}`,
  ].join(" ");
}

/* --------------------- the scroll budget --------------------- */

/**
 * How far the section stays pinned, in px.
 *
 * The stage used to be `420vh`, which makes the pin travel a multiple of the viewport:
 * `height - viewport` is `3.2 x viewport`, so the same steps cost 221px each on a
 * 768-tall laptop and 341px each on a 1080-tall monitor. That is backwards. A scroll notch
 * is the same number of pixels on both screens, so the bigger the screen the slower the
 * argument arrives. Sizing the stage as `calc(100vh + PIN_TRAVEL)` makes
 * `height - viewport` exactly `PIN_TRAVEL` at every viewport, which is the quantity
 * `scrollProgress` divides by, so every reader gets the same distance per step.
 *
 * 2500 spends itself as 125px of lead-in before the first note attaches
 * (`STEP_RESERVE.head`), the steps, and 300px for the dezoom (`STEP_RESERVE.tail`).
 * Measured before it was a fixed number: 2880px of travel on a 900-tall screen, of which
 * the dezoom alone took 749px — five sixths of a viewport of scrolling for one shrink.
 *
 * IT DID NOT MOVE WHEN THE FIGURE GREW FROM SEVEN STEPS TO NINE, and that is a decision
 * rather than an oversight. Each step's share fell from 296px to 231px; holding 296 would
 * have cost 2900px of stage, and the page this figure opens is one the author has twice
 * asked to be shorter. 231px is still two thirds of a laptop screen per note, and the two
 * notes that were added are read from the listing as much as from the rail. If the pace
 * ever needs buying back, buy it here, in one number, and say what it cost.
 */
export const PIN_TRAVEL = 2500;

/**
 * The stage's height, as CSS.
 *
 * Handed to the DOM through a custom property rather than as a Tailwind class, for the
 * reason `CardWalk` states about its own window: the value has to be gated behind `lg:`,
 * and an inline `height` has no breakpoint. The property is set at every width and only
 * the `lg:` utility reads it.
 */
export const STAGE_HEIGHT = `calc(100vh + ${PIN_TRAVEL}px)`;

/**
 * What fraction of the pin travel is spent before the first step attaches, and what is
 * left over for the dezoom at the end.
 *
 * Passed to `stagesShown` from `@/components/viz/useScrollProgress`, which is where the
 * `progress -> how many steps` arithmetic lives.
 *
 * The tail was 0.26. Whatever the pin is worth, a quarter of it bought one shrink, and the
 * shrink is the least of what this section has to say: the nine notes are the argument.
 * At 0.12 the dezoom still gets 300px, which is a third of a screen for a move that is
 * over in one gesture.
 */
export const STEP_RESERVE = { head: 0.05, tail: 0.12 } as const;

/**
 * The progress value in the middle of step `index`'s band. The inverse of `stagesShown`,
 * and what a note's own button scrolls to.
 *
 * `stagesShown` reveals step n while `(progress - head) / span` is inside
 * `(n / count, (n + 1) / count]`, so the middle of that band is `(n + 0.5) / count`. The
 * middle rather than an edge because a click that lands a pixel out of the band opens the
 * neighbouring note, and the reader has no way to know why.
 *
 * Clamped at both ends by construction: the result never leaves `[head, 1 - tail]`, so a
 * button can neither scroll above the point where the section locks nor past the point
 * where it lets go, either of which strands the reader outside the thing they clicked in.
 */
export function stepProgress(index: number, count: number): number {
  if (count <= 0) return 0;
  const span = 1 - STEP_RESERVE.head - STEP_RESERVE.tail;
  const step = Math.min(Math.max(Math.round(index), 0), count - 1);
  return clamp01(STEP_RESERVE.head + ((step + 0.5) / count) * span);
}

/**
 * Where the page has to stand for step `index` to be the one being read.
 *
 * `scrollProgress` reads `-top / (height - viewport)`, so progress `p` is reached when the
 * section's top sits `p * (height - viewport)` above the top of the viewport. Plain numbers
 * rather than a `DOMRect`, so both ends can be checked in the node suite.
 */
export function stepScrollTop(
  index: number,
  count: number,
  sectionTop: number,
  sectionHeight: number,
  viewport: number,
): number {
  const travel = Math.max(0, sectionHeight - viewport);
  return sectionTop + stepProgress(index, count) * travel;
}

/**
 * Where the dezoom starts, as a fraction of the whole scroll, and how long it takes.
 *
 * Derived from the tail rather than typed next to it. The two have to agree: a dezoom that
 * begins before the last note has attached shrinks the card out from under a note the
 * reader has not read yet. The old pair, `tail: 0.26` and a hand-written `0.76`, agreed by
 * hand; when the tail came down to 0.12 the same 0.76 would have run steps 6 and 7 inside
 * the shrink. `settle` is the beat of stillness between the last note landing and the
 * card starting to move, and the 0.01 left at the end is the beat the finished graph is
 * held for before the section lets go.
 */
const DEZOOM_SETTLE = 0.01;
const DEZOOM_START = 1 - STEP_RESERVE.tail + DEZOOM_SETTLE;
const DEZOOM_SPAN = 0.1;

/** 0 before the dezoom begins, 1 once the card has landed. */
export function dezoomProgress(progress: number): number {
  return clamp01((progress - DEZOOM_START) / DEZOOM_SPAN);
}

/**
 * What the dezoom does to the card and to the graph behind it, as three plain numbers.
 *
 * The card keeps its full opacity through the first third of the shrink, because a card
 * that starts fading the instant it starts moving reads as a dismissal rather than as a
 * change of scale, and scale is the whole point spec §3.2 is making: every box in that
 * graph is a card like this one.
 */
export interface Dezoom {
  /** Scale factor for the annotated card. */
  scale: number;
  /** Opacity of the annotated card. */
  fade: number;
  /** Opacity of the graph it lands in. */
  graph: number;
}

export function dezoom(progress: number): Dezoom {
  const d = dezoomProgress(progress);
  return {
    scale: 1 - 0.82 * d,
    fade: 1 - clamp01((d - 0.34) / 0.5),
    graph: clamp01((d - 0.12) / 0.55),
  };
}
