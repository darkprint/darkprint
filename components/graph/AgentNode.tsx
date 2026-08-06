"use client";

import Link from "next/link";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { AgentNodeData } from "@/lib/types";
import { NODE_KIND_META } from "@/lib/format";
import { nodeHref } from "@/lib/href";

/**
 * What the schematic carries on top of the domain data. `highlighted` is set by
 * `BlueprintGraph` when a finding in the explainability panel points at this node —
 * `data` is the only channel React Flow gives a custom node type.
 */
export type AgentNodeFlowData = AgentNodeData & { highlighted?: boolean };

export type AgentFlowNode = Node<AgentNodeFlowData, "agent">;

/**
 * The name of a node whose card is published, as a link to that card.
 *
 * **Why the name and nothing wider.** Spec part 3 leaves the interaction open and lists
 * three candidates. Turning the whole block into a link is the one that looks obvious and
 * is wrong: a React Flow node is draggable and the canvas is pannable, so every drag that
 * started on a node would end in a navigation, and two of this component's three mounts
 * sit inside a container that already claims a plain click. `components/panes/GraphPane`
 * reads a click on a node as doc 2 §5.1's synchronised selection, and
 * `components/build/ChoiceGraphPane` reads one as doc 2 §5.7's "le scelte si fanno dentro
 * la vista del grafo, cliccando sul nodo interessato". A whole-block link would have taken
 * a reader off `/build` at the exact moment they were making a choice in its graph.
 * A modifier click was the other candidate and it fails a different way: nothing on screen
 * would say it exists, and a keyboard reader has no modifier to hold.
 *
 * So the affordance is the smallest thing that can carry it and still be seen. The name is
 * a real anchor: it has a focus ring, it has a hover state, it announces itself, it opens
 * in a new tab on a middle click like any other link, and it is reachable by Tab. The
 * glyph after it is drawn at rest rather than on hover, because an affordance that appears
 * only under a pointer is one a keyboard reader never learns about.
 *
 * `nodrag` and `nopan` are React Flow's own opt-outs: without them a press on the name
 * starts a node drag and the click never lands. The click is stopped from bubbling because
 * a container that also reads clicks would otherwise run its own handler on the way out of
 * the page, selecting a node in a view that is being navigated away from.
 *
 * That is why the two panes above must never be handed a seed carrying a `cardId`, and why
 * neither of them relies on the caller for it: `stopPropagation` cancels their handler
 * while the anchor still navigates, so a link inside one of them replaces the selection
 * with a page load. Each strips the ids itself, through `withoutCardLinks`.
 */
function NodeTitleLink({ cardId, label }: { cardId: string; label: string }) {
  return (
    <Link
      href={nodeHref(cardId)}
      aria-label={`Open the node card ${label}, ${cardId}`}
      onClick={(event) => event.stopPropagation()}
      className="nodrag nopan inline-flex items-baseline gap-1 rounded-sm text-sm font-medium text-fg underline decoration-line-bright decoration-dotted underline-offset-4 transition-colors hover:text-cyan hover:decoration-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
    >
      {label}
      <span aria-hidden className="font-mono text-[11px] text-dim">
        ↗
      </span>
    </Link>
  );
}

/** Custom React Flow node styled as a blueprint schematic block. */
export function AgentNode({ data }: NodeProps<AgentFlowNode>) {
  const meta = NODE_KIND_META[data.kind];
  // Never colour alone: a highlighted node also gains a ring and says so in words.
  const lit = data.highlighted === true;
  const cardId = typeof data.cardId === "string" ? data.cardId : undefined;
  return (
    <div
      /* `w-[150px]` is `BLOCK_WIDTH` (`./block.ts`), written as a literal because Tailwind
         reads classes and not values. One width and not a `min`/`max` range: a block that
         could grow to 220 reached 20 flow units into the next column, which `layerGap`
         puts 200 away, and on `/build` — whose names are generated and long — every block
         sat at that ceiling. See `./block.ts` for the measurement and for what a stated
         width buys the guard. */
      className="group relative w-[150px] rounded-md border bg-surface-2/95 px-3 py-2 backdrop-blur-sm"
      style={{
        borderColor: lit ? "var(--color-amber)" : "var(--color-line-bright)",
        boxShadow: lit
          ? "0 0 0 2px var(--color-amber), 0 0 30px -6px var(--color-amber)"
          : `0 0 0 1px color-mix(in oklab, ${meta.color} 18%, transparent), 0 8px 24px -12px ${meta.color}`,
      }}
    >
      <span
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
        style={{ background: meta.color }}
      />
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: meta.color }}
        >
          {meta.glyph} {meta.label}
        </span>
      </div>
      <div className="mt-0.5">
        {cardId === undefined ? (
          <span className="text-sm font-medium text-fg">{data.label}</span>
        ) : (
          <NodeTitleLink cardId={cardId} label={data.label} />
        )}
      </div>
      {data.sub && (
        <div className="mt-0.5 font-mono text-[11px] text-dim">{data.sub}</div>
      )}
      {/* Its own row, and the reason is geometry rather than taste.
          ------------------------------------------------------------
          This badge is the *words* half of "never colour alone" — the one thing on a lit
          node that says in language what the amber ring says in hue — so it stays, and at
          the site's 11px mono floor rather than the 9px it used to be.

          But at 11px with 0.18em tracking it is ~105px wide, and sitting `ml-auto` on the
          header row beside the kind label it made the node demand that width *in addition*
          to the label's. The node had no max width, so it grew to 275px against its
          siblings' 168px and overlapped its neighbour by 51x35px on
          `/blueprints/starter-software-factory` — measured, not guessed.

          Below the title it competes with nothing horizontal, so the node keeps its
          sibling's width and the words keep their size. The container's single
          `BLOCK_WIDTH` holds the same line against a long node title, and holds it harder
          than the `max-w-[220px]` it replaced: 105px of badge fits inside 150 with room,
          and there is no longer a width for a long name to grow into. */}
      {lit && (
        <div className="mt-1.5">
          <span className="inline-block whitespace-nowrap rounded-full border border-amber/60 bg-amber/10 px-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-amber">
            ◎ highlighted
          </span>
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-1.5 !w-1.5 !border-0 !bg-line-bright"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !border-0"
        style={{ background: meta.color }}
      />
    </div>
  );
}
