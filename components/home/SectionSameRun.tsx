import { Fragment } from "react";

import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  FLOW,
  FlowEdge,
  FlowNode,
  FlowScene,
  Sheet,
  VIZ,
  VIZ_KNOCKOUT,
  VIZ_LINE,
} from "@/components/viz";
import { cx } from "@/lib/format";

import { BeatCaption } from "./BeatCaption";

/* ============================================================
   Beat 2: what a score is worth, with and without a specification.

   The author, 2026-08-10:

     "if you start from a prompt or a skill, your experiment is not reproducible. You see
      the agents spawning, but the harness decides how to reach the goal. There is no
      blueprint."

   The argument runs in three moves:

     1. a prompt does not model the steps, so every run is a different run and every score
        it earns is a one-off;
     2. a blueprint fixes the steps, which makes a rerun the same run;
     3. that is what lets you study the system a part at a time and raise the score on
        purpose.

   Move 3 is the point and the other two are what buy it, which is a change of emphasis
   rather than of argument: it used to be the closing caption under two figures that argued
   moves 1 and 2, and it is the title and the lead now. Reproducibility is not the thing a
   reader wants. Being able to improve something on purpose is, and reproducibility is the
   price of admission.

   ── What this beat used to draw, and why the drawing changed ──
   Two panels of routes: three curves on the left, one on the right. The claim was right and
   the figure was not carrying it. The headline promised a comparison of RUNS and each panel
   drew a single graph; the two sides had different amounts of work in them, so the
   comparison was between a busy picture and an empty one; and the colour did the arguing,
   dim against cyan, which is a mood rather than a finding.

   Both panels show runs, and the difference between them is the thing the beat is about.
   Left: three runs of one goal, diverging to three scores that cannot be compared. Right:
   the route stated once, and a ledger of what each change to it was worth. The vertical
   read down the score and delta columns IS the right-hand figure — the whole point is that
   each number belongs to one move — which is why those two sit in fixed columns rather
   than flowing.

   ── What the left panel draws, and what it stopped drawing ──
   Three edges to three scored endpoints, and nothing in between.

   It used to draw two unnamed intermediate nodes per run, and the paragraph here argued
   that they WERE the panel: the steps are not modelled, so there is nothing to label, and
   labelling them would show the reader the thing the panel says does not exist. That
   argument is still true and it was answering the wrong question. Nothing was labelling
   them; the question is whether they need to be drawn at all, and nine nodes and six edges
   is a lot of ink to spend on a negative. What a reader has to see is that three runs of
   one goal end up somewhere different every time, and divergence is carried by the edges
   and the endpoints alone. The nodes were detail in support of an absence.

   The endpoints stay `FlowNode`s rather than the bare circles the mock draws. The mock has
   no access to the component; the register's node is the register's node, and a score
   hanging off a plain dot would be the one glyph on the landing that is not one.

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

/**
 * Scene units, which are viewBox units.
 *
 * 236 tall rather than the 210 this shipped at, which is the hand-off's own alternative and
 * the one the labels decide. `FlowNode` sets a score under its endpoint, not beside it, so
 * the lowest run's label sits about 18 units below y=180; at 210 that lands within a few
 * units of the frame and `components/viz/scene-labels.test.ts` fails a clipped label. 236
 * gives it room, and it is also the closer of the two to the right-hand panel's height.
 */
const SCENE = { width: 400, height: 236 } as const;

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
const GOAL: Point = [56, 118];

/**
 * Three runs of one goal, each ending on its own number.
 *
 * One edge each, and the endpoints are not evenly spaced: 58, 118 and 180 puts the middle
 * run 60 from the first and 62 from the last. Three lanes at an even pitch read as a
 * designed fan, which is the opposite of the claim — nothing chose these shapes, and a
 * drawing where something visibly did would be arguing the other side.
 *
 * The scores are the hand-off's and they are illustrative, which the line under the right
 * panel says in the open.
 */
const IMPROVISED: readonly { end: Point; score: string }[] = [
  { end: [288, 58], score: "0.62" },
  { end: [288, 118], score: "0.81" },
  { end: [288, 180], score: "0.55" },
];

/* --------------------- the right panel --------------------- */

