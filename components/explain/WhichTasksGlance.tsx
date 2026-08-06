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
    /* One column at every width. The drawing and its 117-word caption sat side by side
       from `lg` up, which put the whole of the route's opening argument on one screen
       beside the figure it explains and asked a reader to take both at once. The author:
       "too information condensed in a 16:9 page. Think a user like it is a child where
       you need to point the attention to a concept at time."

       `lg:w-[30rem] lg:shrink-0` goes with the `lg:flex-row` it was sized for. Left
       behind, the drawing keeps a desktop column width under a now full-width caption,
       which is the same figure in a worse place. */
    <figure className="flex flex-col gap-4">
      <Sheet
        label="Read this first"
        title="Four questions, asked in order"
        bodyClassName="p-3 sm:p-4"
      >
        <div className="overflow-x-auto">
          <GlanceScene />
        </div>
      </Sheet>

      {/* The length pass (PROJECT.md §3.1). Two sentences left this caption and both were
          second copies: "that property belongs to the task, and it is fixed before you
          draw a single node", which is the page's own lead one paragraph up, and the tally
          reading's restatement of what a no on 04 does, which the paragraph directly above
          it now carries alone. `WhichTasksRemedies` used to open its third card with this
          caption's 04 sentence word for word; that copy is the one that went, and this is
          the one that stayed, because it stands beside the branch it describes. */}
      {/* The scale pass put `.prose-lane` on it. This caption is body prose and it had no
          measure at all, so on a 1440 it ran the full 1152px container — roughly 180
          characters a line at 14px, the widest paragraph on the route, sitting directly
          under a figure whose whole job is to be taken in at a glance. The drawing keeps
          the container; the reading of it does not, which is the rule `FigureFrame`
          already carries wherever a spec figure is drawn.

          The two callouts are `.label` now. They were `tracking-[0.14em]` at 11px, which
          is the 14px tier's tracking on the 11px tier's size — the exact collision the
          three mono tiers were separated to make impossible. Their colours stay: they are
          the figure's own two branches quoted in the caption that reads it, so the amber
          edge above and the amber callout here have to match. */}
      <figcaption className="prose-lane flex flex-col gap-4 text-sm leading-relaxed text-muted lg:pt-2">
        <p>
          A dark factory runs with nobody watching it, so the design rests on one property
          of the work: whether something other than your judgement can tell the
          graph it is finished.
        </p>
        <p>
          <span className="label text-amber">01 to 03</span>{" "}
          name something missing you can supply: a harness nobody has written, a target
          nobody has decided. Answer them and ask again.
        </p>
        <p>
          <span className="label text-violet">04</span>{" "}
          works differently. No amount of coverage makes a wrong answer cheap once it is in
          production, so the graph changes instead of the task: a person at the step where a
          mistake becomes expensive, everything upstream running unattended.
        </p>
        {/* The tally reading, denied where the four are first counted. Doc 2 §1.1 is about
            the autonomy class rather than this page, and the failure mode is the same
            shape: turn four questions into a score and people optimise the score. */}
        <p className="border-l-2 border-cyan/50 pl-4 text-dim">
          So do not add these up. Four yeses mean the task is a good fit.
        </p>
      </figcaption>
    </figure>
  );
}
