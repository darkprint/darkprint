"use client";

/* ============================================================
   Beat 2 of redesign spec §2: a graph glowing into existence.

   The line is "this is a blueprint", and the drawing is the whole
   of the argument, so the copy is one sentence and stops. Every
   paragraph the landing used to spend explaining the five roles,
   the loop and the prohibition has moved to `/spec/topology`, where
   `SectionRoles` says all of it to a reader who came for it.

   ── What is drawn ──
   The starter software factory the site ships, node for node and
   edge for edge, placed by `./graph.ts` out of the facts in
   `./roles.ts`. Doc 2 §2.1 rung 4 asks for "un esempio concreto,
   singolo, visibile", and the first graph a visitor meets should be
   one they can download.

   ── Why the edges carry no words ──
   Redesign spec §1: "suggestive and atmospheric, almost no text".
   A label makes a glyph focusable, so labelling the five runs as
   well as the five discs would put eleven tab stops in the first
   figure on the site. The five roles are named, the absence is
   named because it is the site's central argument, and what each
   run carries is in the scene's `<desc>`, which is what a screen
   reader is given instead of walking the drawing. A reader who
   wants the labels drawn opens the blueprint, which is linked
   under the sheet.
   ============================================================ */

import Link from "next/link";

import { FlowAbsence, FlowEdge, FlowNode, FlowScene, Sheet } from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";
import { SectionHeading } from "@/components/ui/SectionHeading";

import {
  LANDING_GRAPH_DESCRIPTION,
  LANDING_GRAPH_LABEL,
  LANDING_NARROW,
  LANDING_WIDE,
  type LandingGraph,
} from "./graph";

const BLUEPRINT_HREF = "/blueprints/starter-software-factory";

/**
 * One tone across all five discs.
 *
 * The graph is uniform here on purpose. Beat 3 takes one node out of it and lights it, and
 * a resting graph already painted five colours has nowhere left to go when one of them is
 * supposed to come on.
 */
const NODE_TONE = "cyan" as const;

function Drawing({ graph, className }: { graph: LandingGraph; className: string }) {
  /* One hook per placement, and both are in the DOM at once with one of them
     `display:none`. An element with no box never intersects, so the hidden placement sits
     in `armed` and costs nothing; when a reader rotates a tablet the observer fires on the
     one that just gained a box and it plays then. */
  const flow = useLuminousFlow({ amount: 0.15 });

  return (
    <FlowScene
      {...flow.scene}
      width={graph.width}
      height={graph.height}
      label={LANDING_GRAPH_LABEL}
      description={LANDING_GRAPH_DESCRIPTION}
      className={className}
      id="landing-graph"
    >
      {/* Curves first: a disc is drawn over the ends of its own runs. Both radii are the
          placement's, so a curve stops at the rim of the disc actually drawn rather than
          at the rim of the vocabulary's default one. */}
      {graph.wires.map((wire) => (
        <FlowEdge
          key={wire.id}
          id={wire.id}
          from={wire.from}
          to={wire.to}
          bend={wire.bend}
          fromRadius={graph.nodeRadius}
          toRadius={graph.nodeRadius}
        />
      ))}

      {/* Doc 2 §5.2: "la lezione centrale non sta in un nodo, sta in un arco che non c'è."
          Its label stays on without a pointer, because a reader who never hovers anything
          still has to be able to read the one thing the site is built on. */}
      <FlowAbsence
        from={graph.absence.from}
        to={graph.absence.to}
        fromRadius={graph.nodeRadius}
        toRadius={graph.nodeRadius}
        label={graph.absence.label}
        id="absent"
      />

      {graph.nodes.map((node) => (
        <FlowNode
          key={node.id}
          id={node.id}
          x={node.x}
          y={node.y}
          r={graph.nodeRadius}
          label={node.label}
          name={node.name}
          tone={NODE_TONE}
        />
      ))}
    </FlowScene>
  );
}

/* `components/hero/Wordmark.tsx` links `#blueprint`. This section's own top padding
   happens to be deeper than the sticky header, so nothing was hidden; the `scroll-mt-24`
   is there so the rule in `components/site/anchors.test.ts` holds over every anchor
   without an exemption list nobody would revisit. */
export function SectionBlueprint() {
  return (
    <section id="blueprint" className="scroll-mt-24 bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The drawing"
          title="This is a blueprint"
          lead="Which agents run, what each one hands to the next, and it is already yours to run."
          align="center"
          className="mx-auto"
        />

        <Sheet
          className="mx-auto mt-10 max-w-4xl"
          label="starter software factory"
          title="five nodes, five edges"
          note="one run deliberately missing"
        >
          <Drawing graph={LANDING_NARROW} className="sm:hidden" />
          <Drawing graph={LANDING_WIDE} className="hidden sm:block" />
        </Sheet>

        <p className="mt-5 text-center text-sm">
          <Link
            href={BLUEPRINT_HREF}
            className="text-muted underline decoration-line-bright underline-offset-4 transition-colors hover:text-fg"
          >
            Open this blueprint
          </Link>
        </p>
      </div>
    </section>
  );
}
