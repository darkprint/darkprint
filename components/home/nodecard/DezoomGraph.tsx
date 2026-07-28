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
   card for the box the card flies into.

   Each box is labelled with its DOT node id and its card id, which
   is the scale claim made in text as well as in motion. Nothing on
   this drawing is invented; the five ids, the four edges and the
   one absent edge are all in that file.

   The absent edge is the reason this is the right graph to end on.
   Annotation 7 has just told the reader that `cannot:
   [acceptance-criteria]` is enforced, and here is the run it
   forbids, drawn as the dashed non-edge `AbsentEdge` exists for.
   ============================================================ */

import Link from "next/link";

import {
  AbsentEdge,
  Edge,
  NodeBox,
  Scene,
  VIZ,
  edgePath,
  nodePort,
  toneColor,
} from "@/components/viz";
import { cx } from "@/lib/format";

const W = 880;
const H = 380;
const PAD = { pad: 6 };

/** Centres, in scene units. The layout is the DOT's `rankdir=LR` read left to right. */
const AT = {
  planner: [120, 96],
  builder: [300, 300],
  tester: [566, 200],
  debugger: [566, 330],
  deployer: [790, 200],
} as const;

/** The builder's centre as a fraction of the drawing, for the shrink's `transform-origin`. */
export const LANDING_ORIGIN = `${((AT.builder[0] / W) * 100).toFixed(1)}% ${(
  (AT.builder[1] / H) *
  100
).toFixed(1)}%`;

export function DezoomGraph({
  cardHref,
  darkFactory,
  className,
}: {
  /** `/nodes/code-builder`. The box the card landed in is a link to the card. */
  cardHref: string;
  /**
   * Whether the engine classes this bundle as a dark factory, read off the analysis
   * rather than asserted here. Doc 2 §1.1 makes the classification a description of a
   * shape, and a description typed into a landing page is one the archive can drift away
   * from without anybody noticing.
   */
  darkFactory: boolean;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <Scene
        width={W}
        height={H}
        id="node-card-dezoom"
        label="The starter software factory: five boxes labelled with their node id and the card each one pins. The planner feeds the tester, the builder feeds the tester, the tester and the debugger loop, and the tester hands an approved build to the deployer. A dashed run from the planner to the builder marks the edge the builder's card forbids."
      >
        {/* The loop, drawn first so the boxes knock it out where they meet. */}
        <Edge
          from={nodePort(...AT.tester, "bottom", PAD)}
          to={nodePort(...AT.debugger, "top", PAD)}
          bend={30}
          label="failure evidence"
          id="tester-debugger"
        />
        <Edge
          from={nodePort(...AT.debugger, "top", PAD)}
          to={nodePort(...AT.tester, "bottom", PAD)}
          bend={30}
          id="debugger-tester"
        />
        <Edge
          from={nodePort(...AT.planner, "right", PAD)}
          to={nodePort(...AT.tester, "top", PAD)}
          bend={-24}
          label="acceptance criteria"
          id="planner-tester"
        />
        <Edge
          from={nodePort(...AT.builder, "right", PAD)}
          to={nodePort(...AT.tester, "left", PAD)}
          label="build"
          tone="cyan"
          id="builder-tester"
        />
        <Edge
          from={nodePort(...AT.tester, "right", PAD)}
          to={nodePort(...AT.deployer, "left", PAD)}
          label="approved build"
          id="tester-deployer"
        />

        <AbsentEdge
          from={nodePort(...AT.planner, "bottom", PAD)}
          to={nodePort(...AT.builder, "top", PAD)}
          label="acceptance-criteria"
          id="planner-builder"
        />

        <NodeBox {...box("planner")} label="planner" sub="spec-planner" />
        <NodeBox {...box("tester")} label="tester" sub="acceptance-tester" />
        <NodeBox {...box("debugger")} label="debugger" sub="targeted-debugger" />
        <NodeBox {...box("deployer")} label="deployer" sub="release-gate" />
        {/* Last, and in the sheet's accent, because it is the box the card lands in. */}
        <NodeBox {...box("builder")} label="builder" sub="code-builder" tone="cyan" />

        {/* A dimension leader from the landing box down to its caption, in the register
            the rest of the site's drawings use for a note about a part. */}
        <path
          /* Starts below the box's own sub-label rather than at its port, which is what
             `nodePort` would give: the card id is printed there and a rule through it is
             a rule through the one word this drawing exists to point at. */
          d={edgePath([AT.builder[0], 340] as const, [AT.builder[0], 356] as const)}
          stroke={toneColor("dim")}
          strokeWidth={VIZ.stroke.hair}
          strokeDasharray={VIZ.dash.leader}
          fill="none"
        />
        <text
          x={AT.builder[0]}
          y={368}
          textAnchor="middle"
          fontSize={VIZ.font.sub}
          fill={toneColor("cyan")}
        >
          the card above
        </text>
      </Scene>

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
          Five boxes, and behind each one a card like the one above. Nobody stands in this
          graph, which is what the classification records. The dashed run is the edge
          annotation 7 described: draw it and the bundle stops resolving.{" "}
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

/** Centre coordinates as `NodeBox` props, so the table above stays a table. */
function box(id: keyof typeof AT): { x: number; y: number; id: string } {
  const [x, y] = AT[id];
  return { x, y, id };
}
