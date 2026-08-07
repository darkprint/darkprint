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
import { More } from "@/components/ui/More";

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

   ── The length pass, and the 128 words it found here ──
   `/towards-a-dark-factory/the-climb` used to draw the strip and
   then print four panels underneath it, one per phase, each with
   its own "Phase N", its own title and a `goal` paragraph. Two
   cards for one phase, and the goal said what the caption beside
   the drawing already said: phase 3's read "One or two services,
   chosen because their numbers hold ... every team member can still
   block a merge" against `alone`'s "On the one or two services
   whose numbers hold. Everyone can still stop a merge." Phase 4
   stated "configuration rather than architecture" twice and
   "nothing downstream of the merge changes" twice.

   So the panel folded into the card that already carried the
   phase. `body` is what the panel held, behind a disclosure, and
   the two clauses the goals owned outright moved into it: phase
   1's "the biggest return has nothing to do with autonomy" and
   phase 3's "the configuration change is a single line". The rest
   of the goal text was the caption again and is gone.

   The disclosure is a native `<details>` for the reason
   `components/ui/More.tsx` records: the text is in the prerendered
   HTML, keyboard reachable and findable by find-in-page, so what
   it changes is what is on screen before a click.

   ── One card, two grounds, and which one the words sit on ──
   The whole phase used to live inside the `Sheet`: the drawing,
   the caption, the sentence about what the phase is worth, and the
   disclosure. `Sheet` defaults to `register="blueprint"`, so all
   of that sat on the cyanotype paper with `.bp-grid` running under
   it — and the prose was written in `text-muted`, which is a
   DARK-pole token. `app/globals.css` states the rule in its own
   header: dark is the default surface and blueprint sections opt
   in locally. Everywhere else on this site the cyanotype pole
   carries DRAWINGS and prose sits on the void.

   So the sheet keeps what is drawn — the scene, and the violet
   caption naming what the person is reading, which labels the mark
   inside the drawing — and the two paragraphs moved out to a
   `.panel` directly under each card, on the void, where every
   other body paragraph on the site lives.

   The disclosure moved to `components/ui/More.tsx` at the same
   time. This file wrote its own `<details>`, with the ▸ and a
   trailing space inside one `inline-block` span; the space
   collapses at the box edge, so all four cards shipped reading
   "▸WHAT IT INVOLVES". `More` puts the marker in a flex row with
   `gap-2`, which cannot collapse. Its summary is also differentiated
   per phase now — four identical summaries told a reader nothing
   about which one to open.
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
  /**
   * The disclosure's summary line: what is actually behind it.
   *
   * It used to be derived — `What ${phase} involves: ${title}` — which put the two labels
   * printed twelve pixels above it back on the screen glued together, four times. A
   * summary that repeats what a reader can already see gives them nothing to decide with,
   * which is the one thing `More`'s own docstring asks a summary to be. These name the
   * substance instead: the thresholds, the retry rule, the piece of infrastructure.
   *
   * Typed rather than derived, so it can say something the title does not. That costs the
   * guarantee that it cannot drift from the title — and the title is not what it is about
   * any more, so there is nothing left to drift from.
   */
  opens: string;
  /** What the phase actually involves. Behind the disclosure. */
  body: string;
}

