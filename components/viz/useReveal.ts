"use client";

/* ============================================================
   The one place this site decides whether anything moves.

   Spec §2a: "The single place motion is gated. No component calls
   `matchMedia` itself." Both hooks in this tree read the gate from
   `useMotionAllowed` below, and so does every scene, which is what
   makes `prefers-reduced-motion: reduce` a property of the site
   rather than a habit nine components have to remember.

   The three-phase shape is the awkward part, and it exists because
   spec §1 asks for two things that a plain `shown` boolean cannot
   both satisfy:

     "the content must be in the prerendered HTML"
     "with JS disabled the scene is legible: the static SVG is the
      finished drawing, and animation is the thing that is added,
      never the thing that reveals."

   A reveal hook that starts at `false` and flips to `true` breaks
   the second rule: the server writes the hidden state into the
   HTML and a reader without JS never sees the drawing. So the
   hidden state is not a starting point, it is something JS *puts
   there* once it knows it is going to take it away again:

     static  server, no JS, reduced motion  -> the finished drawing
     armed   client, motion allowed, offscreen -> the "from" state
     shown   client, motion allowed, in view   -> the finished drawing

   `shown` is true for `static` and `shown` and false only for
   `armed`, so a consumer that reads nothing but `shown` gets all
   four situations right.

   Arming happens in a layout effect rather than a passive one for
   the obvious reason: a passive effect runs after paint, so a
   reader would see the finished drawing flash and collapse before
   it animated back in.
   ============================================================ */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * `useLayoutEffect` warns when React renders it on the server, and this module is
 * prerendered like every other client component on an SSG site. Picking the hook once, at
 * module scope, keeps the call site unconditional so the rules-of-hooks analysis still
 * holds.
 */
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Exported so a test can assert the exact string.
 *
 * A typo in a media query does not throw and does not warn. It evaluates to a query that
 * never matches, which reads as "this reader is fine with motion" for every reader, which
 * is the one failure mode of an accessibility gate that nobody notices.
 */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export type RevealPhase = "static" | "armed" | "shown";

export interface RevealEnv {
  /** The reader has not asked for reduced motion. */
  motion: boolean;
  /** An `IntersectionObserver` exists and is watching the element. */
  observer: boolean;
  /** The element has met the threshold. */
  intersected: boolean;
}

/**
 * The gate, as arithmetic, so it can be checked without a DOM (`vitest.config.ts` runs the
 * suite under `environment: "node"`).
 *
 * A missing `IntersectionObserver` lands on `static` alongside reduced motion, and that is
 * the whole reason the two are one branch: without a way to know when the element arrives,
 * arming it would hide a drawing that nothing is ever going to un-hide.
 */
export function revealPhase(env: RevealEnv): RevealPhase {
  if (!env.motion || !env.observer) return "static";
  return env.intersected ? "shown" : "armed";
}

/** Whether the phase should render the finished drawing. Only `armed` should not. */
export function revealShown(phase: RevealPhase): boolean {
  return phase !== "armed";
}

/**
 * False until the client has looked, which is what keeps hydration honest: the server has
 * no reader and no media query, so it renders the un-animated page, and the first client
 * render has to agree with it before anything is allowed to change.
 */
export function useMotionAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const read = () => {
      setAllowed(!query.matches);
    };
    read();
    // Readers change this setting mid-session, at the OS level, without reloading.
    query.addEventListener("change", read);
    return () => {
      query.removeEventListener("change", read);
    };
  }, []);

  return allowed;
}

export interface RevealOptions {
  /** Fraction of the element that must be in view before it counts as arrived. */
  amount?: number;
  /** `rootMargin`. The default lets an element start before it is fully on screen. */
  margin?: string;
  /** Re-arm when the element leaves the viewport. Off, because a scene that replays on
      every scroll past is a distraction rather than an entrance. */
  repeat?: boolean;
}

export interface Reveal<T extends Element> {
  ref: RefObject<T | null>;
  /** Render the finished state. True on the server, without JS, and under reduced motion. */
  shown: boolean;
  /** Which of the three situations this is. An anime.js driver plays on `shown` and must
      never play on `static`, where the markup is already the finished drawing. */
  phase: RevealPhase;
}

/**
 * Attach to the element that owns the scene, spend the result on opacity, transform or
 * stroke, and on nothing that decides whether the content exists.
 *
 *     const { ref, shown } = useReveal<SVGSVGElement>();
 *     <Scene ref={ref} className={shown ? "opacity-100" : "opacity-0 translate-y-2"} />
 */
export function useReveal<T extends Element = HTMLDivElement>(
  options: RevealOptions = {},
): Reveal<T> {
  const { amount = 0.25, margin = "0px 0px -12% 0px", repeat = false } = options;

  const ref = useRef<T | null>(null);
  const motion = useMotionAllowed();
  const [observer, setObserver] = useState(false);
  const [intersected, setIntersected] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (!motion) return;
    const element = ref.current;
    if (element === null) return;
    if (typeof IntersectionObserver !== "function") return;

    // Set before the observer fires: this render pass is what moves the element out of
    // `static` and into `armed`, and it happens inside a layout effect so the reader never
    // sees the finished drawing painted first.
    setObserver(true);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setIntersected(true);
          else if (repeat) setIntersected(false);
        }
      },
      { threshold: amount, rootMargin: margin },
    );
    io.observe(element);
    return () => {
      io.disconnect();
    };
  }, [motion, amount, margin, repeat]);

  const phase = revealPhase({ motion, observer, intersected });
  return { ref, shown: revealShown(phase), phase };
}
