"use client";

import {
  FLOW,
  FlowEdge,
  FlowNode,
  FlowScene,
  HumanFlowNode,
  Sheet,
} from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/* ============================================================
   Spec §4.3, and the author's sentence behind it: "you need to
   make people get in a glance the concepts."

   The page under this figure is right and it was long. So the page
   opens with the whole argument as one drawing, and the drawing
   has to carry four things:

     1. there are four questions and they are asked in series;
     2. a no on 01, 02 or 03 names something missing that you can
        go and supply, so it is a state of the task rather than a
        verdict on it;
     3. a no on 04 is answered by a person standing at the step
        where a mistake gets expensive, which is a design and not
        a consolation (doc 2 §1.1, and `HumanFlowNode` is violet by
        construction so this branch cannot be drawn as a defect);
     4. four yeses mean the task is a candidate.

   Every reading below restates a sentence the sections underneath
   state in full, and the numbering is the numbering
   `WhichTasksChecks` uses, so a reader who scans the figure and
   then reads the page meets the same four things twice under the
   same names.

   ── Redesign spec §1 ──
   The boxed register the author rejected carried a second line
   under each gate. This one does not, so each gate says its number
   and its handle and the question itself is the card underneath.
   Labels stay `always` here: the four words are the argument, and
   a figure whose meaning waits for a pointer is a broken figure.

   The fourth branch runs dim rather than amber. Amber is the
   colour of "something is missing and you can go and get it",
   which is what 01 to 03 answer with; a person standing where a
   mistake becomes expensive is not a shortfall to be supplied, and
   painting that branch in the same colour would say it was.
   ============================================================ */

/**
 * Scene units. Wide, and read left to right.
 *
 * The boxed version ran down the page because a stack of 150-unit boxes reads on a phone.
 * A luminous node is a disc with its label under it, so a vertical spine would run through
 * every label on the way down; the four questions therefore lie along a row with the two
 * branches below it, and the sheet scrolls sideways under `md` rather than being redrawn.
 */
const FIG = {
  width: 660,
  height: 300,
  /** The four questions and the outcome, on one line. */
  row: 92,
  /** Where a no lands. */
  branch: 232,
} as const;

/** The four, in the order and under the names `WhichTasksChecks` gives them. */
const GATES = [
  { id: "verdict", x: 78, label: "01 verdict" },
  { id: "harness", x: 208, label: "02 harness" },
  { id: "edges", x: 338, label: "03 edges" },
  { id: "blast", x: 468, label: "04 cost" },
] as const;

const FITS = { x: 600, label: "a good fit" } as const;
const SUPPLY = { x: 248, label: "supply what is missing" } as const;
const PERSON = { x: 470, label: "before the expensive step" } as const;

function GlanceScene() {
  const flow = useLuminousFlow({ amount: 0.25 });

  return (
    <FlowScene
      {...flow.scene}
      width={FIG.width}
      height={FIG.height}
      className="min-w-[34rem]"
      label="Four questions, asked in order"
      description="A task enters four questions in order: the verdict, the harness, the edges, and the cost of being wrong. A no on the first three branches to supplying what is missing. A no on the fourth branches to a person standing at that step. Four yeses reach a point reading that the task is a good fit."
    >
      {/* ---------- the spine, one gate to the next ---------- */}
      {GATES.slice(0, -1).map((gate, index) => (
        <FlowEdge
          key={gate.id}
          from={[gate.x, FIG.row]}
          to={[GATES[index + 1].x, FIG.row]}
          tone="cyan"
          id={`${gate.id}-next`}
        />
      ))}
      <FlowEdge
        from={[GATES[3].x, FIG.row]}
        to={[FITS.x, FIG.row]}
        tone="emerald"
        id="to-fits"
      />

      {/* ---------- what a no leads to ---------- */}
      {GATES.slice(0, 3).map((gate) => (
        <FlowEdge
          key={`${gate.id}-no`}
          from={[gate.x, FIG.row]}
          to={[SUPPLY.x, FIG.branch]}
          bend={FLOW.edge.bend.gentle}
          tone="amber"
          label="no"
          name={`no on ${gate.label}, supply what is missing`}
          id={`${gate.id}-no`}
        />
      ))}
      <FlowEdge
        from={[GATES[3].x, FIG.row]}
        to={[PERSON.x, FIG.branch]}
        toRadius={9}
        tone="dim"
        label="no"
        name="no on 04, a person stands at that step"
        id="blast-no"
      />

      {/* ---------- the points ---------- */}
      <FlowNode
        x={SUPPLY.x}
        y={FIG.branch}
        label={SUPPLY.label}
        tone="amber"
        reveal="always"
        id="supply"
      />
      {/* Doc 2 §1.1: the answer to a task whose failure lands in production is a graph
          with somebody standing in it, and that is a design decision. The mark is violet
          because `HumanFlowNode` cannot be painted any other colour. */}
      <HumanFlowNode
        x={PERSON.x}
        y={FIG.branch}
        label={PERSON.label}
        reveal="always"
        id="person"
      />
      {GATES.map((gate) => (
        <FlowNode
          key={gate.id}
          x={gate.x}
          y={FIG.row}
          label={gate.label}
          tone="cyan"
          reveal="always"
          id={gate.id}
        />
      ))}
      <FlowNode
        x={FITS.x}
        y={FIG.row}
        label={FITS.label}
        tone="emerald"
        lit
        reveal="always"
        id="fits"
      />
    </FlowScene>
  );
}

export function WhichTasksGlance() {
  return (
    <figure className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
      <Sheet
        label="Read this first"
        title="Four questions, asked in order"
        note="a task enters at the left"
        className="lg:w-[30rem] lg:shrink-0"
        bodyClassName="p-3 sm:p-4"
      >
        <div className="overflow-x-auto">
          <GlanceScene />
        </div>
      </Sheet>

      <figcaption className="flex flex-col gap-4 text-sm leading-relaxed text-muted lg:pt-2">
        <p>
          A dark factory runs with nobody watching it, which puts the weight of the whole
          design on one property of the work: whether something other than your judgement
          can tell the graph that it is finished. That property belongs to the task, and it
          is fixed before you draw a single node.
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
        {/* The tally reading, denied where the four are first counted. Doc 2 §1.1 is about
            the autonomy class rather than this page, and the failure mode is the same
            shape: turn four questions into a score and people optimise the score. */}
        <p className="border-l-2 border-cyan/50 pl-4 text-dim">
          So do not add these up. Four yeses mean the task is a good fit, and one no on 04
          means the design changes rather than the task.
        </p>
      </figcaption>
    </figure>
  );
}
