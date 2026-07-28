"use client";

/* ============================================================
   Drawing 1 of 3 — what comes down, and which file runs.

   The folder is four rows because that is what `exportBundle`
   writes (`lib/content/bundle-export.ts`), and only the first row
   is wired to the runner because only the first row is what
   Attractor is given. `factory.dot` carries every card's `spec`
   inlined as its node's prompt, so the other three are there to be
   read and checked rather than to be executed, and a drawing that
   ran an arrow from all four would say the opposite.
   ============================================================ */

import { Edge, NodeBox, Scene, VIZ, VIZ_LINE, nodePort } from "@/components/viz";

import { useSceneReveal } from "./scene-reveal";

const FILE = { width: 160, height: 30 } as const;
const RUNNER = { width: 140, height: 46 } as const;

/** Row centres, top to bottom. `exportBundle` sorts by path; this reads runnable first. */
const FILES: readonly { id: string; label: string; y: number }[] = [
  { id: "factory", label: "factory.dot", y: 34 },
  { id: "topology", label: "blueprint.dot", y: 72 },
  { id: "cards", label: "cards/*.yaml", y: 110 },
  { id: "readme", label: "README.md", y: 148 },
];

const COLUMN_X = 104;
const RUNNER_X = 330;
const RUNNER_Y = 92;

export function DownloadScene() {
  const { ref, armed } = useSceneReveal();

  return (
    <Scene
      ref={ref}
      width={420}
      height={196}
      id="lifecycle-download"
      label="A published bundle as four files: factory.dot, blueprint.dot, the cards directory and a README. One arrow runs from factory.dot to a runner on the reader's own machine."
    >
      <g style={{ opacity: armed ? 0 : 1 }}>
        {FILES.map((file) => (
          <NodeBox
            key={file.id}
            id={file.id}
            x={COLUMN_X}
            y={file.y}
            width={FILE.width}
            height={FILE.height}
            label={file.label}
          />
        ))}

        <Edge
          from={nodePort(COLUMN_X, FILES[0].y, "right", { ...FILE, pad: 4 })}
          to={nodePort(RUNNER_X, RUNNER_Y, "left", { ...RUNNER, pad: 4 })}
          bend={-14}
          label="runs this"
          id="run"
        />

        <NodeBox
          id="runner"
          x={RUNNER_X}
          y={RUNNER_Y}
          width={RUNNER.width}
          height={RUNNER.height}
          label="attractor run"
          sub="on your machine"
        />

        {/* Under the runner rather than beside the column: the four rows above are what
            the site hands over, and this is the half the site has no part in. */}
        <text
          data-scene-part
          x={RUNNER_X}
          y={RUNNER_Y + 48}
          textAnchor="middle"
          fontSize={VIZ.font.sub}
          fill={VIZ_LINE}
        >
          your keys, your hardware
        </text>
      </g>
    </Scene>
  );
}
