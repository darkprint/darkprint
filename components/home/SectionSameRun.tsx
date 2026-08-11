import { Fragment } from "react";

import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  ABSENT_GLYPH,
  FLOW,
  FlowScene,
  Sheet,
  VIZ,
  VIZ_INK,
  VIZ_KNOCKOUT,
  VIZ_LINE,
  VIZ_TONE,
  flowRun,
  ringRadius,
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

   Both panels now show runs, and the difference between them is the thing the beat is
   about. Left: three runs of one goal, diverging to three scores that cannot be compared.
   Right: four runs of one blueprint, one step touched per run, and a column of deltas that
   reads down the page. The vertical read of that column IS the figure — the whole point is
   that each number belongs to one move — which is why the score and the delta sit in fixed
   columns rather than flowing.

   ── What the left panel draws, and what it stopped drawing ──
   Three edges to three scored endpoints, and nothing in between.

   It used to draw two unnamed intermediate nodes per run, and the paragraph here argued
   that they WERE the panel: the steps are not modelled, so there is nothing to label, and
   a drawing that labelled them would show the reader the thing the panel says does not
   exist. That argument is still true and it was answering the wrong question. Nothing was
   proposing to label them; the question is whether they need to be DRAWN, and nine nodes
   and six edges is a lot of ink to spend on a negative. What a reader has to see is that
   three runs of one goal end up somewhere different every time, and that divergence is
   carried by the edges and the endpoints alone. The nodes were detail in support of an
   absence.

   ── This panel draws neither `FlowNode` nor `FlowEdge`, and that is a decision ──
   Both were on the hand-off's reuse list, this file was built against them once, and the
   author's verdict on seeing it was that where the mock and the register disagree the mock
   wins. Recorded here rather than left as a silence, because a reader who knows this
   codebase will reach for the two components on sight.

   The two are closed to every property the mock varies. `FlowEdge` strokes at
   `FLOW.edge.line`'s 1.1 and `FLOW.edge.lineOpacity`'s 0.42, both literals in its body, and
   that pair is calibrated for an edge whose subject is the pulse travelling it: the curve is
   structure, the light is the point, so the curve gets out of the way. These three carry no
   pulse and no arrowhead. The curve IS the subject — the whole panel is three lines going
   three different places — and at the register's default they paint as grey hints of
   themselves. `FlowNode` draws five circles where the mock draws one: a halo shell, a lit
   core, a ring, a focus ring and a hit target, out to 12.4 units against a 5-unit dot. That
   glyph's whole job is to say something happens here, and nothing happens at the end of an
   improvised run. A run stops there. What a reader is meant to read is the number beside it,
   so the mark is the smallest thing that can hold a position.

   The label is the third and it is the one no prop could have fixed: `FlowNode` writes its
   label under the node, centred, at `FLOW.label.size` and in the sheet's ink. The scores go
   beside their endpoints, at 17, in `--color-muted`, because they are the panel's payload
   and not captions on dots; "goal" goes above its node, because the space under THIS node is
   where the bottom run leaves and a caption sitting in it reads as that run's label. Four
   mismatches, no props.

   What is NOT given up is the arithmetic. Every position still comes from `flowRun`, which
   is what `FlowEdge` itself calls, so the runs leave and arrive at `ringRadius(r) + gap` and
   nothing here writes a trimmed coordinate down. Every `<text>` still carries
   `data-viz="label"`, so `components/viz/label-boxes.ts` measures these exactly as it
   measures a label the component drew.

   ── The routes draw themselves, on the mock's loop ──
   Each run strokes on over the first quarter of a 7.2s cycle, its ending and score arrive a
   beat behind it, the three hold together, and the set clears and begins again, with the
   runs entered 0.8s apart. That is `dpRun` and `dpHold` out of the mock, and it is here
   because the author asked for the mock's behaviour rather than for an entrance.

   Spec §0 says animation may only move what is already there, and this is worth being exact
   about, because the rule is usually what forbids a draw-on. The keyframes live inside
   `prefers-reduced-motion: no-preference`, and nothing on the elements themselves is a
   `from` state: the path's `stroke-dashoffset` rests at 0, which is a whole curve, and the
   group's opacity rests at 1. So the server's markup is the finished figure, and so is what
   a reader with no JavaScript sees, and so is what a reader who asked for less motion sees.
   The loop plays over a complete drawing or it does not play, which is the line spec §0
   actually draws, and a loop satisfies it exactly as well as a one-shot does.

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

   ── The pause dash, which this copy no longer has to be edited for ──
   `components/home` is in `workspace.test.ts`'s `COPY_TREES`, the rule that keeps the pause
   dash off the rendered site. The previous hand-off wrote the lead and the right-hand
   caption with one and both shipped as a comma; this one is written with commas already, so
   there is nothing to edit. The rule still binds whatever is written here next.
   ============================================================ */