/**
 * What one iteration moved, or `null` for the baseline, which moved nothing.
 *
 * This was three `Step` fields, one per column, and every row spelled out all three so the
 * table could redraw the whole route on each of them. The route is stated once above the
 * ledger now, so a row only has to say what it CHANGED, and the type says that instead of
 * carrying two unchanged versions per row for a reader to diff by eye.
 */
type Change = { step: string; to: string } | { step: string; removed: true };

interface Iteration {
  /** Two digits, as the ledger prints them. */
  n: string;
  changed: Change | null;
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
  { n: "01", changed: null, score: "0.62" },
  {
    n: "02",
    changed: { step: "retrieve", to: "v2" },
    score: "0.71",
    delta: { text: "+0.09", gain: true },
  },
  {
    n: "03",
    changed: { step: "rank", removed: true },
    score: "0.66",
    delta: { text: "−0.05", gain: false },
  },
  {
    n: "04",
    changed: { step: "draft", to: "v2" },
    score: "0.86",
    delta: { text: "+0.15", gain: true },
  },
];

/** The three steps, in the order the graph runs them. */
const STEPS = ["retrieve", "rank", "draft"] as const;

/**
 * The ledger's hairlines: the drafting sheet's own ink, at the alpha a rule wants.
 *
 * A `color-mix` rather than a Tailwind `/15` because it is set through `borderColor` on the
 * row, and a class would have to be spelled out for the scanner in two places (the header
 * row and every body row) for one value that is the same in both.
 */
const RULE = "color-mix(in oklab, var(--color-blueprint-line) 15%, transparent)";

/**
 * One step of the route, at `VIZ.node`'s own 132:46 aspect scaled down to 112 by 39.
 *
 * One treatment now, where there were three. The pill was drawn twelve times, once per step
 * per iteration, so it needed a pinned version, an amber changed version and a dashed hole
 * for a removed one. The route is stated once above the ledger and the ledger says what
 * moved in words, so the only pill left is the pinned one and the other two branches are
 * deleted rather than kept for a caller that no longer exists.
 *
 * `box-sizing` is the default and the border is `VIZ.stroke.base`, so the three pills are
 * the same box: a border that grew the element would make the route's three steps three
 * different widths for no reason a reader could name.
 */
function Pill({ label }: { label: string }) {
  return (
    <span
      className="flex h-[39px] w-[112px] items-center justify-center rounded-sm border border-blueprint-line/55 text-center font-mono text-[12px] text-blueprint-ink"
      style={{ borderWidth: VIZ.stroke.base, background: VIZ_KNOCKOUT }}
    >
      {label}
    </span>
  );
}

/**
 * The arrow between two pills, drawn from `VIZ`'s own arrow and stroke.
 *
 * `FlowEdge` is the register's edge and it cannot be used here: it emits SVG for a
 * `FlowScene`'s coordinate space, and these are three HTML boxes in a row. So this is the
 * same arrowhead the scenes draw, at `VIZ.arrow`'s length and spread and `VIZ.stroke.base`,
 * in `VIZ_LINE` — the geometry comes from the tokens rather than from a shape typed to look
 * about right, which is the part of `FlowEdge` worth carrying across.
 */
const ARROW = { width: 30, height: 12 } as const;

