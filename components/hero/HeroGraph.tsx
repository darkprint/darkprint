"use client";

/* ============================================================
   The blueprint sheet the hero's graph draws itself on.

   Spec §3.1 asks for one viewport in which five boxes appear in
   order, the wires connect them, and a classification settles
   beside the result. What makes that safe to animate is the rule
   in spec §1: the finished drawing is what the server renders, and
   motion is added to it afterwards. `useReveal` is the whole gate.
   Its `static` phase is the server, a reader with JS off and a
   reader who asked for reduced motion, and in that phase not one
   attribute below hides anything.

   The hidden state is therefore something the client puts there,
   in a layout effect, once it knows it is about to take it away
   again. That is why `hide` keys off `phase !== "static"` and stays
   applied for the whole run: anime.js writes inline styles onto the
   same elements and an inline write beats the one React made, so
   there is no frame in which the drawing is visible before the
   timeline has decided where it should be.

   The handles are `data-hero` rather than the vocabulary's own
   `data-viz-id`. The attribute has to sit on the element that
   carries the hidden state, which is the wrapper this file renders
   rather than the `<g>` inside `NodeBox`, and one element with one
   handle is easier to keep true than two elements agreeing.
   ============================================================ */

import Link from "next/link";
import { useEffect } from "react";
import { createDrawable, createTimeline, utils } from "animejs";

import { Edge, NodeBox, Scene, Sheet, VIZ_SELECTOR } from "@/components/viz";
import { useReveal } from "@/components/viz/useReveal";

import {
  HERO_CHIP_START,
  HERO_NARROW,
  HERO_SCENE_LABEL,
  HERO_TIMING,
  HERO_WIDE,
  type HeroLayout,
} from "./graph";

const BLUEPRINT_HREF = "/blueprints/starter-software-factory";

/** Every element the timeline touches carries this, and the timeline finds them by it. */
function handle(id: string): string {
  return `[data-hero="${id}"]`;
}

function Drawing({
  layout,
  className,
  hide,
}: {
  layout: HeroLayout;
  /** Which breakpoint this placement belongs to. */
  className: string;
  /** The state the client arms the drawing into. Undefined leaves the finished drawing. */
  hide?: React.CSSProperties;
}) {
  return (
    <Scene
      width={layout.width}
      height={layout.height}
      label={HERO_SCENE_LABEL}
      className={className}
    >
      {/* Wires first, so a box knocks the graticule and the line out from behind its
          own label rather than being crossed by them. */}
      {layout.edges.map((edge) => (
        <g key={edge.id} data-hero={edge.id} style={hide}>
          <Edge from={edge.from} to={edge.to} bend={edge.bend} label={edge.label} />
        </g>
      ))}
      {layout.nodes.map((node) => (
        <g key={node.id} data-hero={node.id} style={hide}>
          <NodeBox
            x={node.x}
            y={node.y}
            label={node.id}
            sub={layout.detail ? node.phase : undefined}
          />
        </g>
      ))}
    </Scene>
  );
}

