"use client";

import { HUMAN_PRESENCE_MARK } from "@/lib/format";
import {
  FlowEdge,
  FlowNode,
  FlowScene,
  HumanFlowNode,
  Sheet,
  type FlowTone,
} from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/* ============================================================
   The four phases, drawn as the one thing that changes across
   them: where the person is standing.

   The account this page reads carves the climb into four phases
   and says each has to be worth doing on its own. Four paragraphs
   say that; four drawings say it faster, and they say the part
   that is hardest to write down: the pipeline barely changes after
   phase 2, and what moves is the position of the person and what
   they are reading when they act.

   ── Redesign spec §1: the CAD boxes are gone ──
   The author rejected the boxed-graph style outright and kept the
   graticule behind it. So each phase is now three lit points on a
   thread with a violet mark beside one of them, which is the same
   claim in the register they chose. Nothing about the claim moved.

   Doc 2 §1.1 is why the mark is the subject of the strip rather
   than an apology in it. `HumanFlowNode` is violet by construction,
   takes no tone and no class, and `FlowTone` has no `human` member,
   so none of these four drawings can be read as a graph with a
   fault in it. Phase 4 puts the person at the front of the line,
   which is a move rather than a removal, and the caption says so.

   Four small scenes rather than one wide one: a 236-unit box in a
   phone-width card renders its labels larger than a 1000-unit box
   does, so the strip needs no second layout to stay legible.
   ============================================================ */

const FIG = {
  width: 236,
  height: 214,
  /** The thread the three points sit on. */
  x: 84,
  rows: [34, 104, 174],
  /** Where the mark stands, beside the row it acts at. */
  mark: 186,
} as const;

interface Phase {
  n: string;
  title: string;
  /** Three points, top to bottom. */
  points: readonly [string, string, string];
  /** Which row the person acts at. */
  at: 0 | 1 | 2;
  /** What they are reading when they act. Printed under the drawing, in violet. */
  doing: string;
  /** What the phase is worth on its own, in the account's terms. */
  alone: string;
}

const PHASES: Phase[] = [
  {
    n: "Phase 1",
    title: "Better context",
    points: ["AGENTS.md", "agent writes", "pull request"],
    at: 2,
    doing: "reads the diff",
    alone: "Better pull requests and fewer broken builds. Nobody's workflow changes.",
  },
  {
    n: "Phase 2",
    title: "Specs and holdouts",
    points: ["spec", "agent writes", "scenarios judge"],
    at: 2,
    doing: "reads the report",
    alone: "A spec produces validated code in hours. The localhost testing ritual is gone.",
  },
  {
    n: "Phase 3",
    title: "The gate comes off",
    points: ["spec", "agent writes", "auto-merge"],
    at: 2,
    doing: "may block",
    alone: "On the one or two services whose numbers hold. Everyone can still stop a merge.",
  },
  {
    n: "Phase 4",
    title: "The whole line",
    points: ["spec and scenarios", "agent writes", "auto-merge"],
    at: 0,
    doing: "writes both",
    alone: "Configuration rather than architecture. Nothing downstream of merge changes.",
  },
];

/** The thread runs cyan, which is the site's colour for a run that carries work. */
const THREAD: FlowTone = "cyan";

function PhaseScene({ phase }: { phase: Phase }) {
  const flow = useLuminousFlow({ amount: 0.3 });
  const markY = FIG.rows[phase.at];

  return (
    <FlowScene
      {...flow.scene}
      width={FIG.width}
      height={FIG.height}
      label={`${phase.n}: ${phase.points.join(", then ")}`}
      description={`A person acts at ${phase.points[phase.at]} and ${phase.doing}.`}
    >
      {/* Edges first: a node is drawn over the ends of its own curves. */}
      <FlowEdge
        from={[FIG.x, FIG.rows[0]]}
        to={[FIG.x, FIG.rows[1]]}
        tone={THREAD}
        id="run-0"
      />
      <FlowEdge
        from={[FIG.x, FIG.rows[1]]}
        to={[FIG.x, FIG.rows[2]]}
        tone={THREAD}
        id="run-1"
      />
      {/* No arrowhead and no travelling light: a person is not downstream of the node
          they stand at, and nothing flows along this run. */}
      <FlowEdge
        from={[FIG.x, markY]}
        to={[FIG.mark, markY]}
        toRadius={9}
        tone="dim"
        arrow={false}
        pulse={false}
        id="stands-at"
      />
      {phase.points.map((label, row) => (
        <FlowNode
          key={label}
          x={FIG.x}
          y={FIG.rows[row]}
          label={label}
          tone={THREAD}
          /* The three words are the whole of what the drawing says, so they do not wait
             for a pointer. Spec §1 allows a scene to spend `always` on the labels that
             carry its argument, and in a 236-unit box these are all of them. */
          reveal="always"
          id={`row-${row}`}
        />
      ))}
      {/* No label inside the scene: the violet caption under the drawing already says
          what the person is reading, and repeating it here would put two copies of the
          same words a centimetre apart. The `<desc>` above carries it for a reader who
          never sees either. */}
      <HumanFlowNode x={FIG.mark} y={markY} id="person" />
    </FlowScene>
  );
}

export function PhaseStrip() {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {PHASES.map((phase) => (
        <li key={phase.n}>
          <Sheet
            label={phase.n}
            title={phase.title}
            className="h-full"
            bodyClassName="p-3"
          >
            <PhaseScene phase={phase} />
            <p className="mt-2 text-center font-mono text-[11px] text-violet">
              <span aria-hidden>{HUMAN_PRESENCE_MARK.glyph} </span>
              {phase.doing}
            </p>
            <p
              className="mt-3 border-t pt-3 text-[13px] leading-relaxed text-muted"
              style={{ borderColor: "var(--color-blueprint)" }}
            >
              {phase.alone}
            </p>
          </Sheet>
        </li>
      ))}
    </ol>
  );
}