/* --------------------- the left panel --------------------- */

/**
 * Scene units, which are viewBox units.
 *
 * 236 rather than the 210 this shipped at. The hand-off offers both and gives the criterion
 * — whichever keeps the two panels' heights closest — and the clipping is what decides it
 * first. The scores are `FlowNode` labels, so each sits `labelOffset(FLOW.node.r)` below its
 * endpoint, which is `ringRadius(7) + FLOW.label.gap` and so 26.9 units. The lowest endpoint
 * is at y=180, which puts a baseline at 206.9 and leaves three units of sheet under it.
 * `components/viz/scene-labels.test.ts` passes that at 210, because its bottom rule measures
 * the baseline rather than the ink below it, and a number set three units off the edge still
 * draws as a figure that ran out of paper.
 *
 * 236 also spends the difference on the drawing rather than on blank sheet: the scene is
 * `w-full` at a declared ratio, so the same column draws it 12% taller.
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
 * The score's type size in scene units, against `FLOW.label.size`'s 13 for the goal.
 *
 * The two are not the same kind of text. "goal" is a caption on a node, which is what
 * `FLOW.label.size` is calibrated for; the three scores are the panel's payload, and the
 * whole claim is that they are different from each other and cannot be compared. Set at a
 * caption's size they read as annotations on dots. It clears `FLOW.frame.legible`, the
 * 10-unit floor this scene's own frame publishes, by a wide margin.
 */
const SCORE_SIZE = 17;

/**
 * The endpoint dot, against `FLOW.node.r`'s 7 for the goal.
 *
 * Smaller on purpose and not only to match the mock: the goal is a node in the register's
 * sense and the three endings are positions. It is also what `flowRun` is handed as its
 * `toRadius`, so the curve stops off the dot rather than under it.
 */
const DOT_R = 5;

/**
 * The route's weight and opacity, both read off the mock and neither off `FLOW.edge`.
 *
 * 1.8 is the mock's number, against `FLOW.edge.line`'s 1.1; the header says why the
 * register's pair is wrong for a curve that is itself the subject. The opacity is not the
 * mock's: it strokes `#4a5170` flat, which is not a token this theme has — `--color-faint`
 * is darker than it and annotated in `globals.css` as decorative-only, `--color-dim` is
 * lighter. So the tone stays `dim` and the opacity is what puts `--color-dim` on the mock's
 * colour over this sheet: `#828aa3` at 0.55 over the blueprint surface resolves within a
 * couple of points of `#4a5170` per channel. Reproducing the drawing rather than the hex is
 * the whole reason this file has tokens in it.
 */
const ROUTE_WEIGHT = 1.8;
const ROUTE_OPACITY = 0.55;

/**
 * How far a label set ABOVE a node drops from the mirrored `labelOffset`, as a fraction of
 * its own type size.
 *
 * `labelOffset` is `ringRadius(r) + FLOW.label.gap` and it measures ring to BASELINE, which
 * is calibrated for a label under a node: the ink then starts a cap-height below that line
 * and clears the ring by about 5 units. Mirrored above the node the same offset still lands
 * a baseline, but the ink now hangs below it rather than above, so the word floats twelve
 * units off the ring — twice the clearance it gets underneath, which reads as a caption
 * belonging to nothing. Dropping it by 0.4 of the type size puts the ink back where the
 * register puts it below, and lands on the mock's own y=96 to within a third of a unit.
 */
const LABEL_ABOVE_DROP = 0.4;

/**
 * Three runs of one goal, each ending on its own number.
 *
 * One edge each, and the endpoints are not evenly spaced: 58, 118 and 180 puts the middle
 * run 60 from the first and 62 from the last. Three lanes at an even pitch read as a
 * designed fan, which is the opposite of the claim — nothing chose these shapes, and a
 * drawing where something visibly did would be arguing the other side.
 *
 * `bend` is `FLOW.edge.bend.gentle`, signed, rather than a number read off the mock.
 * `edgeControl` offsets the control point along the chord's normal, so on a left-to-right
 * run a positive bend bows downwards: the top run takes the negative, the bottom the
 * positive, and the middle one is straight. That the register's own value is the right one
 * is arithmetic and not luck — a quadratic bent by `b` leaves its chord by exactly `b/2` at
 * t=0.5, and the mock's three cubics leave theirs by 9.06, 1.68 and 10.06 units, which is
 * `gentle`'s 18 twice over and a middle run that is straight to within two units.
 *
 * The scores are the hand-off's and they are illustrative, which the line under the right
 * panel says in the open.
 */
