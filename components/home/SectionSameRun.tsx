import { Fragment } from "react";

import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  ABSENT_GLYPH,
  FLOW,
  FlowEdge,
  FlowNode,
  FlowScene,
  Sheet,
  VIZ,
  VIZ_KNOCKOUT,
} from "@/components/viz";
import { cx } from "@/lib/format";

import { BeatCaption } from "./BeatCaption";

/* ============================================================
   Beat 2: what a score is worth, with and without a specification.

   The author, 2026-08-10:

     "if you start from a prompt or a skill, your experiment is not reproducible. You see
      the agents spawning, but the harness decides how to reach the goal. There is no
      blueprint."

   The argument runs in three moves and the figures are the second and third of them:

     1. a prompt does not model the steps, so every run is a different run and every score
        it earns is a one-off;
     2. a blueprint fixes the steps, which makes a rerun the same run;
     3. that is what makes a score an instrument. Test a step, swap it for another version,
        or take it out, and the change in the number belongs to the thing you moved.

   ── What this beat used to draw, and why the drawing changed ──
   Two panels of routes: three curves on the left, one on the right. The claim was right and
   the figure was not carrying it. The headline promised a comparison of RUNS and each panel
   drew a single graph; the two sides had different amounts of work in them, so the
   comparison was between a busy picture and an empty one; and the colour did the arguing,
   dim against cyan, which is a mood rather than a finding.

   Both panels now show runs, and the difference between them is the thing the beat is
   about. Left: three runs of one goal, each through steps nobody chose, each ending on a
   number that cannot be compared with the other two. Right: four runs of one blueprint,
   one step touched per run, and a column of deltas that reads down the page. The vertical
   read of that column IS the figure — the whole point is that each number belongs to one
   move — which is why the score and the delta sit in fixed columns rather than flowing.

   ── The intermediate nodes on the left are deliberately unnamed ──
   That is the panel. The steps are not modelled, so there is nothing to label, and a
   drawing that labelled them would be showing the reader the thing it says does not exist.

   ── Nothing here is revealed by an animation ──
   The mock draws each run in turn on a 7.2s loop, with the nodes appearing as the stroke
   reaches them. Spec §0 and `components/home/beats.test.ts` do not allow it: the server
   renders the finished thing, and animation may only move what is already there. A reveal
   that starts from nothing is a beat whose content is missing for the reader with no
   JavaScript, with reduced motion, and in the first frame for everyone else. All three runs
   are drawn, and the eye reads them as three because they are three.

   ── The honesty line this beat runs along, and where it now stands ──
   `components/site/honesty.test.ts` pins, in the open, that nothing on this site measures a
   run. This beat claims a property of the ARTIFACT and never a capability of the site: the
   running is the reader's, the verb is `attribute`, and the word for a scored run never
   appears, because `RunLayers` defines it precisely and a landing beat would use it loosely.

   The rewrite raises the stakes, and the qualifier is new because of it. `0.62 → 0.86` is a
   worked example: DarkPrint does not run anybody's graph, so there is no per-run number
   anywhere in the product, and a figure shaped like a readout has to say so beside itself
   rather than in a comment. The line under the right panel is that sentence and
   `honesty.test.ts` holds it.

   ── Two em dashes are not in the shipped copy, and that is not a transcription slip ──
   The hand-off writes the lead and the right-hand caption with a pause dash. `components/
   home` is in `workspace.test.ts`'s `COPY_TREES`, which is the rule that keeps the pause
   dash off the rendered site; both became a comma. Nothing else in either sentence moved.
   ============================================================ */

/* --------------------- the left panel --------------------- */

/** Scene units, which are viewBox units. */
const SCENE = { width: 400, height: 210 } as const;

/**
 * Every position here is a `Point`, which this register spells `[x, y]` and not `{x, y}`.
 *
 * Worth stating because the two are interchangeable to read and not to run: `FlowEdge`
 * hands its endpoints to `flowRun`, which does arithmetic on the tuple, so an object goes
 * all the way through and comes out as `d="M NaN NaN Q NaN NaN NaN NaN"`. The edge still
 * renders, still carries its tone and its pulse, and draws nothing at all. `beats.test.ts`
 * greps this beat's markup for `NaN` for that reason.
 */
