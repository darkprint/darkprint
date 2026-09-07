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

   Both panels now show runs, and the difference between them is the thing the beat is
   about. Left: three runs of one goal, diverging to three scores that cannot be compared.
   Right: the route stated once, and a ledger of what each change to it was worth. The
   vertical read down the score and delta columns IS the right-hand figure — the whole point
   is that each number belongs to one move — which is why those two sit in fixed columns
   rather than flowing.

   ── What the right panel stopped repeating ──
   The route was drawn on every row: three pills per iteration, twelve in all, of which the
   eleven unchanged ones existed to say "these did not change". That is the route stated four
   times to carry three facts, and the tuning — the thing a reader is actually meant to read —
   was the smallest part of the picture. It is one route block above a rule now, and a row
   says only what it moved.

   `ITERATIONS` collapsed with the drawing rather than keeping its shape. It was a `Step` per
   column and every row spelled out all three; a row is `{ n, changed, score, delta }` now,
   because a type that still carried two unchanged versions per row would be inviting the
   next reader to diff them by eye. `Pill`'s amber and dashed branches went with it, and
   `ABSENT_GLYPH` lost its last importer: it is no longer exported from `components/viz`,
   and it is not deleted, because `FlowAbsence` still draws with it.

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

   ── The qualifier this beat carried, and what its removal costs ──
   An amber line under the right panel read "illustrative: DarkPrint does not run your
   graph". The author asked it off the page on 2026-08-11, having been shown what it was
   pinned to, and it is gone from all three places it lived: this file, `beats.test.ts`, and
   the row in `components/site/honesty.test.ts` — which that file's own header requires to
   come out in the same commit, with the reason, rather than be left passing over an empty
   string.

   The reason it was written is unchanged and is worth keeping here, because nothing on the
   page says it any more. `0.62 → 0.86` is a worked example. DarkPrint runs nobody's graph:
   there is no per-run number anywhere in the product, no runner and no endpoint. That used
   to be stated in the open on `/reading-the-radar`, and the owner asked that page off the
   site on 2026-09-04, so the sentence is not published anywhere a reader can reach it now.
   Recorded rather than quietly dropped, because it changes what this beat is standing on:
   the right panel draws four runs, four scores and three deltas in fixed tabular columns,
   which is the shape of a readout off a real harness, and the two things that used to say
   it is not one were an amber line the author removed and a page the owner removed.

   What still holds the line, and it is weaker than a sentence beside the numbers: the beat
   never uses the word for a graded run, the verb stays `attribute`, the improving is
   something the reader does to their own system, and `beats.test.ts` still fails on `eval`,
   `we measure`, `we score` and `measure if`. A rewrite that promises a measurement is still
   caught. A reader who takes the four scores for readings is not.

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
 * The scores are the hand-off's and they are a worked example. The line that said so under
 * the right panel was removed on 2026-08-11; the header records what went with it.
 */
const IMPROVISED: readonly { end: Point; score: string; bend: number }[] = [
  { end: [288, 58], score: "0.62", bend: -FLOW.edge.bend.gentle },
  { end: [288, 118], score: "0.81", bend: 0 },
  { end: [288, 180], score: "0.55", bend: FLOW.edge.bend.gentle },
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
 * row and every body row) for one value that is the same in both. The mock draws `#16213f`,
 * which is `--color-blueprint-line` at about this alpha over the sheet.
 */
const RULE = "color-mix(in oklab, var(--color-blueprint-line) 15%, transparent)";

/** The score's type size in the ledger, which is the same 17 the left panel spends. */
const SCORE_CELL = 17;

