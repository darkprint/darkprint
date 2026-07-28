"use client";

/* ============================================================
   Drawing 2 of 3 — the same folder, copied and changed.

   Two rows of the same three nodes, so the only thing the eye has
   to do is spot the difference: one card edited, and the last node
   replaced by a place where a person acts.

   The person is drawn with `HumanMark`, which is violet by
   construction and cannot be handed the alarm colour (doc 2 §1.1,
   and `components/viz/Glyphs.tsx` enforces it in the type). The
   caption says what they do there and nothing about what it costs:
   the copy on the right is a complete factory, and so is the one on
   the left.
   ============================================================ */

import { Edge, HumanMark, NodeBox, Scene, VIZ, VIZ_LINE, nodePort } from "@/components/viz";

import { useSceneReveal } from "./scene-reveal";

const BOX = { width: 96, height: 34 } as const;

/** Column centres, shared by both rows so the two graphs sit exactly on top of each other. */
const COLUMNS = [66, 220, 374] as const;
const PUBLISHED_Y = 56;
const COPY_Y = 152;

/** The run between two neighbouring columns, at either row. */
function run(from: number, to: number, y: number) {
  return {
    from: nodePort(from, y, "right", { ...BOX, pad: 4 }),
    to: nodePort(to, y, "left", { ...BOX, pad: 4 }),
  };
}

function Caption({ y, children }: { y: number; children: string }) {
  return (
    <text
      data-scene-part
      x={6}
      y={y}
      fontSize={VIZ.font.sub}
      fill={VIZ_LINE}
      letterSpacing="0.08em"
    >
      {children}
    </text>
  );
}

export function ForkScene() {
  const { ref, armed } = useSceneReveal();

  return (
    <Scene
      ref={ref}
      width={440}
      height={200}
      id="lifecycle-fork"
      label="The same three-node line drawn twice. The published copy ends at a release node. The reader's copy has an edited builder card and ends where a person approves the release."
    >
      <g style={{ opacity: armed ? 0 : 1 }}>
        <Caption y={20}>as published</Caption>
        <NodeBox id="builder" x={COLUMNS[0]} y={PUBLISHED_Y} {...BOX} label="builder" />
        <NodeBox id="tester" x={COLUMNS[1]} y={PUBLISHED_Y} {...BOX} label="tester" />
        <NodeBox id="deployer" x={COLUMNS[2]} y={PUBLISHED_Y} {...BOX} label="deployer" />
        <Edge {...run(COLUMNS[0], COLUMNS[1], PUBLISHED_Y)} id="published-1" />
        <Edge {...run(COLUMNS[1], COLUMNS[2], PUBLISHED_Y)} id="published-2" />

        <Caption y={116}>your copy</Caption>
        <NodeBox
          id="copy-builder"
          x={COLUMNS[0]}
          y={COPY_Y}
          {...BOX}
          label="builder"
          sub="edited"
          tone="cyan"
        />
        <NodeBox id="copy-tester" x={COLUMNS[1]} y={COPY_Y} {...BOX} label="tester" />
        <Edge {...run(COLUMNS[0], COLUMNS[1], COPY_Y)} id="copy-1" />
        <Edge
          from={nodePort(COLUMNS[1], COPY_Y, "right", { ...BOX, pad: 4 })}
          to={[COLUMNS[2] - 16, COPY_Y]}
          id="copy-2"
        />
        <HumanMark x={COLUMNS[2]} y={COPY_Y} label="a person approves" id="approver" />
      </g>
    </Scene>
  );
}
