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

   ── Why this is a column of discs and not a column of boxes ──
   Redesign spec §1, on the author's instruction: "the look of [the
   roles figure] and related figure using the same style, I don't
   like at all. What I like is the pattern on the background but not
   the style of the graph." This drawing was one of the three that
   still shipped the CAD register after that instruction, on
   `/blueprints`, which is where the landing's own primary door
   goes. A file is a lit point with its name under it, the run into
   the runner carries a travelling light, and the graticule behind
   it is untouched.
   ============================================================ */

import { FLOW, FlowEdge, FlowNode, FlowScene } from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/**
 * The frame.
 *
 * 340 and not 420: these three panels render 270 CSS px wide inside a `panel` on a phone,
 * measured off a running build, and `FLOW.frame` carries the arithmetic that turns that
 * into a label size. At 420 the labels landed at 8.4 CSS px; at 340 they clear
 * `FLOW.frame.legible`.
 */
const FIGURE = { width: 340, height: 202 } as const;

/** Row centres, top to bottom. `exportBundle` sorts by path; this reads runnable first. */
const FILES: readonly { id: string; label: string; y: number }[] = [
  { id: "factory", label: "factory.dot", y: 32 },
  { id: "topology", label: "blueprint.dot", y: 78 },
  { id: "cards", label: "cards/*.yaml", y: 124 },
  { id: "readme", label: "README.md", y: 170 },
];

const COLUMN_X = 87;
const RUNNER_X = 258;
const RUNNER_Y = 78;

/** The runnable file and the runner, larger than the three rows that are read rather than run. */
const LIT_R = 8;
const REST_R = 5;

export function DownloadScene() {
  const flow = useLuminousFlow({ amount: 0.3 });

  return (
    <FlowScene
      {...flow.scene}
      width={FIGURE.width}
      height={FIGURE.height}
      id="lifecycle-download"
      label="A published bundle as four files, with one run from factory.dot to a runner"
      description="A bundle is four files: factory.dot, blueprint.dot, the cards directory and a README. One run goes from factory.dot to Attractor on the reader's own machine. The other three files are read rather than executed."
    >
      <FlowEdge
        from={[COLUMN_X, FILES[0].y]}
        to={[RUNNER_X, RUNNER_Y]}
        bend={-FLOW.edge.bend.gentle}
        fromRadius={LIT_R}
        toRadius={LIT_R}
        label="runs this"
        id="run"
      />

      {FILES.map((file, index) => (
        <FlowNode
          key={file.id}
          id={file.id}
          x={COLUMN_X}
          y={file.y}
          r={index === 0 ? LIT_R : REST_R}
          lit={index === 0}
          tone="cyan"
          label={file.label}
          reveal="always"
        />
      ))}

      {/* One disc and one string for the half this site has no part in. The old drawing
          spent a box, a sub-label and a caption on the same sentence. */}
      <FlowNode
        id="runner"
        x={RUNNER_X}
        y={RUNNER_Y}
        r={LIT_R}
        tone="line"
        label="attractor run"
        name="attractor run, on your own machine with your own keys"
        reveal="always"
      />
    </FlowScene>
  );
}