/**
 * The ledger's four tracks, which are the mock's grid translated to a fixed table layout.
 *
 * The mock lays the ledger out as `grid-template-columns: 40px 1fr auto 64px` at
 * `column-gap: 16px`, and a table left to size itself does NOT reproduce that. Auto layout
 * hands surplus width to every column that can take it, so measured against a running build
 * at a 551.2px body: `iter` came out 98.2px against the mock's 40 and pushed `what changed`
 * 42.2px to the right, and the score column's right edge landed at 487.2 where the mock puts
 * it at 471.2. The table was the right element and the wrong geometry.
 *
 * `table-fixed` plus these widths reproduces the grid to the pixel on the two edges that
 * carry the figure — the score column's right edge and the delta column's — and costs the
 * ledger nothing that matters. It is still a `<table>` with `scope` on both axes, an
 * `sr-only` caption and tabular figures, which §3 of the hand-off asks for by name and which
 * the mock's own markup, four `<span>`s per row in a CSS grid, does not have at all.
 *
 * Each track carries its 16px gap as cell padding on ONE side, so a boundary is spent once:
 * `iter` pads right, `what changed` pads neither, `score` and `delta` pad left. The score
 * track is the mock's `auto`, which is four tabular mono figures at `SCORE_CELL` — 0.62em
 * per character is the advance `components/viz/label-boxes.ts` publishes as `ADVANCE`, the
 * top of the range any mono face this site has landed on, so the track is derived from the
 * type rather than measured off a screenshot.
 */
/**
 * The paper both sheets are drawn on, which is not the blueprint register's.
 *
 * `SHEET_REGISTER.blueprint` mixes `--color-blueprint-deep` 62% into the void and lays a
 * graticule and four corner ticks over it. The mock mixes the same two colours at 34% and
 * lays nothing over them: `color-mix(in oklab, #061c52 34%, #05060d)` is what both of its
 * panels are filled with, and those are this theme's `--color-blueprint-deep` and
 * `--color-void` exactly, so the value is the mock's arithmetic on our tokens rather than a
 * colour picked to look near it.
 *
 * The graticule and the ticks go with the lighter fill, through `Sheet`'s `paper` opt-out.
 * They are the two marks that say "a sheet from a set", and neither of these figures is a
 * drawing OF a blueprint: the left is a divergence and the right is a readout. Ruling them
 * like drafting paper was the last thing making the beat look like it was arguing in the
 * blueprint's own voice on both sides of a contrast. Every other `Sheet` on the site keeps
 * its paper — this is a prop these two pass, not a change to the register.
 */
const PAPER = "color-mix(in oklab, var(--color-blueprint-deep) 34%, var(--color-void))";

const LEDGER_GAP = 16;
const LEDGER = {
  iter: 40 + LEDGER_GAP,
  score: Math.ceil(4 * 0.62 * SCORE_CELL) + LEDGER_GAP,
  delta: 64 + LEDGER_GAP,
} as const;

/**
 * The ledger's column heads.
 *
 * `.label` is 11px at 0.18em and this is 10 at 0.16, which is the mock's own step down: four
 * heads over a four-row table are a legend rather than a section label, and at `.label`'s
 * size they compete with the 13px cell text under them. The colour does not move — the tier
 * exists at `--color-dim` because a head is meaning-bearing, and this keeps that. The mock
 * was caught in review at 2.41:1 here; `--color-dim` is the floor these four have to clear
 * and `--color-faint` is annotated in `globals.css` as decorative separators only.
 */
const HEAD =
  "py-2.5 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-dim";

