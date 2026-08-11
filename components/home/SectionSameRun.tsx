import { Fragment } from "react";

import { SectionHeading } from "@/components/ui/SectionHeading";
import {
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

   The endpoints are bare discs and the routes are raw paths, so this panel uses neither
   `FlowNode` nor `FlowEdge`. Both were in the hand-off's reuse list and both are off it by
   the author's decision, twice given: the register's node is a lit core inside a ring inside
   three halo shells, a glyph whose whole job is to say something happens here, and nothing
   happens at the end of an improvised run. A run stops there. What a reader is meant to
   read is the number beside it, so the mark is the smallest thing that can hold a position,
   which is what the mock draws and why. `FlowEdge` goes for a narrower reason recorded at
   the call site: its base line carries no `pathLength`, and without one there is no way to
   draw a curve on. The geometry still comes from `flowRun`, so what is given up is the
   component and not the arithmetic.

   ── The routes draw themselves, on the mock's loop ──
   Each run strokes on over the first quarter of a 7.2s cycle, its ending and score arrive a
   beat behind it, the three hold together, and the set clears and begins again, with the
   runs entered 0.8s apart. That is `dpRun` and `dpHold` out of the mock, and it is here
   because the author asked for the mock's behaviour rather than for an entrance.

   It is worth being exact about why this does not cost what a reveal usually costs. The
   rule lives inside `prefers-reduced-motion: no-preference`, and nothing on the elements
   themselves is a `from` state: the path's `stroke-dashoffset` rests at 0, which is a whole
   curve, and the group's opacity rests at 1. So the server's markup is the finished figure,
   and so is what a reader with no JavaScript sees, and so is what a reader who asked for
   less motion sees. The loop plays over a complete drawing or it does not play. That is the
   line spec §0 actually draws — animation may only move what is already there — and a
   loop satisfies it exactly as well as a one-shot does, which the earlier fade did not
   need to be replaced to prove.

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
 * the mock's number. It is a spacing decision and no longer a clipping one: the scores are
 * set beside their endpoints rather than under them, so the lowest of them is centred on
 * y=180 and reaches about 188 at `SCORE_SIZE`, which clears either frame comfortably and
 * leaves `components/viz/scene-labels.test.ts` nothing to catch at 210 either.
 *
 * What it decides now is how much of the left sheet is drawing. The scene is `w-full` at a
 * declared ratio, so the height follows the column: at 1440 the left body is 480.79px wide
 * and 236 makes the drawing 283.7px tall against 210's 252.4. Both sheets are stretched to
 * the same height by the subgrid row regardless, so the 34px is not a height saved, it is
 * 34px of blank sheet that would otherwise open between the drawing and the title block.
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
 * sense and the three endings are positions. `FlowEdge` is handed this as its `toRadius`, so
 * the curve stops off the dot rather than under it.
 */
const DOT_R = 5;

/**
 * The route's weight and opacity, both read off the mock and neither off `FLOW.edge`.
 *
 * `FLOW.edge.line` is 1.1 at `lineOpacity` 0.42, and that pair is calibrated for an edge
 * whose subject is the pulse travelling it: the curve is structure, the light is the point,
 * so the curve gets out of the way. These three routes carry no pulse and no arrowhead. The
 * curve IS the subject — the whole panel is three lines going three different places — and
 * at the register's default they paint as grey hints of themselves.
 *
 * 1.8 is the mock's number. The opacity is not: the mock strokes `#4a5170` flat, which is
 * not a token this theme has, and `--color-faint` is both darker than it and annotated in
 * `globals.css` as decorative-only. So the tone stays `dim` and the opacity is what puts
 * `--color-dim` on the mock's colour over this sheet — `#828aa3` at 0.55 over the blueprint
 * surface resolves within a couple of points of `#4a5170` per channel. Reproducing the
 * drawing rather than the hex is the whole reason this file has tokens in it.
 */
const ROUTE_WEIGHT = 1.8;
const ROUTE_OPACITY = 0.55;

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
const IMPROVISED: readonly { end: Point; score: string; bend: number }[] = [
  { end: [288, 58], score: "0.62", bend: -14 },
  { end: [288, 118], score: "0.81", bend: 0 },
  { end: [288, 180], score: "0.55", bend: 12 },
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
 * The ledger's column heads.
 *
 * `.label` is 11px at 0.18em and this is 10 at 0.16, which is the mock's own step down: four
 * heads over a four-row table are a legend rather than a section label, and at `.label`'s
 * size they compete with the 13px cell text under them. The colour does not move — the tier
 * exists at `--color-dim` because a head is meaning-bearing, and this keeps that.
 */
const HEAD =
  "py-2.5 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-dim";

/**
 * One step of the route, 128 by 42, which is the mock's own box and not `VIZ.node`'s.
 *
 * Worth saying which, because the two are close enough to be mistaken for each other and
 * they are not the same: `VIZ.node` is 132 by 46, a ratio of 2.87, and this is 3.05. The
 * node token sizes a `NodeBox` inside a scene's coordinate space, where it is measured
 * against edges and radii in the same units. These three are HTML boxes in a row on a
 * sheet, sized against the sheet's body rather than against a viewBox, and 128 is what
 * makes three of them plus two arrows land at 444 — see the breakpoint arithmetic above,
 * which that number is load-bearing for. The border is `VIZ.stroke.base` and the radius
 * `VIZ.node.radius`, so the drawing weight is still the register's.
 *
 * One treatment now, where there were three. The pill was drawn twelve times, once per step
 * per iteration, so it needed a pinned version, an amber changed version and a dashed hole
 * for a removed one. The route is stated once above the ledger and the ledger says what
 * moved in words, so the only pill left is the pinned one and the other two branches are
 * deleted rather than kept for a caller that no longer exists.
 *
 * `box-sizing` is `border-box` from preflight, which is what the mock sets on these
 * explicitly, so the three pills are the same box: a border that grew the element would make
 * the route's three steps three different widths for no reason a reader could name.
 */
const PILL = { width: 128, height: 42 } as const;

function Pill({ label }: { label: string }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center border border-blueprint-line text-center font-mono text-[13px] text-blueprint-ink"
      style={{
        width: PILL.width,
        height: PILL.height,
        borderWidth: VIZ.stroke.base,
        borderRadius: VIZ.node.radius,
        background: VIZ_KNOCKOUT,
      }}
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
const ARROW = { width: 30, height: 10 } as const;

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
      <line
        x1={0}
        y1={midY}
        x2={back}
        y2={midY}
        stroke={VIZ_LINE}
        strokeWidth={VIZ.stroke.base}
        opacity={FLOW.edge.arrowOpacity}
      />
      <path
        d={`M${back} ${midY - VIZ.arrow.spread}L${tip} ${midY}L${back} ${midY + VIZ.arrow.spread}`}
        stroke={VIZ_LINE}
        strokeWidth={VIZ.stroke.base}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={FLOW.edge.arrowOpacity}
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
    /* Stacked, not spread. The two were on one line with the rail pushed to the right edge,
       which put the panel's name and the sentence telling you how to read it at opposite
       ends of a 560px row with nothing between them: at that distance they read as two
       unrelated labels rather than as a title and its subtitle. Under it, left-aligned, the
       rail is the second line of one heading. */
    <figcaption className="flex flex-col gap-1">
      <span className="label-lead">{title}</span>
      <span className="text-sm leading-snug text-muted">{rail}</span>
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
            route block is three 128px pills and two 30px arrows, so 444px flat; the ledger's
            own min-content measures 236px, which means the route is what the panel has to
            fit and the ledger never binds.

            At `lg`, worst case, a 1024px viewport with a classic scrollbar: 1013px reaches
            `container-page`, whose `padding-inline: 1.5rem` leaves 965px of content. The
            columns are `1fr 1.15fr` over a 28px gap, so 937px splits 435.81 / 501.18. The
            right sheet spends 1px of border each side and `px-6` on its body, and 501.18
            less 2 less 48 is 451.18px for the route to stand in. 451.18 against 444 is
            7.18px of slack. On a platform with overlay scrollbars the same viewport gives
            976px of content and 457.07px of body, so 13.07px. Measured, both.

            Seven pixels is thin and it is the number that matters, because it is the one
            that goes negative first: a fourth step in the route, or a pill past 130px, and
            this comes back to `xl`. From 1240px up `container-page` is capped at 1200 and
            the body settles at 551.20px, which is 107px of slack, so 1280 and 1440 are not
            where the risk is. Below `lg` the grid is one column and the route has the full
            width of the page.

            ── Equal heights, by subgrid ──
            Three rows shared by both figures: the panel head, the sheet, the caption block.
            The sheet's row is `1fr`, so the two sheets are the same height whichever has
            more in it, and the heads and the captions sit on the same lines across the
            gap rather than each column packing its own way. That needs the two figures to
            have the same number of children, which is why the amber qualifier and the
            right-hand caption are wrapped as one cell: they are one block of text under one
            sheet, and the alternative is a fourth row that the left column would have to
            leave empty.

            A stretched sheet then has to be told where the surplus goes, which is why
            `Sheet` is a flex column with `mt-auto` on its title block. The left sheet is the
            shorter of the two by its own content and this row makes it match, so without
            that the strip sat 70px off the bottom edge at 1440 and 121px at 1024, with the
            frame continuing under it. The slack belongs between the drawing and the strip.
            The mock does the same thing and says so in the one declaration it spends on it,
            `margin: auto -20px 0`. */}
        <div className="mt-12 grid gap-7 lg:grid-cols-[1fr_1.15fr] lg:grid-rows-[auto_1fr_auto] lg:gap-y-3.5">
          {/* ---------- three runs, three sets of steps ---------- */}
          <figure className="flex min-w-0 flex-col gap-3 lg:row-span-3 lg:grid lg:grid-rows-subgrid">
            <PanelHead title="from a prompt" rail="you do not control the path" />
            <Sheet
              /* `--color-line`, not the blueprint register's own frame. Both panels are
                 drawn on the same paper and only one of them is a blueprint: putting the
                 site's word for a specification around the figure that says there isn't one
                 was the last thing making these two read as a matched pair when they are
                 supposed to read as a contrast. */
              border="var(--color-line)"
              title={
                /* Grey, not the sheet's ink. `Sheet` sets `color` to the register's ink on
                   the whole element, which would put this strip in blueprint ink under a
                   frame that deliberately is not blueprint. The mock reads `--color-dim`
                   here and it is the same argument the border is making: this panel is the
                   one without a specification, so it does not get spoken about in the
                   colour the specification is drawn in. */
                <span className="text-dim">same prompt · three routes · nothing to credit</span>
              }
              /* `pb-3.5` is the mock's 14px under the drawing. It is invisible while this
                 sheet is the shorter of the two and the subgrid is feeding it 70px of slack
                 anyway, and it is the difference between a drawing that sits on the title
                 block and one that clears it the day the left panel is the taller one. */
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
                     paths start at x=64 against this arithmetic's 68; four units in a
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
                          A raw `<path>` and not `FlowEdge`, and the reason is one
                          attribute: `pathLength="1"` puts the dasharray in normalised
                          space, so `1` is one dash exactly as long as the curve and the
                          offset animating 1 to 0 draws it. `FlowEdge` will not carry that
                          on its base line — the attribute is on its pulse, because the two
                          paths exist precisely so a dasharray can mean different things on
                          each — so the choice is this or no draw. `stroke-dashoffset`
                          initialises to 0, which makes the resting path the finished one;
                          `globals.css` holds the rest of that argument.

                          No pulse and no arrowhead, which is why losing `FlowEdge` costs
                          this panel nothing. A travelling light says "this is the path" and
                          an arrow says "and it goes this way", and the panel's claim is
                          that nobody chose either. */}
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
                           time the keyframes are running and the routes would paint
                           brighter while drawing than they do at rest — a flicker on every
                           cycle, and invisible to every test in the suite. The two
                           properties multiply, so the tone lives on one and the animation
                           on the other. */
                        strokeOpacity={ROUTE_OPACITY}
                        fill="none"
                      />
                      {/* The ending and its score, held together because they arrive
                          together and mean nothing apart: a dot with no number is a place
                          nobody asked about, and a number with no dot is not attached to a
                          run. The mock groups them for the same reason and gives the pair
                          its own keyframes, a beat behind the route that reaches them. */}
                      <g
                        className="anim-route-hold"
                        style={{ "--run": i } as React.CSSProperties}
                      >
                        {/* A flat disc, not a `FlowNode`. `FlowNode` draws a lit core inside
                            a ring inside three halo shells, a glyph that says "something
                            happens here". Nothing happens at these points. They are where
                            three runs stopped, and what a reader is meant to read is the
                            number beside them, so the mark is the smallest thing that can
                            hold a position. The mock draws `<circle r="5">` and it is
                            right. */}
                        <circle cx={run.end[0]} cy={run.end[1]} r={DOT_R} fill={VIZ_TONE.dim} />
                        <text
                          data-viz="label"
                          x={run.end[0] + DOT_R + FLOW.label.gap - 2}
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
                    one ring, which is `FlowNode`'s schematic mark with the halo shells left
                    off: this node IS a place where something happens, so it keeps the ring
                    the endpoints do not get, and the shells are light the panel does not
                    need to spend on the one thing every run shares. */}
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
                {/* "goal" above the node rather than through `FlowNode`'s own `label`, which
                    sets it underneath. Under is right for a node in a chain, where the space
                    below is empty; here the space below the goal is where the bottom run
                    leaves, and a caption sitting in it reads as that run's label. Every
                    `<text>` in a scene is measured by `components/viz/label-boxes.ts`
                    whoever wrote it, so this is held to the same collision and clipping
                    rules as a label the component draws. */}
                <text
                  data-viz="label"
                  x={GOAL[0]}
                  y={GOAL[1] - ringRadius(FLOW.node.r) - FLOW.label.gap + 5}
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
          <figure className="flex min-w-0 flex-col gap-3 lg:row-span-3 lg:grid lg:grid-rows-subgrid">
            <PanelHead title="from a blueprint" rail="you define the steps, then tune them" />
            <Sheet
              /* The sheet's own drawing colour, where the left strip is grey. The two are
                 not the same kind of remark: the left one names what an unspecified panel
                 shows and is reported in the neutral tone that panel is drawn in, and this
                 one states the property the ledger above it depends on, which is the same
                 claim the line under the route makes and gets the same colour for it. Both
                 values are the mock's. */
              title={
                <span className="text-blueprint-line">
                  one step changed per iteration · everything else held
                </span>
              }
              bodyClassName="relative overflow-x-auto px-6 pt-6"
            >
              {/* ---------- the route, once ----------
                  Eleven of the old table's twelve pills existed to say "these did not
                  change". Stating the route once and then listing what moved is the same
                  information with the repetition taken out, and it puts the thing a reader
                  is meant to read — the tuning — in a block of its own. */}
              <div className="flex flex-col items-center gap-3.5 pb-[22px]">
                <div className="flex items-center gap-0">
                  {STEPS.map((step, i) => (
                    <Fragment key={step}>
                      {i > 0 && <RouteArrow />}
                      <Pill label={step} />
                    </Fragment>
                  ))}
                </div>
                {/* Not `.label`, and the class was wrong here rather than merely different.
                    `.label` heads a column or tags a value, so it uppercases at 0.18em; this
                    is a sentence, and a sentence in caps at that tracking is a sign rather
                    than a remark. The mock sets 11px at 0.06em in the sheet's own drawing
                    colour, which is exactly `Sheet`'s title strip, and that is the right
                    register for it: the strip along the bottom names what the sheet shows
                    and this names what the three boxes above it ARE. Two remarks on one
                    sheet, in one voice.

                    `--color-blueprint-line` and not `--color-cyan`. Cyan is the site's
                    interactive colour and nothing here is interactive; inside a blueprint
                    sheet the line that draws the drawing is the colour a remark about the
                    drawing gets. */}
                <p className="font-mono text-[11px] tracking-[0.06em] text-blueprint-line">
                  this route runs every time, in this order
                </p>
              </div>

              {/* A rule across the whole sheet, not across the table. The route above and
                  the ledger below are two blocks rather than a heading and its content, and
                  a rule inset by the body's own padding reads as a table border with a
                  paragraph sitting on top of it. `-mx-4` is that padding, spent back. */}
              <div className="-mx-6 border-t" style={{ borderColor: RULE }} />

              {/* ---------- the ledger ----------
                  Still a table, and for the reason it always was: four scores and three
                  deltas read DOWN, and a grid of related values with headers on both axes is
                  what a table is. `scope` on both, so a reader arriving on a cell is told
                  which iteration and which column it belongs to.

                  Rules rather than gaps between the rows. `border-collapse` with a hairline
                  of `--color-blueprint-line` at 15% is the drafting sheet's own ruling, and
                  it does what the old `border-spacing` could not: it lines the four scores up
                  under a header that is attached to them. */}
              <table className="mt-1.5 mb-4 w-full border-collapse text-left">
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
                    <th scope="col" className={HEAD}>
                      iter
                    </th>
                    <th scope="col" className={HEAD}>
                      what changed
                    </th>
                    <th scope="col" className={cx(HEAD, "text-right")}>
                      score
                    </th>
                    <th scope="col" className={cx(HEAD, "text-right")}>
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
                        className="whitespace-nowrap py-[13px] pr-4 font-mono text-[12px] font-normal text-dim"
                      >
                        {iteration.n}
                      </th>
                      {/* The step is the subject of the row and reads at full strength; what
                          happened to it is the predicate and reads under. A cell entirely in
                          one tone would make "rank" and "removed" equally loud, and the
                          column a reader scans is the one naming the steps. */}
                      <td className="py-[13px] pr-4 font-mono text-[13px] text-dim">
                        {iteration.changed === null ? (
                          "baseline"
                        ) : (
                          <>
                            <span className="text-blueprint-ink">{iteration.changed.step}</span>{" "}
                            {"removed" in iteration.changed
                              ? "removed"
                              : `\u2192 ${iteration.changed.to}`}
                          </>
                        )}
                      </td>
                      {/* Fixed columns, right-aligned, tabular figures. The vertical read
                          down these two is the figure's whole argument, and a proportional
                          digit or a column that sizes to its content breaks it. */}
                      <td className="py-[13px] pl-4 text-right font-mono text-[17px] tabular-nums text-fg">
                        {iteration.score}
                      </td>
                      <td
                        className={cx(
                          "w-[64px] py-[13px] pl-4 text-right font-mono text-[12px] tabular-nums",
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
