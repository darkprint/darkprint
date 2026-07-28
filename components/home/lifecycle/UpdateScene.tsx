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
   gone, which is the only way to draw an absence. It is faint
   rather than pink, because a prohibition doing its job is the
   design working and the alarm colour on this site means a defect
   was found (`components/viz/tokens.ts`).
   ============================================================ */

import { AbsentEdge, Edge, NodeBox, Scene, nodePort } from "@/components/viz";

import { useSceneReveal } from "./scene-reveal";

const CARD = { width: 152, height: 44 } as const;
const SOURCE = { width: 152, height: 40 } as const;

const BEFORE_X = 96;
const AFTER_X = 312;
const CARD_Y = 46;
const SOURCE_Y = 148;

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
  const { ref, armed } = useSceneReveal();

  return (
    <Scene
      ref={ref}
      width={420}
      height={196}
      id="lifecycle-update"
      label={`The card ${cardId} at ${from} beside the same card at ${to}, one prohibition longer. A dashed run from ${source} into the new version marks the edge it refuses.`}
    >
      <g style={{ opacity: armed ? 0 : 1 }}>
        <NodeBox id="before" x={BEFORE_X} y={CARD_Y} {...CARD} label={cardId} sub={`@${from}`} />
        <Edge
          from={nodePort(BEFORE_X, CARD_Y, "right", { ...CARD, pad: 4 })}
          to={nodePort(AFTER_X, CARD_Y, "left", { ...CARD, pad: 4 })}
          label={`+ ${added}`}
          id="edit"
        />
        {/* Cyan for the version that does not exist yet, matching the edited card in the
            fork drawing beside it: the same accent means the same thing twice, which is
            what a shared vocabulary is for. */}
        <NodeBox
          id="after"
          x={AFTER_X}
          y={CARD_Y}
          {...CARD}
          label={cardId}
          sub={`@${to}`}
          tone="cyan"
        />

        <NodeBox id="source" x={BEFORE_X} y={SOURCE_Y} {...SOURCE} label={source} sub={`emits ${added}`} />
        <AbsentEdge
          from={nodePort(BEFORE_X, SOURCE_Y, "right", { ...SOURCE, pad: 4 })}
          to={nodePort(AFTER_X, CARD_Y, "bottom", { ...CARD, pad: 4 })}
          bend={18}
          label="refused"
          id="refused"
        />
      </g>
    </Scene>
  );
}
