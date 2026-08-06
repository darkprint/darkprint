/* ============================================================
   The site's curves, in the form anime.js will actually run.

   `MOTION.easeOut` / `MOTION.easeInOut` in `tokens.ts` are the
   curves as CSS spells them — `"cubicBezier(0.23,1,0.32,1)"` —
   which is what a `transition-timing-function` needs and what
   every stylesheet call site takes.

   THE ANIMATION LIBRARY NO LONGER ACCEPTS THAT STRING. `parseEase`
   in animejs 4.5.0 (dist/bundles/anime.esm.js:3578) tests the value
   against a `deprecated` list — `steps(`, `irregular(`, `linear(`,
   `cubicBezier(` — logs "String syntax ... has been removed from
   the core", and returns `none`, which is `t => t`. That is LINEAR.
   The ease is not merely deprecated, it is dropped, and a timeline
   handed the string plays with no curve at all while reading as
   correct in the source. It was doing exactly that on every
   luminous figure on the site: 21 warnings per landing scroll.

   So the four control points are read back out of the token rather
   than typed again here. The curve keeps exactly one definition —
   `MOTION` in `tokens.ts` — and moving it there moves it here too,
   which is the whole reason that file exists.

   WHY THIS IS NOT IN `tokens.ts`: `components/viz/index.ts` is the
   render-safe barrel and re-exports `./tokens` by name, on the
   written promise that a server component may draw a static
   luminous figure and "pay nothing for it". An `import ... from
   "animejs"` at the top of `tokens.ts` would put the engine in
   every bundle that draws a thumbnail. This module is imported
   only by the two `"use client"` files that drive a timeline, and
   is deliberately absent from the barrel for the same reason the
   hooks are.
   ============================================================ */

import { cubicBezier } from "animejs";
import { MOTION } from "./tokens";

/** The four numbers inside a `cubicBezier(a,b,c,d)` token, as an anime.js easing function. */
function fromToken(token: string) {
  const [a, b, c, d] = (token.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  return cubicBezier(a, b, c, d);
}

/**
 * THE default curve — every entrance, every hover, every press, every draw.
 * The JS twin of `MOTION.easeOut` and of `--ease-out` in `app/globals.css`.
 */
export const EASE_OUT = fromToken(MOTION.easeOut);

/**
 * Rest-to-rest moves only: a panel that slides, a value that counts. Never a draw.
 * The JS twin of `MOTION.easeInOut` and of `--ease-in-out` in `app/globals.css`.
 */
export const EASE_IN_OUT = fromToken(MOTION.easeInOut);
