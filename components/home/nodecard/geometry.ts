/* ============================================================
   Where everything sits, in pixels, computed rather than measured.

   The choreography spec §3.2 asks for has three moving parts that
   have to agree with each other to the pixel: a listing that scrolls
   inside a window, a rail of seven annotation heads beside it, and a
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
  /** Height of the window the listing scrolls inside while the reel is running. */
  window: 420,
  /** Lines of head-room kept above the run being annotated, so the reader sees what
      comes before it rather than the run arriving at the top edge. */
  park: 6,
  /** Height of one collapsed annotation head. */
  head: 36,
  /** Gap between heads. `head + gap` is the rail's pitch. */
  gap: 6,
  /** Height of the one expanded body. Fixed for two reasons: the rail below it does not
      shift as the copy changes length, and seven heads plus one body then come to exactly
      `window`, so the notes and the listing are the same height at every step. */
  body: 132,
  /** Width of the column the leader line is drawn in. */
  gutter: 44,
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
 * What fraction of the pin travel is spent before the first step attaches, and what is
 * left over for the dezoom at the end.
 *
 * Passed to `stagesShown` from `@/components/viz/useScrollProgress`, which is where the
 * `progress -> how many steps` arithmetic lives.
 */
export const STEP_RESERVE = { head: 0.05, tail: 0.26 } as const;

/** Where the dezoom starts, as a fraction of the whole scroll, and how long it takes. */
const DEZOOM_START = 0.76;
const DEZOOM_SPAN = 0.2;

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
