"use client";

/* ============================================================
   How far a reader has travelled through a tall section, 0..1.

   Spec §3.2 is the customer: a sticky viewport holding one node
   card and a row of annotations that attach one at a time as the
   reader descends. Both read the same number.

   There was a third reader, a dezoom at the end of the same walk,
   and it is gone with `NodeCardStage` — the author asked
   `/spec/card` to draw the landing's figure, which has no ending
   of its own. The `tail` reserve below exists for exactly that
   shape and currently has no caller passing one; it is kept
   because a walk that ends on something is the case the parameter
   was derived for, not a speculative one.

   Two decisions worth stating, because both are load-bearing:

   1. The gate comes from `./useReveal`, not from a second
      `matchMedia` call. Spec §2a allows exactly one, and a reader
      who has asked for no motion should not have a section that
      reads their scroll position either.

   2. When motion is gated off the hook reports `progress: 1` and
      attaches no listeners. One is the finished state, so the
      server, a reader without JS and a reader with reduced motion
      all get every annotation attached at once — which is what
      §3.2 asks for in as many words, and which is also what puts
      the annotation copy into `.next/server/app/index.html` where
      the build's own grep expects to find it.
   ============================================================ */

import { useRef, useState, type RefObject } from "react";

import { useIsomorphicLayoutEffect, useMotionAllowed } from "./useReveal";

/**
 * 0..1, with a NaN guard.
 *
 * NaN is the one input the comparisons below cannot answer: it is neither `<= 0` nor
 * `>= 1`, so an unguarded clamp returns it unchanged and every `Math.ceil` downstream
 * returns NaN too. It arrives from a division by a zero-height rect, which is what a node
 * detached between the scroll event and the animation frame measures as. An infinity is a
 * value past an end and the comparisons handle it correctly.
 */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * The pin travel, expressed as a fraction.
 *
 * A section taller than the viewport holding a `position: sticky` child is pinned for
 * exactly `height − viewport` pixels, and the fraction of that distance already scrolled is
 * `−top / (height − viewport)`. That is the whole formula, and it is the one the
 * choreography wants: 0 the moment the sticky child locks to the top of the screen, 1 the
 * moment it lets go.
 *
 * The other branch covers a section that is not tall enough to pin at all, which is what
 * the centrepiece becomes below `md` once the stacked layout collapses its height. There
 * is no pin travel to measure, so the section's own passage across the viewport stands in.
 * It still runs 0 to 1 monotonically, which is the only property any consumer relies on.
 *
 * Pure and takes plain numbers rather than a `DOMRect`, so both ends can be checked in the
 * node suite.
 */
export function scrollProgress(top: number, height: number, viewport: number): number {
  const pinTravel = height - viewport;
  const span = pinTravel > 0 ? pinTravel : height;
  if (span <= 0) return 0;
  return clamp01(-top / span);
}

export interface StageReserve {
  /** Fraction of the scroll spent before the first stage attaches, for the subject to
      settle. */
  head?: number;
  /** Fraction reserved after the last one, for whatever the scroll ends on. */
  tail?: number;
}

/**
 * How many of `count` stages a progress value has revealed, 0..count.
 *
 * `Math.ceil` rather than `floor`: stage 1 should attach as soon as the reader moves past
 * the head reserve, not a seventh of the way down. At `progress = 1` every stage is
 * attached, which is what makes the gated-off `progress: 1` above render the finished
 * state instead of an empty one.
 */
export function stagesShown(
  progress: number,
  count: number,
  reserve: StageReserve = {},
): number {
  if (count <= 0) return 0;
  const head = reserve.head ?? 0;
  const tail = reserve.tail ?? 0;
  const span = 1 - head - tail;
  const clamped = clamp01(progress);
  // A reserve that swallows the whole scroll leaves nowhere to stage anything, so the
  // stages arrive together at the end rather than never.
  if (span <= 0) return clamped >= 1 ? count : 0;
  const local = clamp01((clamped - head) / span);
  return Math.min(count, Math.ceil(local * count));
}

export interface ScrollProgressOptions {
  /**
   * Quantisation of the returned value. 100 is one percent, which is finer than any
   * staging decision and coarse enough that a scroll re-renders the subtree a hundred
   * times rather than once a frame.
   */
  steps?: number;
  /**
   * The unrounded value, delivered inside the animation frame.
   *
   * This is the escape hatch for an anime.js timeline driven by scroll: seek it here and
   * the drawing moves at frame rate while React re-renders only on the quantised value.
   */
  onProgress?: (progress: number) => void;
}

export interface ScrollProgress<T extends Element> {
  ref: RefObject<T | null>;
  /** 0..1, quantised by `steps`. 1 whenever motion is gated off. */
  progress: number;
  /** The gate, forwarded. False on the server and on the first client render. */
  motion: boolean;
}

/*
 * `pinned` used to be a third field: `rect.height > viewport`, set from inside `measure`
 * on every animation frame of every scroll. No consumer ever read it. `CardWalk` is the
 * only caller and destructures `{ ref, progress, motion }`, and the layout question it
 * would have answered is answered by a media query instead, so the state existed only to
 * be written. Spec §2a makes this module part of the vocabulary eight components share,
 * and a shared vocabulary carrying a field nobody can use teaches the next author to pass
 * it around.
 */

/**
 * Attach to the tall outer element, not to the sticky child. The child does not move
 * relative to the viewport while it is pinned, so its own rect says nothing.
 */
export function useScrollProgress<T extends Element = HTMLDivElement>(
  options: ScrollProgressOptions = {},
): ScrollProgress<T> {
  const { steps = 100, onProgress } = options;

  const ref = useRef<T | null>(null);
  const motion = useMotionAllowed();
  const [progress, setProgress] = useState(1);

  // Through a ref so a caller may pass an inline closure without tearing down the
  // listeners on every render.
  const sink = useRef(onProgress);
  useIsomorphicLayoutEffect(() => {
    sink.current = onProgress;
  });

  useIsomorphicLayoutEffect(() => {
    if (!motion) return;
    const element = ref.current;
    if (element === null) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const node = ref.current;
      if (node === null) return;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;
      const value = scrollProgress(rect.top, rect.height, viewport);
      sink.current?.(value);
      const quantised = Math.round(value * steps) / steps;
      setProgress((current) => (current === quantised ? current : quantised));
    };

    // Scroll fires far more often than the screen refreshes, so the listener does no work
    // beyond booking a frame, and books at most one.
    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    // The section's height changes without a scroll or a resize: a font loads, an image
    // settles, or the stacked layout collapses. Without this the pin travel is measured
    // once against a height that no longer exists.
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(element);

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [motion, steps]);

  return { ref, progress, motion };
}