function RouteArrow() {
  const midY = ARROW.height / 2;
  const tip = ARROW.width;
  const back = tip - VIZ.arrow.length;
  return (
    <svg
      aria-hidden
      width={ARROW.width}
      height={ARROW.height}
      viewBox={`0 0 ${ARROW.width} ${ARROW.height}`}
      fill="none"
      className="shrink-0"
    >
      <line x1={0} y1={midY} x2={back} y2={midY} stroke={VIZ_LINE} strokeWidth={VIZ.stroke.base} />
      <path
        d={`M${back} ${midY - VIZ.arrow.spread}L${tip} ${midY}L${back} ${midY + VIZ.arrow.spread}`}
        stroke={VIZ_LINE}
        strokeWidth={VIZ.stroke.base}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
          title="Reproducible runs, improvable steps"
          lead="A prompt lets the harness invent the route, so every run is a different run and every score a one-off. A blueprint fixes the steps, so you can study them one at a time and raise the score on purpose."
          align="center"
          className="mx-auto"
        />

        {/* `lg`, and the arithmetic is new because the right panel is.
            ------------------------------------------------------------
            It said `xl`, and the measurement it gave was honest for the figure it was
            written against: the old table was 530px of pills and columns, two columns of a
            1152px container leave each sheet 532px of body, and that fits at `xl` by two
            pixels and not at `lg`.

            The 4a panel is narrower and the widest thing in it is no longer the table. The
            route block is three 112px pills and two 30px arrows, 396px; the ledger's own
            min-content is 271px, so the panel's minimum is 396px. At `lg` a 1024px viewport
            gives `container-page` 976px of content, two columns with a 24px gap give each
            476px, and `Sheet`'s `p-4` leaves 444px of body. Measured: 442, the two pixels
            being the grid resolving a half. 442 against 396 is 46px of slack, so the split
            can come down a breakpoint and the figure never has to be dragged sideways.

            ── Equal heights, by subgrid ──
            Three rows shared by both figures: the panel head, the sheet, the caption block.
            The sheet's row is `1fr`, so the two sheets are the same height whichever has
            more in it, and the heads and the captions sit on the same lines across the
            gap rather than each column packing its own way. That needs the two figures to
            have the same number of children, which is why the amber qualifier and the
            right-hand caption are wrapped as one cell: they are one block of text under one
            sheet, and the alternative is a fourth row that the left column would have to
            leave empty. */}
        <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr_auto] lg:gap-y-3">
          {/* ---------- three runs, three sets of steps ---------- */}
          <figure className="flex min-w-0 flex-col gap-3 lg:row-span-3 lg:grid lg:grid-rows-subgrid">
            <PanelHead title="from a prompt" rail="you do not control the path" />
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
                {IMPROVISED.map((run) => (
                  <Fragment key={run.score}>
                    {/* No pulse. A travelling light says "this is the path", and the panel's
                        claim is that there is no path anybody chose. `FlowEdge` trims both
                        ends off the node radius plus `FLOW.edge.gap` itself, so neither
                        endpoint is typed here. */}
                    <FlowEdge from={GOAL} to={run.end} tone="dim" pulse={false} />
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
                ))}
              </FlowScene>
            </Sheet>
            <figcaption className="text-sm leading-relaxed text-muted">
              The harness picks the steps, and picks differently each time. Three scores, and
              no two of them are measuring the same thing.
            </figcaption>
          </figure>

          {/* ---------- four runs, one step touched each ---------- */}
          <figure className="flex min-w-0 flex-col gap-3 lg:row-span-3 lg:grid lg:grid-rows-subgrid">
            <PanelHead title="from a blueprint" rail="you define the steps, then tune them" />
            <Sheet bodyClassName="relative overflow-x-auto p-4">
              {/* ---------- the route, once ----------
                  Eleven of the old table's twelve pills existed to say "these did not
                  change". Stating the route once and then listing what moved is the same
                  information with the repetition taken out, and it puts the thing a reader
                  is meant to read — the tuning — in a block of its own. */}
              <div className="flex flex-col items-center gap-2 pb-4">
                <div className="flex items-center gap-0">
                  {STEPS.map((step, i) => (
                    <Fragment key={step}>
                      {i > 0 && <RouteArrow />}
                      <Pill label={step} />
                    </Fragment>
                  ))}
                </div>
                {/* Cyan, which is this site's interactive colour everywhere else, and the
                    one place it is spent on a statement instead: the sentence is what makes
                    the three boxes above it a ROUTE rather than three named things, and it
                    is the claim the whole right panel rests on. */}
                <p className="label text-cyan">this route runs every time, in this order</p>
              </div>

              {/* ---------- the ledger ----------
                  Still a table, and for the reason it always was: four scores and three
                  deltas read DOWN, and a grid of related values with headers on both axes is
                  what a table is. `scope` on both, so a reader arriving on a cell is told
                  which iteration and which column it belongs to.

                  Rules rather than gaps between the rows. `border-collapse` with a hairline
                  of `--color-blueprint-line` at 15% is the drafting sheet's own ruling, and
                  it does what the old `border-spacing` could not: it lines the four scores up
                  under a header that is attached to them. */}
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Four runs of one blueprint, numbered 01 to 04. Each row names the one step
                  it changed and reports the score and the change from the run before it.
                </caption>
                <thead>
                  {/* `.label` is `--color-dim`, which is the floor these four have to clear.
                      They are meaning-bearing — a column of numbers with a faint header is a
                      column of numbers — and `--color-faint` is annotated in `globals.css`
                      as decorative separators only, never live text. */}
                  <tr className="border-b" style={{ borderColor: RULE }}>
                    <th scope="col" className="label py-2 pr-3 font-normal">
                      iter
                    </th>
                    <th scope="col" className="label py-2 pr-3 font-normal">
                      what changed
                    </th>
                    <th scope="col" className="label py-2 pl-3 text-right font-normal">
                      score
                    </th>
                    <th scope="col" className="label py-2 pl-3 text-right font-normal">
                      delta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ITERATIONS.map((iteration) => (
                    <tr
                      key={iteration.n}
                      className="border-b last:border-b-0"
                      style={{ borderColor: RULE }}
                    >
                      <th
                        scope="row"
                        className="whitespace-nowrap py-2.5 pr-3 font-mono text-[11px] font-normal text-dim"
                      >
                        {iteration.n}
                      </th>
                      {/* The step is the subject of the row and reads at full strength; what
                          happened to it is the predicate and reads under. A cell entirely in
                          one tone would make "rank" and "removed" equally loud, and the
                          column a reader scans is the one naming the steps. */}
                      <td className="py-2.5 pr-3 font-mono text-[12px] text-dim">
                        {iteration.changed === null ? (
                          "baseline"
                        ) : (
                          <>
                            <span className="text-fg">{iteration.changed.step}</span>{" "}
                            {"removed" in iteration.changed
                              ? "removed"
                              : `\u2192 ${iteration.changed.to}`}
                          </>
                        )}
                      </td>
                      {/* Fixed columns, right-aligned, tabular figures. The vertical read
                          down these two is the figure's whole argument, and a proportional
                          digit or a column that sizes to its content breaks it. */}
                      <td className="w-[52px] py-2.5 pl-3 text-right font-mono text-[14px] tabular-nums text-fg">
                        {iteration.score}
                      </td>
                      <td
                        className={cx(
                          "w-[52px] py-2.5 pl-3 text-right font-mono text-[12px] tabular-nums",
                          iteration.delta === undefined
                            ? "text-faint"
                            : iteration.delta.gain
                              ? "text-emerald"
                              : "text-signal",
                        )}
                      >
                        {/* The baseline has no delta, and the em dash saying so is a
                            typographic placeholder rather than a value. `aria-hidden` keeps
                            it out of the cell's announcement, which is then correctly empty,
                            and it is the one run of `--color-faint` this beat is allowed:
                            the token is decorative-only and this is decoration. */}
                        {iteration.delta === undefined ? (
                          <span aria-hidden>&mdash;</span>
                        ) : (
                          iteration.delta.text
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Sheet>
            <div className="flex flex-col gap-3">
            {/* The qualifier, beside the thing it qualifies. `honesty.test.ts` holds it:
                DarkPrint does not run anybody's graph, so these numbers are a worked example
                and a figure shaped like a readout has to say so where it is read. */}
            <p className="label text-amber">
              illustrative: DarkPrint does not run your graph
            </p>
            {/* The negative result is no longer explained here. It is in the ledger, which
                is where it reads: a row that loses 0.05 beside three that gain says what a
                sentence about it would say, and says it in the column a reader is already
                comparing down. The docblock keeps the reason that row exists at all. */}
            <figcaption className="text-sm leading-relaxed text-muted">
              The steps are yours, so a rerun is the same run. Change one, read the score, and
              the difference belongs to the thing you moved.
            </figcaption>
            </div>
          </figure>
        </div>

        <BeatCaption href="/what-a-blueprint-is#run" cta="What surrounds a run">
          That is what reproducibility buys: a system you can study a part at a time, and
          improve on purpose rather than by luck.
        </BeatCaption>
      </div>
    </section>
  );
}
