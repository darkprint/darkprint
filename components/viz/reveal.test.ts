/* ============================================================
   The reduced-motion decision, checked without a browser.

   The suite is `environment: "node"` by design (`vitest.config.ts`)
   and there is no DOM to render a hook into, which is why the
   decision was pulled out of `useReveal` and into `revealPhase`:
   the part worth guarding is the arithmetic, and the arithmetic
   takes three booleans.

   What each case here is protecting is stated on it. Two of them
   are the failure modes that make a motion gate worth having at
   all — a query that never matches, and a hidden state that
   nothing arrives to clear.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  REDUCED_MOTION_QUERY,
  revealPhase,
  revealShown,
  type RevealEnv,
} from "./useReveal";

/** Motion allowed, an observer watching, offscreen. The ordinary case. */
const BASE: RevealEnv = { motion: true, observer: true, intersected: false };

describe("the media query", () => {
  /**
   * A typo evaluates to a query that matches nothing, which reads as "no reader has asked
   * for reduced motion" and animates the site for everyone who did. It throws nothing and
   * warns nowhere, so the string is asserted rather than trusted.
   */
  it("is the one the spec defines", () => {
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
  });
});

describe("reduced motion renders the finished drawing", () => {
  it("is static whether or not the element has arrived", () => {
    expect(revealPhase({ ...BASE, motion: false })).toBe("static");
    expect(revealPhase({ ...BASE, motion: false, intersected: true })).toBe("static");
  });

  /**
   * Spec §1: "with JS disabled the scene is legible". `motion: false` is also what the
   * server and the first client render report, so the prerendered HTML holds the finished
   * drawing and hydration has nothing to disagree about.
   */
  it("shows the content in the static phase", () => {
    expect(revealShown(revealPhase({ ...BASE, motion: false }))).toBe(true);
  });
});

describe("a missing IntersectionObserver renders the finished drawing", () => {
  /**
   * Arming hides the element and only the observer un-hides it. Without one, an armed
   * element is a drawing nothing is ever going to show, so the absence lands on `static`
   * alongside reduced motion rather than on `armed`.
   */
  it("is static, never armed", () => {
    expect(revealPhase({ ...BASE, observer: false })).toBe("static");
    expect(revealPhase({ ...BASE, observer: false, intersected: true })).toBe("static");
    expect(revealShown(revealPhase({ ...BASE, observer: false }))).toBe(true);
  });
});

describe("with motion allowed and an observer watching", () => {
  it("arms before the element arrives and shows after", () => {
    expect(revealPhase(BASE)).toBe("armed");
    expect(revealPhase({ ...BASE, intersected: true })).toBe("shown");
  });

  /** The one phase that withholds the drawing, and the only one JS can produce. */
  it("hides in the armed phase alone", () => {
    expect(revealShown("armed")).toBe(false);
    expect(revealShown("static")).toBe(true);
    expect(revealShown("shown")).toBe(true);
  });
});
