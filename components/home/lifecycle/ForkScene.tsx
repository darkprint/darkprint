"use client";

/* ============================================================
   The same folder, copied and changed.

   Two rows of the same three nodes, so the only thing the eye has
   to do is spot the difference: one card edited, and the last node
   replaced by a place where a person acts.

   The person is drawn with `HumanFlowNode`, which is violet by
   construction and accepts no colour argument at all (doc 2 §1.1,
   and `components/viz/FlowGlyphs.tsx` enforces it in the type). The
   caption says what they do there and nothing about what it costs:
   the copy on the second row is a complete factory, and so is the
   one on the first.

   Converted out of the CAD register on the author's instruction
   (redesign spec §1). It once had two siblings drawn the same way,
   `DownloadScene` and `ComposeScene` on the landing's lifecycle
   panels — both are gone now, replaced by a plain static glyph, on
   a later verdict that the luminous-flow register itself reads as
   "a blueprint" whatever is drawn inside it (see
   `SectionLifecycle`'s header). This one stayed: its one caller,
   `components/blueprint/ForkAction.tsx`, is a disclosure on a
   blueprint's own detail page, drawing the graph the fork applies
   to is exactly on topic there, and nobody has said otherwise about
   it.
   ============================================================ */

import { FlowEdge, FlowNode, FlowScene, HumanFlowNode, toneColor } from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";
import { VIZ } from "@/components/viz";

/** 340×202: this size rendered legibly inside a landing panel and renders just as
    legibly inside `ForkAction`'s popover, so the frame never had a reason to change when
    the drawing moved from one to the other. */
const FIGURE = { width: 340, height: 202 } as const;

/** Column centres, shared by both rows so the two graphs sit exactly on top of each other. */
const COLUMNS = [62, 158, 254] as const;
const PUBLISHED_Y = 52;
const COPY_Y = 146;

const R = 7;

/** A caption naming which row is which. Two words, in the register the sheet uses. */
function Caption({ y, children }: { y: number; children: string }) {
  return (
    <text
      x={8}
      y={y}
      fontSize={VIZ.font.sub}
      fill={toneColor("dim")}
      letterSpacing="0.08em"
    >
      {children}
    </text>
  );
}

export function ForkScene() {
  const flow = useLuminousFlow({ amount: 0.3 });

  return (
    <FlowScene
      {...flow.scene}
      width={FIGURE.width}
      height={FIGURE.height}
      id="lifecycle-fork"
      label="The same three-node run drawn twice, once as published and once edited"
      description="The published copy runs builder, tester, deployer. The reader's copy has an edited builder card, and where the deployer was there is now a person who approves the release. Both are complete blueprints."
    >
      <Caption y={18}>as published</Caption>
      <FlowEdge
        from={[COLUMNS[0], PUBLISHED_Y]}
        to={[COLUMNS[1], PUBLISHED_Y]}
        fromRadius={R}
        toRadius={R}
        id="published-1"
      />
      <FlowEdge
        from={[COLUMNS[1], PUBLISHED_Y]}
        to={[COLUMNS[2], PUBLISHED_Y]}
        fromRadius={R}
        toRadius={R}
        id="published-2"
      />
      <FlowNode id="builder" x={COLUMNS[0]} y={PUBLISHED_Y} r={R} tone="cyan" label="builder" />
      <FlowNode id="tester" x={COLUMNS[1]} y={PUBLISHED_Y} r={R} tone="cyan" label="tester" />
      <FlowNode id="deployer" x={COLUMNS[2]} y={PUBLISHED_Y} r={R} tone="cyan" label="deployer" />

      <Caption y={112}>your copy</Caption>
      <FlowEdge
        from={[COLUMNS[0], COPY_Y]}
        to={[COLUMNS[1], COPY_Y]}
        fromRadius={R}
        toRadius={R}
        id="copy-1"
      />
      <FlowEdge
        from={[COLUMNS[1], COPY_Y]}
        to={[COLUMNS[2], COPY_Y]}
        fromRadius={R}
        toRadius={9}
        id="copy-2"
      />
      {/* Lit rather than recoloured. The register has one accent for the whole drawing and
          brightness is what it has left to say "this is the one that changed". */}
      <FlowNode
        id="copy-builder"
        x={COLUMNS[0]}
        y={COPY_Y}
        r={R}
        lit
        tone="cyan"
        label="builder"
        name="builder, with its card edited"
      />
      <FlowNode id="copy-tester" x={COLUMNS[1]} y={COPY_Y} r={R} tone="cyan" label="tester" />
      <HumanFlowNode x={COLUMNS[2]} y={COPY_Y} r={9} label="a person approves" id="approver" />
    </FlowScene>
  );
}
