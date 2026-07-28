"use client";

/* ============================================================
   Drawing 3 of 3 — one line added, and what it costs.

   Every string in this drawing arrives as a prop, computed by
   `tightenProhibition` in `bump-demo.ts` off the published card and
   the engine's own `inferBump`. Nothing here is written down twice:
   if the version arithmetic or the bump rule moves, the drawing
   moves with it rather than going quietly stale.

   The dashed run at the bottom is the point of the whole panel. It
   is the edge the new version refuses, drawn where it would have
   gone, which is the only way to draw an absence. It is neutral
   rather than pink, because a prohibition doing its job is the
   design working and the alarm colour on this site means a defect
   was found (`components/viz/tokens.ts`).

   Converted out of the CAD register on the author's instruction
   (redesign spec §1); `DownloadScene` beside it carries the note.
   ============================================================ */

import { FLOW, FlowAbsence, FlowEdge, FlowNode, FlowScene } from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/** 340 for the reason `DownloadScene` records: these panels render 270 CSS px wide. */
const FIGURE = { width: 340, height: 202 } as const;

const BEFORE_X = 88;
const AFTER_X = 252;
const CARD_Y = 50;
const SOURCE_Y = 150;

const R = 8;

export function UpdateScene({
  cardId,
  from,
  to,
  added,
  source,
}: {
  /** The card being edited, e.g. "code-builder". */
  cardId: string;
  /** Published version, e.g. "1.0.0". */
  from: string;
  /** The version the engine's verdict forces, e.g. "2.0.0". */
  to: string;
  /** The entry added to `cannot`, e.g. "report". */
  added: string;
  /** The node id whose output the new prohibition refuses. */
  source: string;
}) {
  const flow = useLuminousFlow({ amount: 0.3 });

  return (
    <FlowScene
      {...flow.scene}
      width={FIGURE.width}
      height={FIGURE.height}
      id="lifecycle-update"
      label={`The card ${cardId} at ${from} beside the same card at ${to}`}
      description={`The card ${cardId} at ${from}, and the same card at ${to} with one prohibition longer. A run from ${source}, which emits ${added}, into the new version is drawn where it would have gone and is refused.`}
    >
      <FlowEdge
        from={[BEFORE_X, CARD_Y]}
        to={[AFTER_X, CARD_Y]}
        fromRadius={R}
        toRadius={R}
        label={`+ ${added}`}
        id="edit"
      />
      <FlowNode
        id="before"
        x={BEFORE_X}
        y={CARD_Y}
        r={R}
        tone="cyan"
        label={`${cardId}@${from}`}
        reveal="always"
      />
      {/* Lit for the version that does not exist yet, matching the edited card in the fork
          drawing beside it: the same treatment means the same thing twice, which is what a
          shared vocabulary is for. */}
      <FlowNode
        id="after"
        x={AFTER_X}
        y={CARD_Y}
        r={R}
        lit
        tone="cyan"
        label={`${cardId}@${to}`}
        reveal="always"
      />

      <FlowNode
        id="source"
        x={BEFORE_X}
        y={SOURCE_Y}
        r={R}
        tone="line"
        label={source}
        name={`${source}, which emits ${added}`}
      />
      <FlowAbsence
        from={[BEFORE_X, SOURCE_Y]}
        to={[AFTER_X, CARD_Y]}
        bend={FLOW.edge.bend.wide}
        fromRadius={R}
        toRadius={R}
        label="refused"
        name={`${added} from ${source}, an edge the new version refuses`}
        id="refused"
      />
    </FlowScene>
  );
}
