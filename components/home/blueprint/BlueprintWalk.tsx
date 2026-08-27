"use client";

/* ============================================================
   Beat 2 of redesign spec §2: a graph glowing into existence.

   The line is "this is a blueprint", and the drawing is the whole
   of the argument, so the copy is one sentence and stops. Every
   paragraph the landing used to spend explaining the five roles,
   the loop and the prohibition went to `/spec/topology` with
   `SectionRoles`, and came off that page again when the trim pass
   cut the roles band. The argument now lives where it is checkable
   rather than where it was retold: `TOPOLOGY_ROWS` on
   `/spec/topology` and the `cannot` line on `/spec/card`. This beat
   never carried it and still does not — one sentence, then the
   drawing.

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
 * The disc is coloured by what the node IS, the way the gallery colours it.
 *
 * The author, 2026-08-07: "Improve the look of the blueprint in the home page; instead
 * follow the look adopted in the blueprint gallery."
 *
 * ── What this replaces, and why the old reason had already expired ──
 * `const NODE_TONE = "cyan"` stood here, one tone across all five discs, and the comment
 * defending it said: "Beat 3 takes one node out of it and lights it, and a resting graph
 * already painted five colours has nowhere left to go when one of them is supposed to come
 * on."
 *
 * That beat is gone. Beat 3 is `CardWalk` now — an annotated listing, DOM text, no `<svg>`
 * at all — and `scene-labels.test.ts` records the swap. Nothing anywhere on the site passes
 * `lit` to a `FlowNode` today, so the state the uniform palette was being held in reserve
 * for has no caller. The instruction and the expiry are independent, and the argument would
 * have been worth re-opening on its own.
 *
 * ── Four greens and a cyan is the truth, not a decision ──
 * `roles.ts` mirrors each node's `AgentNodeKind` and `roles.test.ts` holds all five to what
 * `allBlueprints()` resolves. Planner, Builder and Debugger are `executor`, Tester is
 * `verifier`, Deployer is `ship`. That is what the same graph looks like on `/blueprints`,
 * which is the whole point of the change: the landing and the registry stopped drawing one
 * blueprint in two colour languages one click apart.
 *
 * `kindTone` and not `NODE_KIND_META` directly, because `FlowNode` takes a tone rather than
 * a colour — `flow.ts` argues that at length, and `flow.test.ts` pins the two palettes to
 * each other so they cannot drift.
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
          walkTo={Math.min(4, Math.floor(Math.max(0, progress - 0.30) / 0.14))}
        />
      )}
    />
  );
}
