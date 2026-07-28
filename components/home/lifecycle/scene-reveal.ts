"use client";

/* ============================================================
   One entrance, shared by the three drawings in this section.

   Spec §1 puts two rules on any animated scene, and they pull in
   opposite directions:

     the static SVG is already the finished drawing, and
     animation is added to it rather than being what reveals it;

     motion runs only when the reader has not asked for less.

   `useReveal` settles the second and hands back a phase. This hook
   settles the first, and the awkward part is the seam between
   them. A scene renders its wrapper at `opacity: 0` while the
   phase is `armed`, so the moment the phase flips to `shown` React
   paints that wrapper opaque again. Everything inside it therefore
   has to be at nothing *before* that paint, which is why the work
   below runs in a layout effect and starts with `utils.set`: a
   frame between the two would be the whole drawing flashing on and
   collapsing, which is worse than no animation at all.

   Nothing here decides whether content exists. Every property it
   touches is opacity or stroke geometry, so the phase that never
   runs it — `static`, which is the server, a reader with no JS and
   a reader who asked for reduced motion — is the finished drawing
   with nothing missing from it.
   ============================================================ */

import { animate, stagger, svg, utils, type JSAnimation } from "animejs";
import type { RefObject } from "react";

import { VIZ_SELECTOR } from "@/components/viz";
import { useIsomorphicLayoutEffect, useReveal } from "@/components/viz/useReveal";

/**
 * What the entrance moves, scoped to one scene's own subtree.
 *
 * The four glyph groups, plus `data-scene-part` for anything a scene draws itself: a
 * caption, a bracket, a rule. A label inside a glyph is not listed and does not need to
 * be, since it rides on its group's opacity.
 *
 * Every selector is queried from the scene element rather than from the document. The
 * landing carries several of these drawings and a document-wide query would animate all
 * of them the first time any one of them arrived.
 */
const PARTS = [
  VIZ_SELECTOR.node,
  VIZ_SELECTOR.edge,
  VIZ_SELECTOR.absentEdge,
  VIZ_SELECTOR.human,
  "[data-scene-part]",
].join(", ");

/** The runs an edge is made of: the line and the drawn arrowhead beside it. */
const EDGE_GEOMETRY = `${VIZ_SELECTOR.edge} path`;

export interface SceneReveal {
  /** Goes on the `<svg>`. */
  ref: RefObject<SVGSVGElement | null>;
  /**
   * Hold the drawing at nothing.
   *
   * True only in `armed`: on the server, without JS and under reduced motion it is false,
   * so the markup that ships is the finished drawing.
   */
  armed: boolean;
}

/**
 * The glyphs fade in, then the wires draw themselves along their own geometry.
 *
 *     const { ref, armed } = useSceneReveal();
 *     <Scene ref={ref} …>
 *       <g style={{ opacity: armed ? 0 : 1 }}>…</g>
 *     </Scene>
 *
 * The wrapper is the caller's because a scene knows where its own transforms are. Held on
 * a `<g>` rather than on the `<svg>`, so the box the viewBox reserves is laid out either
 * way and nothing on the page moves when the drawing arrives.
 */
export function useSceneReveal(): SceneReveal {
  const { ref, phase } = useReveal<SVGSVGElement>({ amount: 0.3 });

  useIsomorphicLayoutEffect(() => {
    if (phase !== "shown") return;
    const root = ref.current;
    if (root === null) return;

    const parts = Array.from(root.querySelectorAll<SVGGElement>(PARTS));
    if (parts.length === 0) return;

    const wires = parts.filter((part) => part.dataset.viz === "edge");
    const glyphs = parts.filter((part) => part.dataset.viz !== "edge");

    /* Before the paint that this effect is racing. `animate` alone would leave the
       elements at their rendered opacity until the engine's first tick. */
    const held = utils.set(parts, { opacity: 0 });

    const running: JSAnimation[] = [held];
    running.push(
      animate(glyphs, {
        opacity: [0, 1],
        duration: 420,
        delay: stagger(70),
        ease: "outQuad",
      }),
    );

    /* Two animations on the same elements rather than one, because they are two different
       statements: an edge appears, and then it is drawn. `createDrawable` is handed the
       geometry it found under this scene, never a selector string, for the same
       one-scene-at-a-time reason as `PARTS`. */
    const drawn = svg.createDrawable(root.querySelectorAll(EDGE_GEOMETRY));
    if (wires.length > 0) {
      running.push(
        animate(wires, {
          opacity: [0, 1],
          duration: 160,
          delay: stagger(60, { start: 240 }),
          ease: "linear",
        }),
      );
    }
    if (drawn.length > 0) {
      running.push(
        animate(drawn, {
          draw: ["0 0", "0 1"],
          duration: 520,
          delay: stagger(60, { start: 240 }),
          ease: "outQuad",
        }),
      );
    }

    return () => {
      // `createDrawable` writes a dash array onto every path it is handed, and `utils.set`
      // writes an inline opacity onto every part. Reverting hands both back rather than
      // leaving a half-drawn wire behind if the scene is torn down mid-entrance.
      for (const animation of running) animation.revert();
    };
  }, [phase, ref]);

  return { ref, armed: phase === "armed" };
}