/**
 * One step of the route, 128 by 42, which is the mock's own box and not `VIZ.node`'s.
 *
 * Worth saying which, because the two are close enough to be mistaken for each other and
 * they are not the same: `VIZ.node` is 132 by 46, a ratio of 2.87, and this is 3.05. The
 * node token sizes a `NodeBox` inside a scene's coordinate space, where it is measured
 * against edges and radii in the same units. These three are HTML boxes in a row on a sheet,
 * sized against the sheet's body rather than against a viewBox, and 128 is what makes three
 * of them plus two arrows land at 444 — see the breakpoint arithmetic below, which that
 * number is load-bearing for. The border is `VIZ.stroke.base` and the radius
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
 * `FlowEdge` is the register's edge and it cannot be used here for a reason of kind rather
 * than of taste: it emits SVG into a `FlowScene`'s coordinate space, and these are three
 * HTML boxes in a row on a sheet. So this is the same arrowhead the scenes draw, at
 * `VIZ.arrow`'s length and spread and `VIZ.stroke.base`, in `VIZ_LINE` — the geometry comes
 * from the tokens rather than from a shape typed to look about right, which is the part of
 * `FlowEdge` worth carrying across. 30 by 10 is the mock's box.
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

        {/* `lg`, and the arithmetic is new because the right panel is.
            ------------------------------------------------------------
            It said `xl`, and the measurement it gave was honest for the figure it was
            written against: the old table was 530px of pills and columns, two columns of a
            1152px container leave each sheet 532px of body, and that fits at `xl` by two
            pixels and not at `lg`.

            The 4a panel is narrower and the widest thing in it is no longer the table. The
            route block is three 128px pills and two 30px arrows, so 444px flat, measured at
            1440; the ledger's own min-content is well under that, which means the route is
            what the panel has to fit and the ledger never binds.

            At `lg`, worst case, a 1024px window with a classic scrollbar: 1013px reaches
            `container-page`, whose `padding-inline: 1.5rem` leaves 965px of content. The
            columns are `1fr 1.15fr` over a 28px gap, so 937px splits 435.81 / 501.18. The
            right sheet spends 1px of border each side and `px-6` on its body, and 501.18
            less 2 less 48 is 451.18px for a 444px route to stand in. That is 7.18px of
            slack. On a platform with overlay scrollbars the same window gives a 1024px
            viewport, 976px of content and 457.06px of body, so 13.06px.

            All of it measured rather than derived, in a 1024-wide frame against a running
            build: the scrollbar this was measured behind is 11px, and a 16px one would take
            the first figure to about 4.5px. Seven pixels is thin and it is the number that
            matters, because it is the one that goes negative first: a fourth step in the
            route, or a pill past 130px, and this comes back to `xl`. From 1248px up
            `container-page` is capped at 1200 and the body settles at 551.20px, which is
            107.20px of slack, so 1280 and 1440 measure identically and are not where the
            risk is. At 1023 the grid is one column, the route stands in 914px of body, and
            nothing scrolls sideways at any of the four.

            ── Equal heights, by subgrid ──
            Three rows shared by both figures: the panel head, the sheet, the caption block.
            The sheet's row is `1fr`, so the two sheets are the same height whichever has
            more in it, and the heads and the captions sit on the same lines across the gap
            rather than each column packing its own way. That needs the two figures to have
            the same number of children, which is why the amber qualifier and the right-hand
            caption are wrapped as one cell: they are one block of text under one sheet, and
            the alternative is a fourth row the left column would have to leave empty.

            A stretched sheet then has to be told where the surplus goes, which is why
            `Sheet` is a flex column with `mt-auto` on its title block. The left sheet is the
            shorter of the two by its own content and this row makes it match, so without
            that the strip floats 69.84px off the bottom edge at 1440 with the frame
            continuing under it — measured by zeroing the margin against a running build.
            The slack belongs between the drawing and the strip, which is where it goes: the
            gap under the scene reads 82.84px stretched against `pb-3.5`'s 14 unstretched.
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
                 supposed to read as a contrast. The mock frames them `#222739` and `#0b2f7a`
                 for that reason, which is this token and the register's own. */
              border="var(--color-line)"
              /* No graticule and no corner ticks, on the mock's flatter fill. `PAPER` argues
                 it, and it applies to both panels equally. */
              surface={PAPER}
              paper={false}
              /* The strip along the bottom edge, which this sheet did not have. It is the
                 mock's own line rather than invented copy, and it names what the drawing
                 shows in the same voice the right sheet will use for what its ledger shows.

                 Grey, not the sheet's ink. `Sheet` sets `color` to the register's ink on the
                 whole element, which would put this strip in blueprint ink; the mock reads
                 `--color-dim` here, and the reason is the one the panel is about. This is
                 the side without a specification, so it does not get spoken about in the
                 colour a specification is drawn in. */
              title={<span className="text-dim">same prompt · three routes · no step to credit for the score</span>}
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
          <figure className="flex min-w-0 flex-col gap-3 lg:row-span-3 lg:grid lg:grid-rows-subgrid">
            <PanelHead title="from a blueprint" rail="you define the steps, then tune them" />
            <Sheet
              /* Same paper as the left panel. Only the frame and the strip differ, which is
                 the whole of what separates a blueprint from what a harness did without
                 one. */
              surface={PAPER}
              paper={false}
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
                  paragraph sitting on top of it. `-mx-6` is that padding, spent back, which
                  is the mock's `margin: 22px -24px 0`. */}
              <div className="-mx-6 border-t" style={{ borderColor: RULE }} />

              {/* ---------- the ledger ----------
                  Still a table, and for the reason it always was: four scores and three
                  deltas read DOWN, and a grid of related values with headers on both axes is
                  what a table is. The mock draws it as a CSS grid of `<span>`s, which is the
                  same picture with none of the semantics. `scope` on both axes, so a reader
                  arriving on a cell is told which iteration and which column it belongs to.

                  Rules rather than gaps between the rows. `border-collapse` with a hairline
                  of `--color-blueprint-line` at 15% is the drafting sheet's own ruling, and
                  it does what the old `border-spacing` could not: it lines the four scores up
                  under a header that is attached to them. */}
              <table className="mt-1.5 mb-4 w-full table-fixed border-collapse text-left">
                <caption className="sr-only">
                  Four runs of one blueprint, numbered 01 to 04. Each row names the one step
                  it changed and reports the score and the change from the run before it.
                </caption>
                {/* The mock's `40px 1fr auto 64px`. `LEDGER` says why it is stated rather
                    than left to the table to work out. */}
                <colgroup>
                  <col style={{ width: LEDGER.iter }} />
                  <col />
                  <col style={{ width: LEDGER.score }} />
                  <col style={{ width: LEDGER.delta }} />
                </colgroup>
                <thead>
                  <tr className="border-b" style={{ borderColor: RULE }}>
                    <th scope="col" className={cx(HEAD, "pr-4")}>
                      iter
                    </th>
                    <th scope="col" className={HEAD}>
                      what changed
                    </th>
                    <th scope="col" className={cx(HEAD, "pl-4 text-right")}>
                      score
                    </th>
                    <th scope="col" className={cx(HEAD, "pl-4 text-right")}>
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
                      <td className="py-[13px] font-mono text-[13px] text-dim">
                        {iteration.changed === null ? (
                          "baseline"
                        ) : (
                          <>
                            <span className="text-blueprint-ink">{iteration.changed.step}</span>{" "}
                            {"removed" in iteration.changed
                              ? "removed"
                              : `→ ${iteration.changed.to}`}
                          </>
                        )}
                      </td>
                      {/* Fixed columns, right-aligned, tabular figures. The vertical read
                          down these two is the figure's whole argument, and a proportional
                          digit or a column that sizes to its content breaks it. */}
                      <td
                        className="py-[13px] pl-4 text-right font-mono tabular-nums text-fg"
                        style={{ fontSize: SCORE_CELL }}
                      >
                        {iteration.score}
                      </td>
                      <td
                        className={cx(
                          "py-[13px] pl-4 text-right font-mono text-[12px] tabular-nums",
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
            {/* The amber qualifier stood above this caption and is gone, on the author's
                instruction 2026-08-11. The header records what it said and what its removal
                costs; this is the note for anyone wondering why the two columns still line
                up without it. The subgrid row gives each figure three children, and this one
                still has three — the wrapper that held the qualifier and the caption together
                is gone with it, and the caption is the third child on its own. */}
            {/* The negative result is no longer explained here. It is in the ledger, which
                is where it reads: a row that loses 0.05 beside three that gain says what a
                sentence about it would say, and says it in the column a reader is already
                comparing down. The docblock keeps the reason that row exists at all. */}
            <figcaption className="text-sm leading-relaxed text-muted">
              The steps are yours, so a rerun is the same run. Change one, read the score,
              and the difference belongs to the thing you moved.
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
