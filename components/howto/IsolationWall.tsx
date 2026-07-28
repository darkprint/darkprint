import {
  AbsentEdge,
  Edge,
  NodeBox,
  Scene,
  Sheet,
  VIZ,
  nodePort,
  toneColor,
  type Point,
} from "@/components/viz";

/* ============================================================
   The holdout wall, in the vocabulary the rest of the site draws
   graphs in.

   The account this page reads puts one sentence above every other:
   "the code generation layer and the validation layer must be
   completely isolated from each other. The agent can't see the
   scenarios." That is the same claim `/what-it-isnt` makes about
   the starter blueprint, arriving from a different direction, and
   drawing it with the same glyphs is the point: `AbsentEdge` is
   the mark this site has for a connection somebody chose not to
   make, and the wall is exactly one of those.

   Six boxes, five runs and one absence. Nothing in the drawing is
   a claim about DarkPrint: it is a picture of somebody else's
   pipeline, and the caption beside it says so.

   Static, and a server component. There is no motion to fall back
   from, which is the cheapest way to satisfy spec §1.
   ============================================================ */

const FIG = {
  width: 780,
  height: 320,
  node: { width: 152, height: 44 },
  pad: 6,
  /** Both lanes, by the names the account gives its layers. */
  lane: { generation: 92, validation: 248 },
} as const;

const PORT = { width: FIG.node.width, height: FIG.node.height, pad: FIG.pad };

type Box = { id: string; x: number; y: number; label: string; sub: string };

const BOXES: Box[] = [
  {
    id: "spec",
    x: 100,
    y: FIG.lane.generation,
    label: "spec",
    sub: "what to build",
  },
  {
    id: "agent",
    x: 312,
    y: FIG.lane.generation,
    label: "coding agent",
    sub: "reads the repo",
  },
  {
    id: "pr",
    x: 524,
    y: FIG.lane.generation,
    label: "pull request",
    sub: "built and tested",
  },
  {
    id: "holdout",
    x: 100,
    y: FIG.lane.validation,
    label: "holdout scenarios",
    sub: "plain English",
  },
  {
    id: "evaluator",
    x: 372,
    y: FIG.lane.validation,
    label: "evaluator",
    sub: "a separate model",
  },
  {
    id: "merge",
    x: 640,
    y: FIG.lane.validation,
    label: "merge",
    sub: "your existing pipeline",
  },
];

const AT = new Map(BOXES.map((box) => [box.id, box]));

/** A run between two boxes, face to face. `undefined` if either end is missing. */
function link(
  fromId: string,
  toId: string,
): { from: Point; to: Point } | undefined {
  const from = AT.get(fromId);
  const to = AT.get(toId);
  if (from === undefined || to === undefined) return undefined;
  if (from.y === to.y) {
    const rightwards = to.x > from.x;
    return {
      from: nodePort(from.x, from.y, rightwards ? "right" : "left", PORT),
      to: nodePort(to.x, to.y, rightwards ? "left" : "right", PORT),
    };
  }
  const downwards = to.y > from.y;
  return {
    from: nodePort(from.x, from.y, downwards ? "bottom" : "top", PORT),
    to: nodePort(to.x, to.y, downwards ? "top" : "bottom", PORT),
  };
}

/** One run, drawn only when both of its ends exist. */
function Run({
  fromId,
  toId,
  label,
  tone = "line",
}: {
  fromId: string;
  toId: string;
  label?: string;
  tone?: "line" | "cyan";
}) {
  const ends = link(fromId, toId);
  if (ends === undefined) return null;
  return <Edge {...ends} label={label} tone={tone} id={`${fromId}-${toId}`} />;
}

export function IsolationWall() {
  const never = link("holdout", "agent");

  return (
    <figure className="flex flex-col gap-4">
      <Sheet
        label="The wall"
        title="Generation and validation, held apart"
        note="one absence carries the argument"
        bodyClassName="p-3 sm:p-4"
      >
        {/* The scene is wider than a phone. Rather than a second layout, the drawing
            keeps its size and the reader scrolls it, which loses nothing: every claim in
            it is also in the prose underneath. */}
        <div className="overflow-x-auto">
          <Scene
            width={FIG.width}
            height={FIG.height}
            className="min-w-[40rem]"
            label="A spec reaches a coding agent, which opens a pull request. The pull request is deployed and judged by a separate evaluator, which reads the holdout scenarios. The run from the holdout scenarios to the coding agent is drawn as an absence, labelled: the agent never sees them."
          >
            <Run fromId="spec" toId="agent" label="the goal" />
            <Run fromId="agent" toId="pr" label="the code" />
            <Run fromId="pr" toId="evaluator" label="an ephemeral deploy" tone="cyan" />
            <Run fromId="holdout" toId="evaluator" label="the tests" />
            <Run fromId="evaluator" toId="merge" label="90% pass" />

            {never !== undefined && (
              <AbsentEdge {...never} label="the agent never sees them" id="never" />
            )}

            {BOXES.map((box) => (
              <NodeBox
                key={box.id}
                x={box.x}
                y={box.y}
                label={box.label}
                sub={box.sub}
                tone={box.id === "holdout" ? "cyan" : "line"}
                width={FIG.node.width}
                height={FIG.node.height}
                id={box.id}
              />
            ))}

            <text
              x={24}
              y={40}
              fontSize={VIZ.font.sub}
              fill={toneColor("dim")}
              letterSpacing="1.6"
            >
              GENERATION
            </text>
            <text
              x={24}
              y={196}
              fontSize={VIZ.font.sub}
              fill={toneColor("dim")}
              letterSpacing="1.6"
            >
              VALIDATION
            </text>
          </Scene>
        </div>
      </Sheet>
      <figcaption className="max-w-3xl text-sm leading-relaxed text-muted">
        The drawing is one team&apos;s pipeline, taken from the account linked at the foot
        of this page. The dashed run is the one this site has a mark for: a connection
        somebody decided against, which is where the quality gate gets its meaning. The
        evaluator reads the scenarios and the agent never does, so an agent that fails a
        scenario is told which one and gets no wording it could aim at.
      </figcaption>
    </figure>
  );
}
