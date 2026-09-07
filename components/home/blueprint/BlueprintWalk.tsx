"use client";

/* ============================================================
   The landing's graph beat: a drawing that becomes the file it was
   drawn from.

   The copy is one sentence and the drawing is the argument. The
   claims about the loop and the absent edge live where they are
   checkable, in `TOPOLOGY_ROWS` on `/spec/topology` and the `cannot`
   line on `/spec/card`, so this beat does not retell them.

   What is drawn is the starter blueprint the site ships, node for
   node and edge for edge, placed by `./graph.ts` out of the facts in
   `./roles.ts`: the first graph a visitor meets should be one they
   can download.

   The edges carry no words because a label makes a glyph focusable,
   and labelling five runs as well as five discs would put eleven tab
   stops in the first figure on the site. What each run carries is in
   the scene's `<desc>`, which is what a screen reader is given
   instead of walking the drawing.
   ============================================================ */


import { FlowAbsence, FlowEdge, FlowNode, FlowScene, Sheet } from "@/components/viz";
import { kindTone, type FlowTone } from "@/components/viz/flow";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";
import { DotBreakdown } from "@/components/panes/DotBreakdown";
import { SourceSwap } from "../SourceSwap";

import {
  LANDING_GRAPH_DESCRIPTION,
  LANDING_GRAPH_LABEL,
  LANDING_NARROW,
  LANDING_WIDE,
  type LandingGraph,
} from "../graph";


/**
 * The disc is coloured by what the node is, the way the registry's tiles colour it, so the
 * landing and the registry do not draw one blueprint in two colour languages one click
 * apart. `roles.test.ts` holds all five kinds to what `allBlueprints()` resolves, and
 * `kindTone` rather than the palette directly because `FlowNode` takes a tone; `flow.test.ts`
 * pins the two palettes to each other.
 */
function nodeTone(kind: string): FlowTone {
  /* `line`, the sheet's own drawing colour, for a kind this register reserves a colour for
     (a router, a human gate). None of the starter's five is one, so the fallback is
     unreachable today; it exists because `LandingNode.kind` is a `string` and a graph
     swapped in here later should draw a neutral disc rather than throw. */
  return kindTone(kind) ?? "line";
}

function Drawing({ graph, className }: { graph: LandingGraph; className: string }) {
  /* One hook per placement, and both are in the DOM at once with one of them
     `display:none`. An element with no box never intersects, so the hidden placement sits
     in `armed` and costs nothing; when a reader rotates a tablet the observer fires on the
     one that just gained a box and it plays then. */
  const flow = useLuminousFlow({ amount: 0.15 });

  return (
    <FlowScene
      {...flow.scene}
      /* Names on, always.
         ------------------------------------------------------------
         `useLuminousFlow` returns `labels: "hover"` the moment a scene animates, and on
         this one that left five identical glowing discs with nothing written on them. The
         beat's caption says "five nodes, five edges" and the drawing showed five dots: a
         reader could not tell a planner from a release gate, and a reader without a mouse
         never could at all. `beats.test.ts` states the rule this broke, in the site's own
         words: "a figure whose meaning is only available to a mouse user is a broken
         figure."

         Safe to turn on rather than a judgement call: `scene-labels.test.ts` measures
         every label box in both of this section's frames, so a name that would collide or
         leave the sheet fails the suite. After the spread, so it wins over the hook. */
      labels="always"
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

      {/* The central lesson is an edge that is not there. Its label stays on without a
          pointer, because a reader who never hovers anything still has to be able to read
          the one thing the site is built on. */}
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
          tone={nodeTone(node.kind)}
          /* The gallery's mark: one halo shell instead of three. Five lamps at 4.4× on one
             sheet is more glow than drawing, and this beat is about the topology. */
          mark="schematic"
        />
      ))}
    </FlowScene>
  );
}

/* `components/hero/Wordmark.tsx` links `#blueprint`. This section's own top padding
   happens to be deeper than the sticky header, so nothing was hidden; the `scroll-mt-24`
   is there so the rule in `components/site/anchors.test.ts` holds over every anchor
   without an exemption list nobody would revisit. */
/**
 * The drawing, and the file it is a picture of.
 *
 * `SectionBlueprint` is the server half: it reads `topology.dot` off the archive and hands
 * it down. This half is a client component because the drawing animates, and because the
 * swap below it is driven by scroll.
 *
 * Two sheets, not one with its contents replaced. Each is a complete object with its own
 * title block — the drawing's says what the graph holds, the file's says what the file is —
 * and `SourceSwap` crossfades between them. A single sheet whose insides changed would
 * make the frame the constant and the content the variable, which is backwards: the point
 * is that these are two renderings of one artefact, not one container showing two things.
 */
export function BlueprintWalk({
  dot,
  file,
  heading,
}: {
  dot: string;
  file: string;
  /** The section's heading, drawn inside the pin. See `SourceSwap`'s own `heading`. */
  heading?: React.ReactNode;
}) {
  return (
    <SourceSwap
      {...(heading === undefined ? {} : { heading })}
      /* `max-w-5xl`, not the `4xl` the sheet alone wanted: the source layer is
         `DotBreakdown`, which lays a listing beside a column of notes, and at 4xl the notes
         wrapped to three words a line. The drawing is centred in the same width. */
      className="mx-auto mt-10 max-w-5xl"
      figure={
        <Sheet
          label="starter software factory"
          title="five nodes, five edges"
          /* `note="one run deliberately missing"` stood here and the author asked it out.
             The absent edge is still drawn — dashed, labelled `acceptance-criteria`, with
             its own absence glyph — and the walk's third and fourth notes name it in the
             listing this drawing turns into. A caption in the sheet's corner saying the
             same thing was the third telling. */
        >
          <Drawing graph={LANDING_NARROW} className="sm:hidden" />
          <Drawing graph={LANDING_WIDE} className="hidden sm:block" />
        </Sheet>
      }
      hint="Scroll down. The drawing becomes the file it was drawn from."
      source={(progress) => (
        /* The panel `/spec/topology` uses, driven rather than clicked. `walkTo` walks the
           five blocks off the swap's own clock, so the listing lights one block and shows
           that block's note alone.

           The window is the tail of the pin: the file has finished arriving by 0.28 and the
           walk spends everything after it, 0.14 of the track per block. At 1440 × 950 that
           is 266px of scroll each — comfortably past the pace `CardWalk` settled on for its
           nine, and slow enough to read a note before the next one replaces it.

           `Math.min` and not a modulo: the last block holds while a reader scrolls the last
           of the pin rather than wrapping back to the first, which would read as a loop. */
        <DotBreakdown
          source={dot}
          title={file}
          drawnAbove
          walkTo={Math.min(4, Math.floor(Math.max(0, progress - 0.30) / 0.14))}
        />
      )}
    />
  );
}