type Point = readonly [number, number];

/** Where all three runs start. One goal, and it is the only thing they share. */
const GOAL: Point = [58, 40];

/**
 * Three runs, each through two steps nobody specified, each ending on its own number.
 *
 * Deliberately irregular. Three lanes at even spacing read as a designed fan, which is the
 * opposite of the claim: nothing chose these shapes, and a drawing where something clearly
 * did would be arguing the other side. The scores are the hand-off's and they are
 * illustrative, which the line under the right panel says in the open.
 */
const IMPROVISED: readonly { steps: readonly Point[]; end: Point; score: string }[] = [
  { steps: [[150, 48], [248, 34]], end: [344, 56], score: "0.62" },
  { steps: [[142, 110], [240, 126]], end: [342, 112], score: "0.81" },
  { steps: [[134, 170], [246, 178]], end: [340, 166], score: "0.55" },
];

/* --------------------- the right panel --------------------- */

/** What a cell in an iteration row is: a pinned version, the changed one, or a hole. */
type Step = { at: string; changed?: true } | { removed: true };

interface Iteration {
  n: number;
  retrieve: Step;
  rank: Step;
  draft: Step;
  score: string;
  /** `undefined` on the baseline, which has nothing to be a delta against. */
  delta?: { text: string; gain: boolean };
}

/**
 * Four runs of one blueprint, one move each.
 *
 * Iteration 3 is a real finding and not an error state: dropping `rank` costs 0.05, which is
 * the reason `rank` stays in the graph. A figure that only showed gains would be describing
 * a tool that always improves things, which is not what an instrument is for.
 */
const ITERATIONS: readonly Iteration[] = [
  {
    n: 1,
    retrieve: { at: "@v1" },
    rank: { at: "@v1" },
    draft: { at: "@v1" },
    score: "0.62",
  },
  {
    n: 2,
    retrieve: { at: "@v2", changed: true },
    rank: { at: "@v1" },
    draft: { at: "@v1" },
    score: "0.71",
    delta: { text: "+0.09", gain: true },
  },
  {
    n: 3,
    retrieve: { at: "@v2" },
    rank: { removed: true },
    draft: { at: "@v1" },
    score: "0.66",
    delta: { text: "−0.05", gain: false },
  },
  {
    n: 4,
    retrieve: { at: "@v2" },
    rank: { at: "@v1" },
    draft: { at: "@v2", changed: true },
    score: "0.86",
    delta: { text: "+0.15", gain: true },
  },
];

/** The three steps, in the order the graph runs them. Column heads and pill names at once. */
const STEPS = ["retrieve", "rank", "draft"] as const;

/**
 * One pill, at `VIZ.node`'s own 132:46 aspect scaled to fit four columns.
 *
 * `box-sizing` is the default here and the border is `VIZ.stroke.base`, so a changed pill
 * and an unchanged one are the same size: a 1.4px border that grew the box would make the
 * amber row wider than the rows it is being compared with, and every column in this figure
 * exists to be compared down the page.
 */
function Pill({ step }: { step: Step }) {
  const box = "flex h-[39px] w-[112px] flex-col items-center justify-center gap-0.5 rounded-sm border text-center";

  if ("removed" in step) {
    /* The slot is kept, not closed. A row of two pills where the others have three would
       say the step moved; a dashed hole says it was taken out, which is the move being
       attributed. `ABSENT_GLYPH` and `VIZ.dash.absent` are the same mark and the same dash
       the tables and the ledger already use for an absent row. */
    return (
      <span
        className={cx(box, "border-dim/60 text-dim")}
        style={{ borderStyle: "dashed", borderWidth: VIZ.stroke.base, borderSpacing: 0 }}
      >
        <span aria-hidden className="font-mono text-[13px] leading-none">
          {ABSENT_GLYPH}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]">removed</span>
      </span>
    );
  }

  const changed = step.changed === true;
  return (
    <span
      className={cx(
        box,
        changed ? "border-amber text-amber-bright" : "border-blueprint-line/55 text-blueprint-ink",
      )}
      style={{
        borderWidth: VIZ.stroke.base,
        background: changed
          ? "color-mix(in oklab, var(--color-amber) 8%, transparent)"
          : VIZ_KNOCKOUT,
      }}
    >
      <span className="font-mono text-[12px] leading-none">{step.at}</span>
    </span>
  );
}