const PHASES: Phase[] = [
  {
    n: "Phase 1",
    title: "Better context",
    points: ["AGENTS.md", "agent writes", "pull request"],
    at: 2,
    doing: "reads the diff",
    alone: "Better pull requests and fewer broken builds. Nobody's workflow changes.",
    opens: "The AGENTS.md layering, and the two rules that travel with it",
    body: "The biggest return in the account has nothing to do with autonomy. Every repository gets an AGENTS.md, about a hundred lines, a table of contents over a docs/ folder holding coding patterns, API conventions, auth and testing. Two rules travel with it: the agent runs the build and the full suite before it pushes, so a broken change is fixed locally rather than across CI runs, and architectural rules move from the wiki into linters.",
  },
  {
    n: "Phase 2",
    title: "Specs and holdouts",
    points: ["spec", "agent writes", "scenarios judge"],
    at: 2,
    doing: "reads the report",
    alone: "A spec produces validated code in hours. The localhost testing ritual is gone.",
    opens: "What the orchestrator does with a failure, and what the approver reads",
    body: "An orchestrator clones the repository, hands the spec to the coding agent, runs the build and tests on what comes back, and opens a pull request. A failure goes onto the prompt and the agent retries on the same branch, behind an abstraction that makes swapping it a line of configuration. The approver reads a satisfaction report rather than a diff: five minutes against two hours.",
  },
  {
    n: "Phase 3",
    title: "The gate comes off",
    points: ["spec", "agent writes", "auto-merge"],
    at: 2,
    doing: "may block",
    alone: "On the one or two services whose numbers hold. Everyone can still stop a merge.",
    opens: "The three measurements that have to hold, and the maintenance agents",
    body: "The change is one line of configuration, and three measurements have to hold first: scenario pass rate over the last twenty pull requests above 90%, false positives below 5%, and human rejections of something the scenarios passed below 10%. On timing, wait for twenty or thirty pull requests where gate and human agreed. The phase adds maintenance agents too, weekly jobs opening cleanup pull requests for drift and stale documentation through the same gate, because generated code accumulates small inconsistencies and nothing about that is catastrophic until nobody has swept for a year.",
  },
  {
    n: "Phase 4",
    title: "The whole line",
    points: ["spec and scenarios", "agent writes", "auto-merge"],
    at: 0,
    doing: "writes both",
    alone: "Configuration rather than architecture. Nothing downstream of merge changes.",
    opens: "Digital twins, and the one piece of infrastructure that is genuinely new",
    body: "Auto-merge expands to every service whose scenario numbers hold, a tagged ticket generates a spec and enters the pipeline, and dashboards go up. One piece of infrastructure is genuinely new: digital twins, mock servers standing in for the external dependencies that make scenario evaluation flaky or expensive, built one at a time starting with whichever causes the most trouble.",
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
    <ol className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {PHASES.map((phase) => (
        /* The drawing and its words are two objects in one column, not one object with
           two grounds. The grid stretches every `li` in a row to the same height, and
           `flex-1` spends the leftover on the panel, so the four panels start and end
           level whatever their sentence costs. */
        <li key={phase.n} className="flex flex-col gap-3">
          <Sheet label={phase.n} title={phase.title} bodyClassName="p-3">
            <PhaseScene phase={phase} />
            {/* Stays on the sheet: it names the violet mark drawn a centimetre above it,
                in the mark's own colour, and reads as part of the drawing rather than as
                a sentence about it. */}
            <p className="mt-2 text-center font-mono text-[11px] text-violet">
              <span aria-hidden>{HUMAN_PRESENCE_MARK.glyph} </span>
              {phase.doing}
            </p>
          </Sheet>
          <div className="panel flex flex-1 flex-col gap-3 p-5">
            <p className="text-[13px] leading-relaxed text-muted">{phase.alone}</p>
            {/* The summary names what is behind it. It was derived from the phase's own
                number and title — "What phase 1 involves: better context" — which is the
                sheet's label and its title, twelve pixels above, glued into a sentence. A
                reader deciding whether to open it learned nothing from it. See `opens`.

                And no `mt-auto` on it. Pinning the summary to the bottom of the panel
                lines the four up while they are closed, and then one open card grows the
                whole grid row and strands the other three summaries ~180px below the
                sentence they belong to. A disclosure sits under its own paragraph. */}
            <More
              bare
              className="border-t border-line pt-3"
              summary={phase.opens}
            >
              <p className="text-[13px] leading-relaxed text-muted">{phase.body}</p>
            </More>
          </div>
        </li>
      ))}
    </ol>
  );
}
