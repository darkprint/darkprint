"use client";

/* ============================================================
   One hook, and the whole of the motion in the luminous register.

   Redesign spec §1 hands five scenes to five authors at once, so
   the entrance below is written here rather than five times: a
   graph glowing into existence is the same beat wherever it
   happens, and five hand-rolled timelines would differ in their
   stagger and read as five different sites.

   Three responsibilities, and the reason each one is not left to
   the scene:

   1. **The gate.** `useReveal` is the single place this site decides
      whether anything moves. Its `static` phase is the server, a
      reader without JS and a reader who asked for reduced motion,
      and in that phase the markup is already the finished drawing,
      so playing there would take a drawing apart in front of
      exactly the reader who said no.
   2. **The label contract.** The stylesheet in `flow.ts` hides a
      label only under `[data-viz-labels="hover"]`, and this hook is
      the only thing that ever writes that attribute. That is what
      makes "no JS" one of the conditions under which every label on
      the site is visible; nothing has to remember it.
   3. **Cleanup.** `createScope` owns reverting every animation it
      built, including the looping pulses, which a hand-rolled
      `useEffect` teardown gets wrong the first time a scene is
      remounted by a route change.

   `createSeededRandom` rather than `Math.random`, for the pulse
   offsets. These scenes are server-rendered and a value that
   differed between the two passes would be a hydration mismatch;
   the seeded generator is also the only reason two edges can drift
   out of lockstep without a scene author choosing nine numbers.
   ============================================================ */

import {
  animate,
  createScope,
  createSeededRandom,
  createTimeline,
  stagger,
  svg,
  utils,
} from "animejs";
import { useRef, type RefObject } from "react";

import { FLOW, FLOW_SELECTOR, type FlowReveal } from "./flow";
import { useIsomorphicLayoutEffect, useReveal, type RevealPhase } from "./useReveal";

/**
 * Everything a scene's own beats would otherwise have to query for itself.
 *
 * Handed to `onScene`, inside the same scope, after the shared entrance has been built.
 * A scene that wants a beat of its own adds it to `timeline` and it is cleaned up with
 * everything else.
 */
export interface FlowParts {
  root: SVGSVGElement;
  /** The shared entrance. Empty when `entrance` is off, and still safe to add to. */
  timeline: ReturnType<typeof createTimeline>;
  /** Every node and every human mark, in document order. */
  nodes: NodeListOf<SVGGElement>;
  /** The discs alone, which is what may be scaled. */
  blooms: NodeListOf<SVGGElement>;
  /** The halo shells, for a scene that turns the lights down across a graph. */
  glows: NodeListOf<SVGCircleElement>;
  edges: NodeListOf<SVGGElement>;
  /** The base curves, already wrapped by `svg.createDrawable`. Animate `draw`. */
  lines: ReturnType<typeof svg.createDrawable>;
  /** The travelling segments. Animate `strokeDashoffset`; never hand one to a drawable. */
  pulses: NodeListOf<SVGPathElement>;
  absent: NodeListOf<SVGGElement>;
  labels: NodeListOf<SVGTextElement>;
  /** Deterministic, and the only source of jitter a scene may use. */
  random: (min?: number, max?: number, decimalLength?: number) => number;
}

export interface LuminousFlowOptions {
  /** Fraction of the scene that must be in view before it plays. */
  amount?: number;
  /** `rootMargin` for the observer. */
  margin?: string;
  /** Play the shared entrance. Off for a scene that choreographs itself entirely. */
  entrance?: boolean;
  /** Loop the travelling light on every present edge. */
  pulse?: boolean;
  /** One traversal of an edge, in milliseconds. */
  pulseDuration?: number;
  /** Seed for the pulse offsets and for any jitter a scene asks for. */
  seed?: number;
  /** A scene's own beats, added inside the same scope. */
  onScene?: (parts: FlowParts) => void;
}

export interface LuminousFlow<T extends SVGSVGElement> {
  ref: RefObject<T | null>;
  /** True except while the scene is armed and waiting to play. */
  shown: boolean;
  phase: RevealPhase;
  /** Spread onto `<FlowScene>`. Carries the ref, the label gate and the reveal phase. */
  scene: { ref: RefObject<T | null>; labels: FlowReveal; phase: RevealPhase };
}

/**
 * Attach to the `<FlowScene>` that owns the drawing.
 *
 *     const flow = useLuminousFlow();
 *     <FlowScene {...flow.scene} width={900} height={340} label="…">…</FlowScene>
 *
 * The scene it is attached to renders identically without it. That is the point: the hook
 * adds motion to a finished drawing and never produces one.
 */
