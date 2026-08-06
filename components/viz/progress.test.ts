/* ============================================================
   Scroll arithmetic, at both ends and past them.

   The centrepiece (spec §3.2) stages its annotations off one
   number, so the two values that matter most are the ones a reader
   sits at longest: 0 above the section and 1 below it. A formula
   that overshoots at either end attaches one annotation too many or
   drops the last, and neither shows up in a screenshot taken
   halfway down.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { clamp01, scrollProgress, stagesShown } from "./useScrollProgress";

const VIEWPORT = 800;
/** A section five viewports tall, which is the shape §3.2 asks for. */
const TALL = VIEWPORT * 5;
/** The distance a sticky child inside it stays pinned. */
const TRAVEL = TALL - VIEWPORT;

describe("clamp01", () => {
  it("holds both ends", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(4)).toBe(1);
  });

  /**
   * `getBoundingClientRect` on a node that has been detached between the scroll event and
   * the animation frame yields zeroes, and a zero denominator yields NaN. NaN compares
   * false against everything, so an unguarded clamp passes it straight through and every
   * downstream `Math.ceil` returns NaN. An infinity is only a value past an end, and the
   * ordinary comparisons already answer it.
   */
  it("answers 0 for a value that is not a number", () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("progress across a pinned section", () => {
  it("is 0 while the section has not reached the top of the screen", () => {
    expect(scrollProgress(VIEWPORT, TALL, VIEWPORT)).toBe(0);
    expect(scrollProgress(1, TALL, VIEWPORT)).toBe(0);
    expect(scrollProgress(0, TALL, VIEWPORT)).toBe(0);
  });

  it("is 1 the moment the sticky child lets go, and stays there", () => {
    expect(scrollProgress(-TRAVEL, TALL, VIEWPORT)).toBe(1);
    expect(scrollProgress(-TRAVEL - 2000, TALL, VIEWPORT)).toBe(1);
  });

  it("runs linearly through the pin travel", () => {
    expect(scrollProgress(-TRAVEL / 2, TALL, VIEWPORT)).toBeCloseTo(0.5, 6);
    expect(scrollProgress(-TRAVEL / 4, TALL, VIEWPORT)).toBeCloseTo(0.25, 6);
  });

  /**
   * Below `md` the centrepiece drops the sticky choreography and the section collapses to
   * something shorter than the screen, so there is no pin travel to divide by. The
   * fallback measures the section's own passage instead: still 0 at the top, still 1 once
   * it has gone by, which is all any consumer relies on.
   */
  it("falls back to the section's own passage when it is too short to pin", () => {
    const short = 400;
    expect(scrollProgress(0, short, VIEWPORT)).toBe(0);
    expect(scrollProgress(-short / 2, short, VIEWPORT)).toBeCloseTo(0.5, 6);
    expect(scrollProgress(-short, short, VIEWPORT)).toBe(1);
  });

  it("answers 0 for an element with no height", () => {
    expect(scrollProgress(-100, 0, VIEWPORT)).toBe(0);
  });
});

describe("staging annotations off the progress value", () => {
  /** Spec §3.2's table: the node card's annotations attach one at a time. Seven here
      rather than the nine the card now carries, because this is arithmetic about a count
      and not about that figure: the property has to hold for any of them. */
  const COUNT = 7;

  it("attaches none at the top and all at the bottom", () => {
    expect(stagesShown(0, COUNT)).toBe(0);
    expect(stagesShown(1, COUNT)).toBe(COUNT);
  });

  it("never overshoots the count, whatever it is handed", () => {
    expect(stagesShown(4, COUNT)).toBe(COUNT);
    expect(stagesShown(-4, COUNT)).toBe(0);
    expect(stagesShown(Number.NaN, COUNT)).toBe(0);
  });

  it("attaches the first as soon as the reader moves", () => {
    // Ceil rather than floor: a seventh of the scroll spent looking at an un-annotated
    // card reads as a section that has not started.
    expect(stagesShown(0.001, COUNT)).toBe(1);
    expect(stagesShown(1 / COUNT, COUNT)).toBe(1);
    expect(stagesShown(1 / COUNT + 0.001, COUNT)).toBe(2);
  });

  /** The head lets the card settle before the first leader line is drawn; the tail leaves
      the dezoom somewhere to happen after the last one. */
  it("honours the reserves at each end", () => {
    const reserve = { head: 0.1, tail: 0.2 };
    expect(stagesShown(0.1, COUNT, reserve)).toBe(0);
    expect(stagesShown(0.05, COUNT, reserve)).toBe(0);
    expect(stagesShown(0.11, COUNT, reserve)).toBe(1);
    expect(stagesShown(0.8, COUNT, reserve)).toBe(COUNT);
    expect(stagesShown(1, COUNT, reserve)).toBe(COUNT);
  });

  it("degrades rather than dividing by zero when the reserves leave no room", () => {
    expect(stagesShown(0.5, COUNT, { head: 0.6, tail: 0.6 })).toBe(0);
    expect(stagesShown(1, COUNT, { head: 0.6, tail: 0.6 })).toBe(COUNT);
  });

  it("answers 0 for an empty list of stages", () => {
    expect(stagesShown(1, 0)).toBe(0);
  });
});
