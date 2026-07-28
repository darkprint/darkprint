import {
  Edge,
  HumanMark,
  NodeBox,
  Scene,
  Sheet,
  VIZ,
  nodePort,
  toneColor,
  type Point,
} from "@/components/viz";

/* ============================================================
   Spec §4.3, and the author's sentence behind it: "you need to
   make people get in a glance the concepts."

   The page under this figure is right and it is long. Four
   questions with a probe and two readings each, eight worked
   examples, three remedies: everything a reader needs and nothing
   they can take in before deciding whether to keep reading. So the
   page now opens with the whole argument as one drawing.

   What the drawing has to carry, and it is the entire page:

     1. there are four questions and they are asked in series;
     2. a no on 01, 02 or 03 names something missing that you can
        go and supply, so it is a state of the task rather than a
        verdict on it;
     3. a no on 04 is answered by a person standing at the step
        where a mistake gets expensive, which is a design and not
        a consolation (doc 2 §1.1, and `HumanMark` is violet by
        construction so this branch cannot be drawn as a defect);
     4. four yeses mean the task is a candidate.

   Nothing here is new copy in the sense that matters. Every
   reading below restates a sentence the sections underneath state
   in full, and the numbering is the numbering `WhichTasksChecks`
   already uses, so a reader who scans the figure and then reads
   the page meets the same four things twice under the same names.

   No client component and no motion: it is a static drawing, and
   a static drawing is already the finished state that spec §1
   asks an animated one to fall back to.
   ============================================================ */

/**
 * Scene units. Tall rather than wide on purpose.
 *
 * A wide figure has to shrink to a phone's width, and a scene's labels shrink with it —
 * at 460 units across a 343-pixel screen a 12-unit label renders at nine pixels. A spine
 * running down the page keeps the box narrow, so the same drawing is legible on a phone
 * and on a desktop column without a second layout to maintain.
 */
const FIG = {
  width: 470,
  height: 462,
  gate: { x: 132, width: 180, height: 46 },
  branch: { x: 358, width: 184, height: 46 },
  pad: 6,
} as const;

const GATE_PORT = {
  width: FIG.gate.width,
  height: FIG.gate.height,
  pad: FIG.pad,
};

/** The four, in the order and under the names `WhichTasksChecks` gives them. */
const GATES = [
  { id: "verdict", label: "01 the verdict", sub: "something else can decide" },
  { id: "harness", label: "02 the harness", sub: "the check can exist" },
  { id: "edges", label: "03 the edges", sub: "the target is written down" },
  { id: "blast", label: "04 the cost", sub: "being wrong is cheap" },
] as const;

/** Where each gate sits on the spine. */
const ROW = [86, 174, 262, 350] as const;

/** Vertical run down the spine, box face to box face. */
function spine(fromY: number, toY: number): { from: Point; to: Point } {
  return {
    from: nodePort(FIG.gate.x, fromY, "bottom", GATE_PORT),
    to: nodePort(FIG.gate.x, toY, "top", GATE_PORT),
  };
}

