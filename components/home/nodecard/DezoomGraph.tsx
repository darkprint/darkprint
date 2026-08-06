/* ============================================================
   Where the card lands.

   Spec §3.2's last beat: "the annotated card shrinks and lands
   inside one node of a full graph, which is classed a dark factory.
   The point being made is scale — every node in that graph is a
   card like this one."

   The graph is `starter-software-factory`, drawn from its own DOT
   (`content/blueprints/starter-software-factory/blueprint.dot`),
   and the node the card lands in is `builder`, which is the node
   that pins `code-builder@1.0.0`. That makes the dezoom a true
   statement rather than a transition: the reader has just read the
   card for the disc the card flies into.

   The absent edge is the reason this is the right graph to end on.
   The last annotation has just told the reader that `cannot:
   [acceptance-criteria]` is enforced, and here is the run it
   forbids, drawn as the dashed non-edge `FlowAbsence` exists for.

   ── Two things changed here, both from the redesign review ──
   1. The register. This drew five CAD boxes with sub-labels, which
      is the style the author rejected by name (redesign spec §1),
      and it did so on a page that already carried six luminous
      nodes further up, so `/spec/card` was showing both vocabularies
      at once. Every box is now a disc from `components/viz`'s
      luminous set, and the card id that used to be a sub-label is
      in each disc's accessible name, where `./graph.ts` already
      puts it.
   2. The placement. One 880-unit frame rendered at 354 CSS px on a
      phone, which drew `FLOW.label.size` at four pixels — below
      `md` the label gate shows every label unconditionally, so that
      was the branch that most needed to be legible. It now renders
      the same two placements the landing does.
   ============================================================ */

import Link from "next/link";

import { FlowAbsence, FlowEdge, FlowNode, FlowScene, VIZ, toneColor } from "@/components/viz";
import { cx } from "@/lib/format";

import {
  LANDING_GRAPH_DESCRIPTION,
  LANDING_NARROW,
  LANDING_WIDE,
  LIT_NODE,
  type LandingGraph,
} from "../graph";

/**
 * The builder's centre as a fraction of the wide drawing, for the shrink's
 * `transform-origin`.
 *
 * The wide placement and not the narrow one, because the dezoom itself is an `lg:` effect
 * (`NodeCardStage` gates every part of it on that breakpoint) and `lg` is where the wide
 * frame is the one on screen.
 */
export const LANDING_ORIGIN = originOf(LANDING_WIDE);

function originOf(graph: LandingGraph): string {
  const node = graph.nodes.find((candidate) => candidate.id === LIT_NODE.id);
  if (node === undefined) throw new Error(`the dezoom graph has no \`${LIT_NODE.id}\``);
  return `${((node.x / graph.width) * 100).toFixed(1)}% ${((node.y / graph.height) * 100).toFixed(1)}%`;
}

/** Gap between the lit disc's own label and the leader that points at it. */
const LEADER_DROP = 16;

function Drawing({ graph, className }: { graph: LandingGraph; className: string }) {
  const builder = graph.nodes.find((node) => node.id === LIT_NODE.id);
  if (builder === undefined) throw new Error(`the dezoom graph has no \`${LIT_NODE.id}\``);

  /* Below the disc's own label, so the leader starts under the word rather than through
     it. `labelOffset` is the vocabulary's arithmetic and the drop below is this drawing's. */
  const from = builder.y + graph.nodeRadius * 1.7 + 15 + LEADER_DROP;

  return (
    <FlowScene
      width={graph.width}
      height={graph.height}
      id="node-card-dezoom"
      label="The starter software factory, with the disc this card runs on lit"
      description={LANDING_GRAPH_DESCRIPTION}
      className={className}
    >
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

      <FlowAbsence
        from={graph.absence.from}
        to={graph.absence.to}
        fromRadius={graph.nodeRadius}
        toRadius={graph.nodeRadius}
        label={graph.absence.label}
        id="planner-builder"
      />

      {graph.nodes.map((node) => (
        <FlowNode
          key={node.id}
          id={node.id}
          x={node.x}
          y={node.y}
          r={graph.nodeRadius}
          /* The one disc the card belongs to, brighter than the other four. The card id it
             pins rides in `name`, which is where `./graph.ts` puts it for every node. */
          lit={node.id === LIT_NODE.id}
          tone="cyan"
          label={node.label}
          name={node.name}
        />
      ))}

      {/* A leader from the lit disc down to its caption, in the register the rest of the
          site's drawings use for a note about a part. Dashed, so it reads as an annotation
          and never as a run of work. */}
      <path
        d={`M ${builder.x} ${from} L ${builder.x} ${from + 14}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
        strokeDasharray={VIZ.dash.leader}
      />
      <text
        x={builder.x}
        y={from + 28}
        textAnchor="middle"
        fontSize={VIZ.font.sub}
        fill={toneColor("cyan")}
      >
        the card above
      </text>
    </FlowScene>
  );
}

export function DezoomGraph({
  cardHref,
  darkFactory,
  className,
}: {
  /** `/nodes/code-builder`. The caption under the drawing links to the card. */
  cardHref: string;
  /**
   * Whether the engine classes this bundle as a dark factory, read off the analysis
   * rather than asserted here. Doc 2 §1.1 makes the classification a description of a
   * shape, and a description typed into a page is one the archive can drift away from
   * without anybody noticing.
   */
  darkFactory: boolean;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <Drawing graph={LANDING_NARROW} className="sm:hidden" />
      <Drawing graph={LANDING_WIDE} className="hidden sm:block" />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] tracking-[0.06em] text-dim">
            starter-software-factory
          </span>
          {darkFactory && (
            /* Written as a type annotation, which is what it is: a reading of the graph's
               shape. Doc 2 §1.1 keeps it off the trophy shelf, so it takes the sheet's
               own line colour rather than a colour reserved for anything. */
            <span className="inline-flex items-center gap-1.5 rounded border border-cyan/40 bg-void/70 px-2 py-0.5 font-mono text-[11px] text-cyan">
              <span className="text-dim">classification:</span> dark factory
            </span>
          )}
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Five discs, and behind each one a card like the one above. Nobody stands in this
          graph, which is what the classification records. The dashed run is the edge the
          last annotation described: draw it and the bundle stops resolving.{" "}
          <Link
            href={cardHref}
            className="text-cyan underline decoration-line-bright underline-offset-4"
          >
            Read the whole card
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