/**
 * A panel head: what the panel is, and the one line saying how to read it.
 *
 * DOM text above the drawing rather than labels inside it. The landing's figures have to be
 * readable without a pointer, and a heading a screen reader reaches in the normal flow is a
 * stronger answer to that than a label the scene reveals.
 */
function PanelHead({ title, rail }: { title: string; rail: string }) {
  return (
    <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="label-lead">{title}</span>
      <span className="label">{rail}</span>
    </figcaption>
  );
}

export function SectionSameRun() {
  return (
    <section id="reproducible" className="scroll-mt-24 bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          /* No eyebrow. `.eyebrow` is rationed to one per page or per full-bleed band and
             the hero has spent it, which is the same reason beat 3 gave up its own.

             The title stays `text-fg` while beats 3 and 4 colour theirs. Each of those IS
             one of the two artifacts and names its pole; this beat is the argument about
             both, so it claims neither. */
          title="The same run twice"
          lead="A prompt does not model the steps. Your harness invents them, so every run is a different run and every score it earns is a one-off. A blueprint fixes the steps, which makes a rerun the same run, and that is what turns a score into an instrument you can act on."
          align="center"
          className="mx-auto"
        />

        {/* `xl` and not `lg`, and the breakpoint is arithmetic rather than taste. The right
            panel's table is 530px wide: three 112px pills, the score and delta columns, the
            row header and the gaps between them. Two columns of a 1152px container with a
            24px gap give each panel 564px and its sheet 532px of body, so the split fits at
            `xl` with two pixels to spare and does not at `lg`, where a 1024px viewport
            leaves 444px and the figure scrolls sideways. A figure whose whole argument is a
            vertical read down a column is the last one that should be asking a reader to
            drag it horizontally, so it stays stacked until both panels fit side by side. */}
        <div className="mt-12 grid gap-6 xl:grid-cols-2">
          {/* ---------- three runs, three sets of steps ---------- */}
          <figure className="flex min-w-0 flex-col gap-3">
            <PanelHead
              title="from a prompt"
              rail="the steps are not yours to choose · three scores, nothing to credit"
            />
            <Sheet>
              <FlowScene
                width={SCENE.width}
                height={SCENE.height}
                label="One goal run three times from a prompt"
                description="A goal on the left, and three runs that each pass through two steps of their own before ending on a score of their own: 0.62, 0.81 and 0.55."
              >
                <FlowNode
                  x={GOAL[0]}
                  y={GOAL[1]}
                  r={FLOW.node.r}
                  lit
                  label="goal"
                  reveal="always"
                  mark="schematic"
                />
                {IMPROVISED.map((run) => {
                  const points: readonly Point[] = [GOAL, ...run.steps, run.end];
                  return (
                    <Fragment key={run.score}>
                      {points.slice(0, -1).map((from, i) => (
                        /* No pulse. A travelling light says "this is the path", and the
                           panel's claim is that there is no path anybody chose. */
                        <FlowEdge
                          key={`${run.score}-${i}`}
                          from={from}
                          to={points[i + 1]}
                          tone="dim"
                          pulse={false}
                        />
                      ))}
                      {run.steps.map((step) => (
                        /* Unlabelled, which is the panel. See the header. */
                        <FlowNode
                          key={`${run.score}-${step[0]}`}
                          x={step[0]}
                          y={step[1]}
                          r={FLOW.node.r}
                          tone="dim"
                          mark="schematic"
                        />
                      ))}
                      <FlowNode
                        x={run.end[0]}
                        y={run.end[1]}
                        r={FLOW.node.r}
                        tone="dim"
                        label={run.score}
                        reveal="always"
                        mark="schematic"
                      />
                    </Fragment>
                  );
                })}
              </FlowScene>
            </Sheet>
            <figcaption className="text-sm leading-relaxed text-muted">
              Three runs of one goal. Different steps each time, so the three numbers cannot
              be compared to each other and none of them can be traced to a decision.
            </figcaption>
          </figure>

          {/* ---------- four runs, one step touched each ---------- */}
          <figure className="flex min-w-0 flex-col gap-3">
            <PanelHead
              title="from a blueprint, run by a harness"
              rail="one step touched per run · the harness runs the rest identically"
            />
            <Sheet bodyClassName="relative overflow-x-auto p-4">
              {/* A table, and not a scene. The three pills across a row are a chain and the
                  four scores down a column are the argument, which is a grid of related
                  values with headers on both axes: that is what a table is, and drawing it
                  in SVG would spend the accessibility of one on the appearance of the
                  other. `scope` on both axes, so a reader arriving on a cell is told which
                  iteration and which step it belongs to. */}
              {/* `border-spacing-x-1` and `p-4` on the sheet, not the `-x-2` and `sm:p-6`
                  this started with. Measured at 2044px: the table wanted 565px inside a
                  514px column and scrolled sideways in a figure whose entire argument is a
                  vertical read. Four pixels between cells and sixteen at the sheet's edge
                  buy 36 of the 51, and the row header buys the rest by saying `1` under a
                  column head that already says `run` rather than repeating `iter` down the
                  page. Nothing about the pills moved: 112x39 is `VIZ.node`'s 132:46 aspect
                  and it is what the figure is drawn to. */}
              <table className="w-full min-w-[30rem] border-separate border-spacing-x-1 border-spacing-y-2 text-left">
                <caption className="sr-only">
                  Four runs of one blueprint, numbered 1 to 4. Each row changes one step and
                  reports the score and the change from the run before it.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="label px-1 pb-1 font-normal">
                      run
                    </th>
                    {STEPS.map((step) => (
                      <th
                        key={step}
                        scope="col"
                        className="label px-1 pb-1 text-center font-normal"
                      >
                        {step}
                      </th>
                    ))}
                    <th scope="col" className="label px-1 pb-1 text-right font-normal">
                      score
                    </th>
                    <th scope="col" className="label px-1 pb-1 text-right font-normal">
                      delta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ITERATIONS.map((iteration) => (
                    <tr key={iteration.n}>
                      <th
                        scope="row"
                        className="whitespace-nowrap px-1 font-mono text-[11px] font-normal text-dim"
                      >
                        {iteration.n}
                      </th>
                      {STEPS.map((step) => (
                        <td key={step} className="px-1">
                          <Pill step={iteration[step]} />
                        </td>
                      ))}
                      {/* Fixed columns, right-aligned, tabular figures. The vertical read
                          down these two is the figure's whole argument, and a proportional
                          digit or a column that sizes to its content breaks it. */}
                      <td className="w-[44px] px-1 text-right font-mono text-[13px] tabular-nums text-fg">
                        {iteration.score}
                      </td>
                      <td
                        className={cx(
                          "w-[40px] px-1 text-right font-mono text-[12px] tabular-nums",
                          iteration.delta === undefined
                            ? "text-dim"
                            : iteration.delta.gain
                              ? "text-emerald"
                              : "text-signal",
                        )}
                      >
                        {iteration.delta?.text ?? "base"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Sheet>
            {/* The qualifier, beside the thing it qualifies. `honesty.test.ts` holds it:
                DarkPrint does not run anybody's graph, so these numbers are a worked example
                and a figure shaped like a readout has to say so where it is read. */}
            <p className="label text-amber">
              illustrative: DarkPrint does not run your graph
            </p>
            <figcaption className="text-sm leading-relaxed text-muted">
              Four runs of one blueprint. Swap a step for a new version, or take a step out:
              the rest is byte-identical, so each move owns its delta. Iteration 3 dropped{" "}
              <span className="font-mono text-[13px] text-fg">rank</span> and lost 0.05,
              which is why it stays in, because a negative result is attributable too.
            </figcaption>
          </figure>
        </div>

        <BeatCaption href="/what-a-blueprint-is#run" cta="What surrounds a run">
          A harness can only tell you what a change did if everything else held still.
          Pinning the steps is what buys that: you can test one step on its own, replace it,
          or remove it, and read the score afterwards knowing the difference belongs to the
          thing you moved.
        </BeatCaption>
      </div>
    </section>
  );
}