export function WhichTasksGlance() {
  const supply = { x: FIG.branch.x, y: ROW[1] };
  const exitY = 428;

  // The three runs into the one box, landing on separate points of its left face so three
  // arrowheads do not stack on one pixel.
  const supplyPort = (offset: number): Point => {
    const [x, y] = nodePort(supply.x, supply.y, "left", {
      width: FIG.branch.width,
      height: FIG.branch.height,
      pad: FIG.pad,
    });
    return [x, y + offset];
  };

  return (
    <figure className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
      <Sheet
        label="Read this first"
        title="Four questions, asked in order"
        note="a task enters at the top"
        className="lg:w-[26rem] lg:shrink-0"
        bodyClassName="p-3 sm:p-4"
      >
        <Scene
          width={FIG.width}
          height={FIG.height}
          label="A task enters four questions in order: the verdict, the harness, the edges, and the cost of being wrong. A no on the first three branches to supplying what is missing. A no on the fourth branches to a person standing at that step. Four yeses reach a box reading that the task is a good fit."
        >
          {/* ---------- the spine ---------- */}
          <Edge
            from={[FIG.gate.x, 26]}
            to={nodePort(FIG.gate.x, ROW[0], "top", GATE_PORT)}
            tone="dim"
          />
          <Edge {...spine(ROW[0], ROW[1])} />
          <Edge {...spine(ROW[1], ROW[2])} />
          <Edge {...spine(ROW[2], ROW[3])} />
          <Edge
            from={nodePort(FIG.gate.x, ROW[3], "bottom", GATE_PORT)}
            to={nodePort(FIG.gate.x, exitY, "top", {
              width: FIG.gate.width,
              height: 38,
              pad: FIG.pad,
            })}
            tone="emerald"
          />

          {/* ---------- the branches, all four of them a no ---------- */}
          <Edge
            from={nodePort(FIG.gate.x, ROW[0], "right", GATE_PORT)}
            to={supplyPort(-12)}
            tone="amber"
            label="no"
          />
          <Edge
            from={nodePort(FIG.gate.x, ROW[1], "right", GATE_PORT)}
            to={supplyPort(0)}
            tone="amber"
            label="no"
          />
          <Edge
            from={nodePort(FIG.gate.x, ROW[2], "right", GATE_PORT)}
            to={supplyPort(12)}
            tone="amber"
            label="no"
          />
          <Edge
            from={nodePort(FIG.gate.x, ROW[3], "right", GATE_PORT)}
            to={[FIG.branch.x - 18, ROW[3]]}
            tone="human"
            label="no"
          />

          {/* ---------- what a no leads to ---------- */}
          <NodeBox
            x={supply.x}
            y={supply.y}
            label="supply what is missing"
            sub="then ask again"
            tone="amber"
            width={FIG.branch.width}
            height={FIG.branch.height}
            id="supply"
          />
          {/* Doc 2 §1.1: the answer to a task whose failure lands in production is a graph
              with somebody standing in it, and that is a design decision. The mark is
              violet because `HumanMark` cannot be painted any other colour. */}
          <HumanMark
            x={FIG.branch.x}
            y={ROW[3]}
            label="a person stands here"
            id="person"
          />

          {/* ---------- the four gates ---------- */}
          {GATES.map((gate, index) => (
            <NodeBox
              key={gate.id}
              x={FIG.gate.x}
              y={ROW[index]}
              label={gate.label}
              sub={gate.sub}
              tone="cyan"
              width={FIG.gate.width}
              height={FIG.gate.height}
              id={gate.id}
            />
          ))}

          <NodeBox
            x={FIG.gate.x}
            y={exitY}
            label="a good fit"
            sub="four yeses"
            tone="emerald"
            width={FIG.gate.width}
            height={38}
            id="fits"
          />

          <text
            x={FIG.gate.x}
            y={16}
            textAnchor="middle"
            fontSize={VIZ.font.sub}
            fill={toneColor("dim")}
          >
            your task
          </text>
        </Scene>
      </Sheet>

      <figcaption className="flex flex-col gap-4 text-sm leading-relaxed text-muted lg:pt-2">
        {/* The page's old lead paragraph, kept word for word and moved here. It was the
            first thing on the page and it is still the first thing a reader reads; what
            changed is that the drawing now stands beside it. */}
        <p>
          A dark factory runs with nobody watching it, which puts the weight of the whole
          design on one property of the work: whether something other than your judgement
          can tell the graph that it is finished. That property belongs to the task, and it
          is fixed before you draw a single node. The four questions in the drawing tell
          you whether your task has it.
        </p>
        <p>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
            01 to 03{" "}
          </span>
          name something missing you can go and supply. A harness nobody has written yet,
          or a target nobody has decided. Answer them and ask again.
        </p>
        <p>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-violet">
            04{" "}
          </span>
          works differently. No amount of coverage makes a wrong answer cheap once it is
          already in production, so the graph changes instead of the task: a node with a
          person at it, positioned at the step where a mistake becomes expensive, and
          everything upstream of it running unattended.
        </p>
      </figcaption>
    </figure>
  );
}
