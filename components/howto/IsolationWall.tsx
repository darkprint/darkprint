"use client";

import {
  FLOW,
  FlowAbsence,
  FlowEdge,
  FlowNode,
  FlowScene,
  Sheet,
  VIZ,
  toneColor,
  type FlowTone,
  type Point,
} from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/* ============================================================
   The holdout wall, in the vocabulary the rest of the site draws
   graphs in.

   The account this page reads puts one sentence above every other:
   "the code generation layer and the validation layer must be
   completely isolated from each other. The agent can't see the
   scenarios." That is the same claim `/spec/topology` makes about
   the starter blueprint, arriving from a different direction, and
   drawing it with the same glyphs is the point: `FlowAbsence` is
   the mark this site has for a connection somebody chose not to
   make, and the wall is exactly one of those.

   Six points, five runs and one absence. Nothing in the drawing is
   a claim about DarkPrint: it is a picture of somebody else's
   pipeline, and the caption beside it says so.

   ── Redesign spec §1 ──
   Converted out of the boxed register the author rejected. The one
   thing the conversion costs is the second line each box carried
   ("plain English" under the scenarios, "a separate model" under
   the evaluator); this register has no sub-label by design, and
   both sentences are stated in full in the prose beside the
   drawing, so nothing the figure said has stopped being said.

   The absence keeps its label showing at all times. It is the
   argument, and a reader who never moves a pointer still has to be
   able to read it.
   ============================================================ */

const FIG = {
  width: 720,
  height: 300,
  /** Both lanes, by the names the account gives its layers. */
  lane: { generation: 84, validation: 224 },
} as const;

type Spot = { id: string; x: number; y: number; label: string; tone: FlowTone };

const SPOTS: Spot[] = [
  { id: "spec", x: 96, y: FIG.lane.generation, label: "spec", tone: "line" },
  { id: "agent", x: 300, y: FIG.lane.generation, label: "coding agent", tone: "line" },
  { id: "pr", x: 512, y: FIG.lane.generation, label: "pull request", tone: "line" },
  { id: "holdout", x: 96, y: FIG.lane.validation, label: "holdout scenarios", tone: "cyan" },
  { id: "evaluator", x: 352, y: FIG.lane.validation, label: "evaluator", tone: "cyan" },
  { id: "merge", x: 604, y: FIG.lane.validation, label: "merge", tone: "emerald" },
];

const AT = new Map(SPOTS.map((spot) => [spot.id, spot]));

/** Centre of a named point. `undefined` if the point is not in the drawing. */
function at(id: string): Point | undefined {
  const spot = AT.get(id);
  return spot === undefined ? undefined : [spot.x, spot.y];
}

/** One run, drawn only when both of its ends exist. */
function Run({
  fromId,
  toId,
  label,
  tone = "line",
  bend,
}: {
  fromId: string;
  toId: string;
  label: string;
  tone?: FlowTone;
  bend?: number;
}) {
  const from = at(fromId);
  const to = at(toId);
  if (from === undefined || to === undefined) return null;
  return (
    <FlowEdge
      from={from}
      to={to}
      label={label}
      tone={tone}
      bend={bend}
      id={`${fromId}-${toId}`}
    />
  );
}

function WallScene() {
  const flow = useLuminousFlow({ amount: 0.25 });
  const holdout = at("holdout");
  const agent = at("agent");

  return (
    <FlowScene
      {...flow.scene}
      width={FIG.width}
      height={FIG.height}
      className="min-w-[40rem]"
      label="Generation and validation, held apart"
      description="A spec reaches a coding agent, which opens a pull request. The pull request is deployed and judged by a separate evaluator, which reads the holdout scenarios. The run from the holdout scenarios to the coding agent is drawn as an absence, labelled: the agent never sees them."
    >
      <Run fromId="spec" toId="agent" label="the goal" />
      <Run fromId="agent" toId="pr" label="the code" />
      <Run fromId="pr" toId="evaluator" label="an ephemeral deploy" tone="cyan" />
      <Run fromId="holdout" toId="evaluator" label="the tests" tone="cyan" />
      <Run fromId="evaluator" toId="merge" label="90% pass" tone="emerald" />

      {holdout !== undefined && agent !== undefined && (
        <FlowAbsence
          from={holdout}
          to={agent}
          bend={FLOW.edge.bend.gentle}
          label="the agent never sees them"
          id="never"
        />
      )}

      {SPOTS.map((spot) => (
        <FlowNode
          key={spot.id}
          x={spot.x}
          y={spot.y}
          label={spot.label}
          tone={spot.tone}
          /* Six words are the whole drawing. Hiding them behind a pointer would leave a
             reader on a laptop with six dots and one dashed line. */
          reveal="always"
          id={spot.id}
        />
      ))}

      {/* The two lane names. Static text, outside the reveal, because they are the axis
          the figure is read against rather than anything a glyph says. */}
      <text x={20} y={34} fontSize={VIZ.font.sub} fill={toneColor("dim")} letterSpacing="1.6">
        GENERATION
      </text>
      <text x={20} y={174} fontSize={VIZ.font.sub} fill={toneColor("dim")} letterSpacing="1.6">
        VALIDATION
      </text>
    </FlowScene>
  );
}

export function IsolationWall() {
  return (
    <figure className="flex flex-col gap-4">
      <Sheet
        label="The wall"
        title="Generation and validation, held apart"
        bodyClassName="p-3 sm:p-4"
      >
        {/* The scene is wider than a phone. Rather than a second layout, the drawing
            keeps its size and the reader scrolls it, which loses nothing: every claim in
            it is also in the prose underneath. `WhichTasksGlance` took the other route and
            was redrawn portrait, and the difference is what each figure is FOR: that one
            is its section's argument and has to be readable whole, this one is a reference
            beside a paragraph that states every claim in it.

            What the scroll needed was an affordance. Measured at 390: clientWidth 316
            against scrollWidth 640, so 51% of the drawing sits off the right edge with
            nothing saying so — it photographs as a crop, not as something that moves. The
            mask fades the last 12% of the box so the cut edge reads as "more this way".

            It lifts at `md`, where the container is ~672px against the scene's 640 floor
            and there is nothing left to scroll; a permanent mask would fade the right edge
            of a drawing that ends there. `black`/`transparent` are mask keywords rather
            than palette colours — a mask reads only alpha, so this fades to whatever
            ground the sheet is on and cannot disagree with a token. */}
        <div className="overflow-x-auto [mask-image:linear-gradient(to_right,black_88%,transparent)] md:[mask-image:none]">
          <WallScene />
        </div>
      </Sheet>
      {/* The length pass: this caption used to end on "the evaluator reads the scenarios
          and the agent never does, so an agent that fails a scenario is told which one
          and gets no wording it could aim at". The panel a screen below states the same
          rule at length and gives the reason for it, so the caption keeps the provenance
          and the reading of the dashed run, which are the two things only it says. */}
      <figcaption className="max-w-3xl text-sm leading-relaxed text-muted">
        The drawing is one team&apos;s pipeline, from the account linked below. The dashed
        run is this site&apos;s mark for a connection somebody decided against, and where
        the quality gate gets its meaning.
      </figcaption>
    </figure>
  );
}