export function useLuminousFlow<T extends SVGSVGElement = SVGSVGElement>(
  options: LuminousFlowOptions = {},
): LuminousFlow<T> {
  const {
    amount = 0.2,
    margin,
    entrance = true,
    pulse = true,
    pulseDuration = FLOW.pulse.duration,
    seed = FLOW.pulse.seed,
    onScene,
  } = options;

  const { ref, shown, phase } = useReveal<T>(
    margin === undefined ? { amount } : { amount, margin },
  );

  /* The latest-ref pattern, and the effect below deliberately does not depend on it. A
     scene passes `onScene` as an inline arrow, which is a new function on every render,
     and an effect that depended on it would revert and rebuild the whole scope on every
     render, which reads as a flicker. Declared first so it has already run by the time
     the effect underneath reads it. */
  const latest = useRef(onScene);
  useIsomorphicLayoutEffect(() => {
    latest.current = onScene;
  });

  useIsomorphicLayoutEffect(() => {
    if (phase !== "shown") return;
    const root = ref.current;
    if (root === null) return;

    const scope = createScope({ root }).add(() => {
      const nodes = root.querySelectorAll<SVGGElement>(
        `${FLOW_SELECTOR.node}, ${FLOW_SELECTOR.human}`,
      );
      const blooms = root.querySelectorAll<SVGGElement>(FLOW_SELECTOR.bloom);
      const glows = root.querySelectorAll<SVGCircleElement>(FLOW_SELECTOR.glow);
      const edges = root.querySelectorAll<SVGGElement>(FLOW_SELECTOR.edge);
      const absent = root.querySelectorAll<SVGGElement>(FLOW_SELECTOR.absentEdge);
      const pulses = root.querySelectorAll<SVGPathElement>(FLOW_SELECTOR.pulse);
      const sparks = root.querySelectorAll<SVGCircleElement>(FLOW_SELECTOR.spark);
      const labels = root.querySelectorAll<SVGTextElement>(FLOW_SELECTOR.label);
      /* Only the base curves. The pulse is a second path on the same geometry, and
         `createDrawable` works by writing `stroke-dasharray`, which is the whole of what
         makes the pulse a short travelling segment rather than a line. */
      const lines = svg.createDrawable(root.querySelectorAll(FLOW_SELECTOR.line));
      const random = createSeededRandom(seed);

      const timeline = createTimeline({ defaults: { ease: "outQuad" } });

      if (entrance) {
        /* Set rather than declared as a `from` value: a layout effect runs before paint,
           so the hidden state is what the reader's first frame shows and there is no
           finished drawing flashing up before it collapses. */
        utils.set(nodes, { opacity: 0 });
        utils.set(blooms, { scale: 0.55 });
        utils.set(lines, { draw: "0 0" });
        utils.set(pulses, { opacity: 0 });
        utils.set(sparks, { opacity: 0 });
        utils.set(absent, { opacity: 0 });

        /* Every step guarded on having a target.
           ------------------------------------------------------------
           `spark` is an opt-in prop on `FlowEdge` and the landing's graph does not set
           it, so `sparks` is an empty NodeList. Handing that to `timeline.add` makes
           anime.js log "No target found" and breaks the chain, and because the six
           `utils.set` calls above have already run, the whole scene stays at its hidden
           state. The landing's centrepiece rendered as an empty graticule: 70 circles in
           the DOM, every one of them at opacity 0, and nothing in the console but a
           warning.

           A scene omitting a glyph kind is ordinary, not an error. Five of the site's
           scenes carry no spark at all. So each step is added only if it has something
           to animate, and a scene that uses three of the six still plays the three. */
        if (nodes.length > 0)
          timeline.add(nodes, { opacity: 1, duration: 420 }, stagger(90));
        if (blooms.length > 0)
          timeline.add(blooms, { scale: 1, duration: 560, ease: "outCubic" }, stagger(90));
        if (lines.length > 0)
          timeline.add(lines, { draw: "0 1", duration: 560 }, stagger(80, { start: 340 }));
        if (pulses.length > 0)
          timeline.add(pulses, { opacity: 1, duration: 420 }, stagger(80, { start: 720 }));
        if (sparks.length > 0)
          timeline.add(sparks, { opacity: 1, duration: 420 }, stagger(80, { start: 720 }));
        /* Last, and alone. A reader who has just watched five edges land is the reader
           most likely to notice the sixth one that never connects. */
        if (absent.length > 0)
          timeline.add(absent, { opacity: 1, duration: 640 }, "+=180");
      }

      if (pulse && pulses.length > 0) {
        /* `pathLength="1"` on the markup puts the dash pattern in a normalised space, so
           one whole unit of offset is one traversal of the curve whatever its length, and
           the loop closes on the value it started from. Nothing measures a path. */
        animate(pulses, {
          strokeDashoffset: [FLOW.pulse.rest, FLOW.pulse.rest - 1],
          duration: pulseDuration,
          ease: "linear",
          loop: true,
          delay: () => random(0, pulseDuration),
        });
      }

      /* `svg.createMotionPath` positions by transform, so a spark parked on the start of
         its curve in the markup would be offset twice. The markup keeps that position
         because a scene with no script has to be a finished drawing; the correction
         belongs here, where script is already running. */
      for (const edge of Array.from(edges)) {
        const line = edge.querySelector<SVGPathElement>(FLOW_SELECTOR.line);
        const spark = edge.querySelector<SVGCircleElement>(FLOW_SELECTOR.spark);
        if (line === null || spark === null) continue;
        utils.set(spark, { cx: 0, cy: 0 });
        const along = svg.createMotionPath(line);
        animate(spark, {
          translateX: along.translateX,
          translateY: along.translateY,
          duration: pulseDuration,
          ease: "linear",
          loop: true,
          delay: random(0, pulseDuration),
        });
      }

      latest.current?.({
        root,
        timeline,
        nodes,
        blooms,
        glows,
        edges,
        lines,
        pulses,
        absent,
        labels,
        random,
      });
    });

    return () => {
      scope.revert();
    };
  }, [phase, ref, entrance, pulse, pulseDuration, seed]);

  return {
    ref,
    shown,
    phase,
    /* `static` is the server, a reader with no script and a reader who asked for reduced
       motion, and all three get a figure with every label showing. The hook is the only
       writer of this attribute, which is what makes the no-JS case fall out of the
       architecture rather than out of somebody remembering it. */
    scene: { ref, labels: phase === "static" ? "always" : "hover", phase },
  };
}
