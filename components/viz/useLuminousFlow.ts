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
      remounted by a route change. On an SSG site a route change is
      the only unmount there is, though, so the loops are also parked
      by an observer of their own whenever the figure scrolls away —
      see "Park the loops" below.

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
import { EASE_OUT } from "./easing";
import { useIsomorphicLayoutEffect, useReveal, type RevealPhase } from "./useReveal";

/**
 * The stagger step that fits `n` items inside a fixed `total` window.
 *
 * The entrance used to hand every group a fixed per-item delay, which quietly made the
 * timeline a function of the graph: five nodes at `stagger(90)` finish in 360ms, ten finish
 * in 810ms, fourteen edges in 1040ms. So the bigger and more argued a figure was, the later
 * its last beat landed — and the last beat is the absent edge, the one drawing on this site
 * that carries a claim rather than a fact. Measured before this: the landing's absence
 * completed at ≈2.28s and /spec/topology's at ≈3.0s, and neither appeared in a capture taken
 * at 1.5s. A reader had already moved on.
 *
 * A window instead of a step inverts that: the group always takes the same time, and more
 * items simply arrive closer together, which is what a stagger is for. The 90ms cap keeps a
 * small graph from becoming a slideshow — below about five items the window would otherwise
 * spread them further apart than the eye reads as one gesture.
 */
const spread = (total: number, n: number) => (n > 1 ? Math.min(90, total / (n - 1)) : 0);

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
      const labels = root.querySelectorAll<SVGTextElement>(FLOW_SELECTOR.label);
      /* Only the base curves. The pulse is a second path on the same geometry, and
         `createDrawable` works by writing `stroke-dasharray`, which is the whole of what
         makes the pulse a short travelling segment rather than a line. */
      const lines = svg.createDrawable(root.querySelectorAll(FLOW_SELECTOR.line));
      const random = createSeededRandom(seed);

      /* `outQuad` was the default here and is retired site-wide: it is near-linear on
         opacity, so a node arriving read as a slideshow cross-fade rather than as a lamp
         switching on, and the lamp is the luminous register's whole gesture. `EASE_OUT`
         is the same curve the stylesheet spends on every hover and press, so the DOM and the
         SVG move on one clock. See the docblock on `MOTION` in `tokens.ts`.

         It is `EASE_OUT` from `./easing` and NOT `MOTION.easeOut`: anime.js 4.5.0 has
         removed the `cubicBezier(...)` string form, so the token — which is still exactly
         right as a CSS value — silently parses to `t => t` here. Every figure on the site
         was running linear. `easing.ts` derives the function from the same token. */
      const timeline = createTimeline({ defaults: { ease: EASE_OUT } });

      /* Every looping animation this scope builds, so the observer below can park them.
         Collected rather than re-queried because `animate` is the only thing that knows
         which handle belongs to which target. */
      const loops: ReturnType<typeof animate>[] = [];

      if (entrance) {
        /* Set rather than declared as a `from` value: a layout effect runs before paint,
           so the hidden state is what the reader's first frame shows and there is no
           finished drawing flashing up before it collapses. */
        utils.set(nodes, { opacity: 0 });
        utils.set(blooms, { scale: 0.55 });
        utils.set(lines, { draw: "0 0" });
        utils.set(pulses, { opacity: 0 });
        utils.set(absent, { opacity: 0 });

        /* Every step guarded on having a target.
           ------------------------------------------------------------
           A glyph kind a scene does not use resolves to an empty NodeList, and handing
           that to `timeline.add` makes anime.js log "No target found" and breaks the
           chain — and because the `utils.set` calls above have already run, the whole
           scene then stays at its hidden state. The landing's centrepiece rendered as an
           empty graticule exactly once this way: 70 circles in the DOM, every one of them
           at opacity 0, and nothing in the console but a warning.

           A scene omitting a glyph kind is ordinary, not an error. So each step is added
           only if it has something to animate, and a scene that uses three of the five
           still plays the three.

           ── The ceiling ──
           Every position below is absolute, from a fixed window rather than a fixed
           per-item delay, so the whole entrance completes at ≈1.4s on a five-node landing
           and on a fourteen-edge topology alike. What used to happen: the groups chained,
           the staggers grew with the graph, and the absent edge — chained last on a
           relative `"+=180"` — landed at ≈1.64s on the landing and ≈2.5s on
           /spec/topology, finishing at 2.28s and 3.0s. Under a sheet captioned "one run
           deliberately missing", nobody saw the missing run. */
        if (nodes.length > 0)
          timeline.add(nodes, { opacity: 1, duration: 360 }, stagger(spread(420, nodes.length)));
        if (blooms.length > 0)
          timeline.add(
            blooms,
            { scale: 1, duration: 480, ease: EASE_OUT },
            stagger(spread(420, blooms.length)),
          );
        if (lines.length > 0)
          timeline.add(
            lines,
            { draw: "0 1", duration: 520 },
            stagger(spread(420, lines.length), { start: 260 }),
          );
        if (pulses.length > 0)
          timeline.add(
            pulses,
            { opacity: 1, duration: 360 },
            stagger(spread(360, pulses.length), { start: 560 }),
          );
        /* Last, and alone. A reader who has just watched five edges land is the reader
           most likely to notice the sixth one that never connects. The 980 is absolute
           for that reason: the beat is editorial, so it may not drift with the edge
           count — a graph that argues harder must not argue later. */
        if (absent.length > 0) timeline.add(absent, { opacity: 1, duration: 420 }, 980);
      }

      if (pulse && pulses.length > 0) {
        /* `pathLength="1"` on the markup puts the dash pattern in a normalised space, so
           one whole unit of offset is one traversal of the curve whatever its length, and
           the loop closes on the value it started from. Nothing measures a path. */
        loops.push(
          animate(pulses, {
            strokeDashoffset: [FLOW.pulse.rest, FLOW.pulse.rest - 1],
            duration: pulseDuration,
            ease: "linear",
            loop: true,
            delay: () => random(0, pulseDuration),
          }),
        );
      }

      /* Park the loops while the figure is off screen.
         ------------------------------------------------------------
         `loop: true` never ends, and `createScope` only reverts on unmount — which, on an
         SSG site, means a route change. So a scene that has played once keeps animating
         `stroke-dashoffset` for the rest of the session, long after it has scrolled away.
         That property is not compositable: each of the fourteen pulse paths on
         /spec/topology forces a main-thread repaint of its own geometry, every frame,
         forever, on a page the reader is no longer looking at.

         `useReveal`'s own observer cannot do this job — it is deliberately one-way, so the
         entrance plays once rather than replaying on every scroll past. This is a second,
         cheaper observer with `threshold: 0`, and it touches nothing but the clock: the
         entrance is untouched, and a paused loop resumes from the phase it was parked at,
         so nothing on screen jumps. */
      let visibility: IntersectionObserver | null = null;
      if (loops.length > 0 && typeof IntersectionObserver === "function") {
        visibility = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              for (const loop of loops) {
                if (entry.isIntersecting) loop.resume();
                else loop.pause();
              }
            }
          },
          { threshold: 0 },
        );
        visibility.observe(root);
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

      /* The scope reverts every animation it built; the observer above is not one of
         those, so it is handed back here and `scope.revert()` disconnects it. */
      return () => {
        visibility?.disconnect();
      };
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