export function HeroGraph() {
  const { ref, phase } = useReveal<HTMLDivElement>({ amount: 0.15 });

  useEffect(() => {
    if (phase !== "shown") return;
    const root = ref.current;
    if (root === null) return;

    const find = (id: string): SVGGElement[] => [
      ...root.querySelectorAll<SVGGElement>(handle(id)),
    ];

    /* Both placements are in the DOM at once and one of them is display:none, so every
       selection below is a list rather than an element. The hidden one animates too, which
       costs nothing and means a reader who rotates a tablet mid-run does not land on a
       half-drawn sheet. */
    const styled: (HTMLElement | SVGElement)[] = [];
    const drawn: SVGPathElement[] = [];

    /* A wire's label is a `<text>` inside the wire's own group, so the group's opacity
       cannot hold it back once the line starts drawing. Hidden here, while the group is
       still at the opacity React rendered it with, so nothing is painted in between. */
    const labels = [
      ...root.querySelectorAll<SVGTextElement>(`${VIZ_SELECTOR.edge} text`),
    ];
    if (labels.length > 0) {
      utils.set(labels, { opacity: 0 });
      styled.push(...labels);
    }

    const timeline = createTimeline({ defaults: { ease: "outQuad" } });

    for (const node of HERO_WIDE.nodes) {
      const boxes = find(node.id);
      if (boxes.length === 0) continue;
      styled.push(...boxes);
      timeline.add(boxes, { opacity: [0, 1], duration: HERO_TIMING.node }, node.start);
    }

    for (const edge of HERO_WIDE.edges) {
      const groups = find(edge.id);
      if (groups.length === 0) continue;
      styled.push(...groups);
      const paths = groups.flatMap((group) => [
        ...group.querySelectorAll<SVGPathElement>("path"),
      ]);
      drawn.push(...paths);

      /* The group is switched on rather than faded: what the reader should see arriving is
         the line drawing itself, and the paths are held back by `createDrawable`, which
         sets them to an empty dash the moment it is called. */
      timeline.add(groups, { opacity: 1, duration: 1 }, edge.start);
      timeline.add(
        createDrawable(paths),
        { draw: ["0 0", "0 1"], duration: HERO_TIMING.wire, ease: "inOutQuad" },
        edge.start,
      );
      const carried = groups.flatMap((group) => [
        ...group.querySelectorAll<SVGTextElement>("text"),
      ]);
      if (carried.length > 0) {
        timeline.add(
          carried,
          { opacity: [0, 1], duration: HERO_TIMING.label },
          edge.start + HERO_TIMING.labelDelay,
        );
      }
    }

    const chip = root.querySelector<HTMLElement>(handle("chip"));
    if (chip !== null) {
      styled.push(chip);
      timeline.add(
        chip,
        { opacity: [0, 1], translateY: [8, 0], duration: HERO_TIMING.chip },
        HERO_CHIP_START,
      );
    }

    return () => {
      /* `revert` seeks the timeline back to zero, which leaves every target holding the
         state it started from. That is the wrong state to leave behind, because the one
         way this effect tears down without the page going with it is a reader turning on
         reduced motion mid-session, and spec §1 says that reader gets the finished
         drawing. So the inline values anime.js wrote come off, and so do the three
         attributes `createDrawable` puts on a path, which React knows nothing about and
         would otherwise leave every wire dashed down to nothing. */
      timeline.revert();
      for (const element of styled) {
        element.style.removeProperty("opacity");
        element.style.removeProperty("transform");
      }
      for (const path of drawn) {
        path.removeAttribute("stroke-dasharray");
        path.removeAttribute("stroke-dashoffset");
        path.removeAttribute("pathLength");
        path.style.removeProperty("stroke-linecap");
      }
    };
  }, [phase, ref]);

  const hide = phase === "static" ? undefined : ({ opacity: 0 } as const);

  return (
    <div ref={ref} className="min-w-0">
      <Sheet
        label="starter software factory"
        title="five nodes, one per phase"
        note={
          <Link href={BLUEPRINT_HREF} className="underline-offset-4 hover:underline">
            read the blueprint
          </Link>
        }
        bodyClassName="px-3 py-3 sm:px-4 sm:py-5"
        className="shadow-[0_0_60px_-24px_var(--color-blueprint-line)]"
      >
        <Drawing layout={HERO_NARROW} className="sm:hidden" hide={hide} />
        <Drawing layout={HERO_WIDE} className="hidden sm:block" hide={hide} />
      </Sheet>

      {/* The classification, written the way a type annotation is written: the thing on
          the left, what it is on the right.

          Doc 2 §1.1 is what decides how it looks. The token is the same border, the same
          surface and the same type size as the one `components/ui/AutonomyMeter` puts on
          every blueprint page and every gallery tile, down to the `◼`, because it is the
          same reading and a reader should meet it here in the chrome they will meet it in
          again. Nothing about it is a prize: no gold, no ribbon, no rank, no number, and
          the line under it states the fact that earned the word rather than congratulating
          the graph for it. A blueprint with a person in it gets a statement of equal
          weight in the same place, which is what stops this one reading as the score to
          beat. */}
      <div
        data-hero="chip"
        style={hide}
        className="mt-3 flex flex-col gap-1.5 sm:mt-5"
      >
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
          <span className="text-dim">classification:</span>
          <span className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-0.5 text-fg">
            <span aria-hidden>◼</span>
            dark factory
          </span>
        </p>
        <p className="text-sm leading-relaxed text-muted">
          No node in this graph waits for a person.
        </p>
      </div>
    </div>
  );
}
