import { HUMAN_PRESENCE_MARK } from "@/lib/format";
import {
  Edge,
  HumanMark,
  NodeBox,
  Scene,
  Sheet,
  nodePort,
  type Point,
} from "@/components/viz";

/* ============================================================
   The four phases, drawn as the one thing that changes across
   them: where the person is standing.

   The account this page reads carves the climb into four phases
   and says each has to be worth doing on its own. Four paragraphs
   say that; four drawings say it faster, and they say the part
   that is hardest to write down — the pipeline barely changes
   after phase 2, and what moves is the position of the person and
   what they are reading when they act.

   Doc 2 §1.1 is why the mark is the subject of the strip rather
   than an apology in it. `HumanMark` is violet by construction and
   takes no colour from a caller, so none of these four drawings can
   be read as a graph with a fault in it. Phase 4 puts the person at
   the front of the line, which is a move rather than a removal, and
   the caption says so.

   Four small scenes rather than one wide one: a 250-unit box in a
   phone-width card renders its labels larger than a 1000-unit box
   does, so the strip needs no second layout to stay legible.
   ============================================================ */

const FIG = {
  width: 250,
  height: 214,
  node: { width: 150, height: 34 },
  x: 88,
  rows: [42, 106, 170],
  pad: 5,
  mark: 212,
} as const;

const PORT = { width: FIG.node.width, height: FIG.node.height, pad: FIG.pad };

interface Phase {
  n: string;
  title: string;
  /** Three boxes, top to bottom. */
  boxes: readonly [string, string, string];
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
    boxes: ["AGENTS.md", "agent writes", "pull request"],
    at: 2,
    doing: "reads the diff",
    alone: "Better pull requests and fewer broken builds. Nobody's workflow changes.",
  },
  {
    n: "Phase 2",
    title: "Specs and holdouts",
    boxes: ["spec", "agent writes", "scenarios judge"],
    at: 2,
    doing: "reads the report",
    alone: "A spec produces validated code in hours. The localhost testing ritual is gone.",
  },
  {
    n: "Phase 3",
    title: "The gate comes off",
    boxes: ["spec", "agent writes", "auto-merge"],
    at: 2,
    doing: "may block",
    alone: "On the one or two services whose numbers hold. Everyone can still stop a merge.",
  },
  {
    n: "Phase 4",
    title: "The whole line",
    boxes: ["spec and scenarios", "agent writes", "auto-merge"],
    at: 0,
    doing: "writes both",
    alone: "Configuration rather than architecture. Nothing downstream of merge changes.",
  },
];

/** The vertical run between two rows of the spine. */
function spine(from: number, to: number): { from: Point; to: Point } {
  return {
    from: nodePort(FIG.x, FIG.rows[from], "bottom", PORT),
    to: nodePort(FIG.x, FIG.rows[to], "top", PORT),
  };
}

function PhaseScene({ phase }: { phase: Phase }) {
  const markY = FIG.rows[phase.at];
  return (
    <Scene
      width={FIG.width}
      height={FIG.height}
      label={`${phase.n}: ${phase.boxes.join(", then ")}. A person acts at ${phase.boxes[phase.at]} and ${phase.doing}.`}
    >
      <Edge {...spine(0, 1)} />
      <Edge {...spine(1, 2)} />
      {/* No arrowhead: a person is not downstream of the node they stand at. */}
      <Edge
        from={nodePort(FIG.x, markY, "right", PORT)}
        to={[FIG.mark - 14, markY]}
        tone="human"
        arrow={false}
      />
      {phase.boxes.map((label, row) => (
        <NodeBox
          key={label}
          x={FIG.x}
          y={FIG.rows[row]}
          label={label}
          width={FIG.node.width}
          height={FIG.node.height}
          id={`row-${row}`}
        />
      ))}
      <HumanMark x={FIG.mark} y={markY} id="person" />
    </Scene>
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
            <p className="mt-3 border-t pt-3 text-[13px] leading-relaxed text-muted"
               style={{ borderColor: "var(--color-blueprint)" }}>
              {phase.alone}
            </p>
          </Sheet>
        </li>
      ))}
    </ol>
  );
}