const IMPROVISED: readonly { end: Point; score: string; bend: number }[] = [
  { end: [288, 58], score: "0.62", bend: -FLOW.edge.bend.gentle },
  { end: [288, 118], score: "0.81", bend: 0 },
  { end: [288, 180], score: "0.55", bend: FLOW.edge.bend.gentle },
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
    /* Stacked, not spread. The two were on one line with the rail pushed to the right edge,
       which put the panel's name and the sentence telling you how to read it at opposite
       ends of a 500px row with nothing between them: at that distance they read as two
       unrelated labels rather than as a title and its subtitle. Under it, left-aligned, the
       rail is the second line of one heading.

       The rail also stops being `.label`, and that class was wrong here rather than merely
       different. `.label` uppercases at 0.18em, which is what a column head or a tag wants;
       both rails are sentences now, and a sentence in caps at that tracking is a sign rather
       than a remark. The mock sets 14px in `--color-dim`, which is body size in the tone the
       site already reserves for a subtitle. */
    <figcaption className="flex flex-col gap-1">
      <span className="label-lead">{title}</span>
      <span className="text-sm leading-snug text-dim">{rail}</span>
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
            <PanelHead title="from a prompt" rail="you do not control the path" />
            <Sheet
              /* `--color-line`, not the blueprint register's own frame. Both panels are
                 drawn on the same paper and only one of them is a blueprint: putting the
                 site's word for a specification around the figure that says there isn't one
                 was the last thing making these two read as a matched pair when they are
                 supposed to read as a contrast. The mock frames them `#222739` and `#0b2f7a`
                 for that reason, which is this token and the register's own. */
              border="var(--color-line)"
              /* The strip along the bottom edge, which this sheet did not have. It is the
                 mock's own line rather than invented copy, and it names what the drawing
                 shows in the same voice the right sheet will use for what its ledger shows.

                 Grey, not the sheet's ink. `Sheet` sets `color` to the register's ink on the
                 whole element, which would put this strip in blueprint ink; the mock reads
                 `--color-dim` here, and the reason is the one the panel is about. This is
                 the side without a specification, so it does not get spoken about in the
                 colour a specification is drawn in. */
              title={<span className="text-dim">same prompt · three routes · nothing to credit</span>}
              /* `px-5 pt-5 pb-3.5` is the mock's 20/20/14 around the drawing, where `Sheet`
                 would otherwise spend `p-4 sm:p-6`. The 14 under the scene is what keeps the
                 drawing off the title strip. */
              bodyClassName="relative px-5 pt-5 pb-3.5"
            >
              <FlowScene
                width={SCENE.width}
                height={SCENE.height}
                label="One goal run three times from a prompt"
                description="A goal on the left, and three runs that leave it for three different endings, each with a score of its own: 0.62, 0.81 and 0.55."
              >
                {IMPROVISED.map((run, i) => {
                  /* The curve, from the register's own geometry rather than from the mock's
                     typed `d`. `flowRun` is what `FlowEdge` calls, so the run leaves the
                     goal's ring at `ringRadius(r) + FLOW.edge.gap` and stops the same
                     clearance off its endpoint dot, and the one thing this file must never
                     do — write a trimmed coordinate down — stays undone. The mock's own
                     paths start at x=64 against this arithmetic's 72.9; nine units in a
                     400-unit frame is not a difference a reader can see, and a hand-typed
                     endpoint is a number that goes stale the first time a radius moves. */
                  const route = flowRun(GOAL, run.end, {
                    bend: run.bend,
                    fromRadius: FLOW.node.r,
                    toRadius: DOT_R,
                  });
                  return (
                    <Fragment key={run.score}>
                      {/* The route drawing itself, on the mock's loop.
                          ------------------------------------------------------------
                          `pathLength="1"` puts the dasharray in normalised space, so `1` is
                          one dash exactly as long as the curve and an offset animating 1 to
                          0 draws it. `stroke-dashoffset` initialises to 0, which makes the
                          resting path the finished one; `globals.css` holds the rest of that
                          argument.

                          No pulse and no arrowhead. A travelling light says "this is the
                          path" and an arrow says "and it goes this way", and the panel's
                          claim is that nobody chose either. */}
                      <path
                        data-viz="flow-line"
                        className="anim-route-draw"
                        style={{ "--run": i } as React.CSSProperties}
                        d={route.d}
                        pathLength={1}
                        strokeDasharray={1}
                        stroke={VIZ_TONE.dim}
                        strokeWidth={ROUTE_WEIGHT}
                        /* `stroke-opacity` and not `opacity`, and the two are not
                           interchangeable here. `route-draw` animates `opacity` 0 to 1, so
                           an `opacity` of 0.55 on the element would be overridden the whole
                           time the keyframes are running and the routes would paint brighter
                           while drawing than they do at rest — a flicker on every cycle, and
                           invisible to every test in the suite. The two properties multiply,
                           so the tone lives on one and the animation on the other. */
                        strokeOpacity={ROUTE_OPACITY}
                        fill="none"
                      />
                      {/* The ending and its score, held together because they arrive together
                          and mean nothing apart: a dot with no number is a place nobody asked
                          about, and a number with no dot is not attached to a run. The mock
                          groups them for the same reason and gives the pair its own
                          keyframes, a beat behind the route that reaches them. */}
                      <g className="anim-route-hold" style={{ "--run": i } as React.CSSProperties}>
                        {/* A flat disc, not a `FlowNode`. The header argues it: nothing
                            happens at these points, they are where three runs stopped, and
                            what a reader is meant to read is the number beside them. */}
                        <circle cx={run.end[0]} cy={run.end[1]} r={DOT_R} fill={VIZ_TONE.dim} />
                        {/* Beside, not under, and `DOT_R + FLOW.label.gap` off the centre so
                            the gap is the register's rather than a number. `--color-muted`
                            over the dot's `--color-dim`: the score is what the panel is for
                            and the dot only says where it was earned. */}
                        <text
                          data-viz="label"
                          x={run.end[0] + DOT_R + FLOW.label.gap}
                          y={run.end[1]}
                          dominantBaseline="middle"
                          textAnchor="start"
                          fontSize={SCORE_SIZE}
                          fill={VIZ_TONE.muted}
                        >
                          {run.score}
                        </text>
                      </g>
                    </Fragment>
                  );
                })}

                {/* The goal, drawn last so the three curves pass under it. A filled core and
                    one ring, which is `FlowNode`'s schematic mark with the halo left off:
                    this node IS a place where something happens, so it keeps the ring the
                    endpoints do not get, and the halo is light the panel does not need to
                    spend on the one thing every run shares. The mock draws exactly these two
                    circles. */}
                <circle cx={GOAL[0]} cy={GOAL[1]} r={FLOW.node.r} fill={VIZ_LINE} />
                <circle
                  cx={GOAL[0]}
                  cy={GOAL[1]}
                  r={ringRadius(FLOW.node.r)}
                  fill="none"
                  stroke={VIZ_LINE}
                  strokeWidth={FLOW.node.ring}
                  opacity={FLOW.node.ringOpacity}
                />
                {/* "goal" above the node rather than under it, which is the only place
                    `FlowNode` would put it. Under is right for a node in a chain, where the
                    space below is empty; here the space below the goal is where the bottom
                    run leaves, and a caption sitting in it reads as that run's label.
                    `LABEL_ABOVE_DROP` is why this is not simply the mirrored offset. */}
                <text
                  data-viz="label"
                  x={GOAL[0]}
                  y={
                    GOAL[1] -
                    ringRadius(FLOW.node.r) -
                    FLOW.label.gap +
                    FLOW.label.size * LABEL_ABOVE_DROP
                  }
                  textAnchor="middle"
                  fontSize={FLOW.label.size}
                  fill={VIZ_INK}
                >
                  goal
                </text>
              </FlowScene>
            </Sheet>
            <figcaption className="text-sm leading-relaxed text-muted">
              The harness picks the steps, and picks differently each time. Three scores, and
              no two of them are measuring the same thing.
            </figcaption>
          </figure>

          {/* ---------- four runs, one step touched each ---------- */}
          <figure className="flex min-w-0 flex-col gap-3">
            <PanelHead title="from a blueprint" rail="you define the steps, then tune them" />
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
            {/* The negative result is no longer explained here. It is in the table, which
                is where it reads: a row that loses 0.05 beside three that gain says what a
                sentence about it would say, and says it in the column a reader is already
                comparing down. The docblock keeps the reason that row exists at all. */}
            <figcaption className="text-sm leading-relaxed text-muted">
              The steps are yours, so a rerun is the same run. Change one, read the score, and
              the difference belongs to the thing you moved.
            </figcaption>
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
