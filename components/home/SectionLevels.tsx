"use client";

/* ============================================================
   Rung 3 of doc 2 §2.1 — self-localisation. The rung the site was
   missing, and the reason a cold tester could not read the old one:
   "il sito definisce il concetto prima di far localizzare il
   lettore" (§0).

   Three jobs, in this order:

   1. put the reader somewhere. The levels are turned toward them
      ("oggi sei probabilmente al livello 2"), not presented as a
      taxonomy to admire;
   2. land the hook of §1: the gap to the top of the ladder is
      architectural and organisational, the technology already
      exists, what is missing are the patterns for structuring the
      work. That sentence is the whole positioning argument: it tells
      the reader their problem is a design problem, and design is
      what this site collects;
   3. defuse the tension §1.1 flags in as many words. Rung 3 implies
      the top of the ladder is a destination. The per-blueprint
      autonomy class must not inherit that reading, so the two scales
      are named apart on the same screen where the confusion would
      otherwise start.

   ── The ladder runs 1 to 5, and the rungs are ours ──
   It used to run 1 to 4 on the strength of a BlueGrid post that
   sat behind a Cloudflare challenge and could not be read, and the
   HackerNoon piece was then credited with "the five levels". It
   does not have five and it names none of them: its ladder is
   "Level 1: AI finishes your sentences", 2, 3, a "Level 3.5" where
   some services auto-merge, and "Level 4: Full dark factory", and
   the words autocomplete, chat-assisted, agentic and harness-driven
   appear nowhere in it. So the numbering, the five names and the
   sentences under them are this site's, the article is credited
   with the account of the climb it actually contains, and the
   source note says which is which. Getting this wrong was
   reader-visible: `/towards-a-dark-factory` opens on "the gap
   between level 2 and level 5" beside a link whose top rung is 4.
   (That route was `/how-to-build-a-dark-factory` when this was
   written; redesign spec §4.2 renamed it, and this comment was the
   fourth stale reference to the old path.)

   ⚠️ §1.1 is binding here more than anywhere: nothing in this file
   may teach a reader to optimise a number. The five levels describe
   an organisation; the class describes one graph, and it is a name
   with no number behind it on any surface. No arrows between the
   levels, no progress track, no wording that makes level 2 a
   deficiency.

   ── Why the layout draws now (spec §3.4) ──
   The author: "you can associate also here an image to each level by
   splitting on the left and the right of the page each level to give
   space." So every word of the copy below is the copy that shipped,
   and only the arrangement changed: a two-column split per level,
   alternating side, with one drawing each.

   The five drawings are the same figure five times. A path runs from
   a request to a shipped change, and the only thing that differs is
   who is standing on it. That choice does the §1.1 work structurally
   rather than by disclaimer:

   - the five are co-ordinate, because they are the same drawing at
     the same size in the same frame. There is no arrow between them,
     no rising line, and no shared axis to read a rank off;
   - a person on the path is drawn the way a person is drawn
     everywhere else on this site, in `HUMAN_PRESENCE_MARK` violet,
     which is the colour the repo reserves for where somebody acts
     and never for a fault;
   - level 5 has no human mark because its own sentence says nobody
     is standing on the path, which is a description of that
     arrangement and not a prize for reaching it.

   The drawing is finished markup at SSR time and the reveal spends
   itself on opacity and transform (spec §1). `useReveal` returns
   `static` on the server, without JS and under reduced motion, and
   the row renders at rest in all three.
   ============================================================ */


import {
  FLOW,
  FlowEdge,
  FlowNode,
  FlowScene,
  HumanFlowNode,
  Sheet,
  VIZ,
  toneColor,
} from "@/components/viz";
import { useReveal } from "@/components/viz/useReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cx } from "@/lib/format";

type Level = {
  n: 1 | 2 | 3 | 4 | 5;
  name: string;
  body: string;
  /** The one the reader is most likely standing on. Stated, never styled as a fault. */
  you?: boolean;
};

/**
 * The five levels, in the wording this site uses.
 *
 * All five are ours: the numbering, the names and the sentences. The HackerNoon piece
 * works through a ladder of its own and its rungs are numbered 1, 2, 3, 3.5 and 4 with no
 * names at all, so a doc comment claiming the names came from there was describing a
 * source nobody could check it against. It is linked underneath for the account of the
 * climb, which is what it does carry.
 *
 * Level 2 and level 5 are the two the positioning depends on, and both are phrased the
 * way doc 2 §1 phrases them: level 2 is "prompti, revisioni, mergi", level 5 is the
 * factory. The other three are described in the same register so the list reads as one
 * scale rather than as several borrowed ones.
 */
const LEVELS: Level[] = [
  {
    n: 1,
    name: "Autocomplete",
    body: "The model finishes the line you are typing. You are still the one writing the code.",
  },
  {
    n: 2,
    name: "Chat-assisted",
    body: "You prompt, you review, you merge. An agent does most of the typing and you stay on the critical path for every change.",
    you: true,
  },
  {
    n: 3,
    name: "Agentic",
    body: "An agent takes a whole task end to end, running what it wrote and reading the output before it decides what to do next. You read the result and decide whether it lands.",
  },
  {
    n: 4,
    name: "Harness-driven",
    body: "A harness of orchestrators and evaluators runs tasks inside constraints somebody wrote down. People read the output at named checkpoints, and the checkpoints are part of the design.",
  },
  {
    n: 5,
    name: "Dark factory",
    body: "A specification goes in. The pipeline plans, builds, tests, debugs and releases, and nobody is standing on the path it takes.",
  },
];

type Source = { title: string; where: string; href: string; note: string };

/**
 * The references doc 2 §1 asks the landing to carry. Every URL is a real one, and every
 * note says what the source actually supports. The HackerNoon note read "Where the five
 * levels come from", which the article does not: it runs a ladder of its own to level 4
 * with a half step at 3.5 and gives no rung a name.
 */
const SOURCES: Source[] = [
  {
    title: "The Dark Factory Pattern: Moving From AI-Assisted to Fully Autonomous Coding",
    where: "HackerNoon",
    href: "https://hackernoon.com/the-dark-factory-pattern-moving-from-ai-assisted-to-fully-autonomous-coding",
    note: "One team's account of the climb, and the source this framing is borrowed from. Its own ladder is numbered differently and stops at four; the five rungs above are ours.",
  },
  {
    title: "strongdm/attractor",
    where: "GitHub",
    href: "https://github.com/strongdm/attractor",
    note: "The operational case. StrongDM published the specification of its graph runner and no source code. DarkPrint's DOT stays readable by it.",
  },
];

/* ==================== the drawing ====================

   One frame, five times. Every scene is the same box, the same
   path, the same two end labels, so that the difference a reader
   sees between two of them is the difference the copy is about.
   ==================================================== */

/**
 * The frame, and why it is 420 rather than the 640 these five were drawn in.
 *
 * A label inside an `<svg>` renders at its units times (rendered CSS width ÷ frame width),
 * and `FLOW.frame` carries the measurement: this sheet is 328 CSS px wide on a phone. At
 * 640 that put every label on these five drawings between 5.1 and 6.7 CSS px, the smallest
 * text anywhere on the site, on the page that teaches the ladder the whole positioning
 * argument rests on. At 420 they clear `FLOW.frame.legible`.
 *
 * Everything below is the same drawing at the new scale, with the node spacing opened up
 * where the wider labels needed it: level 5's five words are the binding constraint, and
 * "debug" beside "release" is the tightest pair on the page.
 */
/* ── The run is an S, and that is the drawing's subject (2026-08-07) ──
   The author: "The 'S'. I meant to redesign the graphics", and the scope behind it — "the
   scope is to indicate the user what is the structure of a dark factory (i.e., it is fully
   autonomous in the part described) then the user will find a way to build its own dark
   factory by defining the blueprint".

   These five frames used to draw a single horizontal rule with marks standing on it. That
   said who was on the path and nothing about what the path IS, which is the half the scope
   above is asking for: a dark factory is a graph where planning, implementation, testing,
   debugging and deployment all run unattended, and the page's own deck says exactly that
   three screens up. A straight line cannot hold five named stations at this width without
   the words touching — the note below records the pair that was already the binding
   constraint at 420 units — so the run turns instead of stretching.

   A serpentine is the shape that buys the room: three lanes, two turns, reading left to
   right then right to left then left to right, ending bottom-right where the eye rests.
   The five phases sit two, two and one. What a reader sees at level 5 is the whole S with
   nothing standing on it, which is the structure the scope asks the page to show; the four
   levels above it are the same S with a person still on some stretch of it.

   ── The frame grew, and only downwards ──
   420 wide is unchanged and unavailable as a lever: `FLOW.frame` measures this sheet at
   328 CSS px on a phone, and the width is what decides whether a label clears
   `FLOW.frame.legible`. Height is free, and three lanes need it — 190 against the 126 a
   single lane took. The section is taller for it, and the two-column row it sits in is
   better balanced than it was: the text column always overran a 3.3:1 drawing. */
const SCENE = { width: 420, height: 190 } as const;

/* ==================== the track ====================

   The serpentine, sampled once as a polyline so that everything else on these frames can
   be placed by ARC LENGTH rather than by hand-solving a point on an arc.

   Sampled and not emitted as `A` commands, and the reason is the sub-path. Four of the
   five frames paint part of the run violet — "somebody acts along here" — and a stretch
   that begins or ends inside a corner has to be drawn as a partial arc, which means
   splitting an `A` by angle. A polyline splits by slicing, and eight samples to the
   quarter-circle is smooth at a radius of 22 units in a frame this size.

   Geometry: lanes at y = 30, 92, 154; the run spans x = 62 to 358; corners are r = 22.
   Total length is 974 units, and the three straight lanes are t = 0–274, 361–613 and
   700–974. Those three ranges are the only numbers a scene below needs. */
const TRACK: readonly (readonly [number, number])[] = [
  [62, 30], [336, 30], [340.29, 30.42], [344.42, 31.67], [348.22, 33.71], [351.56, 36.44],
  [354.29, 39.78], [356.33, 43.58], [357.58, 47.71], [358, 52], [358, 70], [357.58, 74.29],
  [356.33, 78.42], [354.29, 82.22], [351.56, 85.56], [348.22, 88.29], [344.42, 90.33],
  [340.29, 91.58], [336, 92], [84, 92], [79.71, 92.42], [75.58, 93.67], [71.78, 95.71],
  [68.44, 98.44], [65.71, 101.78], [63.67, 105.58], [62.42, 109.71], [62, 114], [62, 132],
  [62.42, 136.29], [63.67, 140.42], [65.71, 144.22], [68.44, 147.56], [71.78, 150.29],
  [75.58, 152.33], [79.71, 153.58], [84, 154], [358, 154],
];

/** Cumulative arc length at each sample, so a `t` can be resolved by binary-free scan. */
const TRACK_AT: readonly number[] = TRACK.reduce<number[]>((acc, point, i) => {
  if (i === 0) return [0];
  const [px, py] = TRACK[i - 1];
  acc.push(acc[i - 1] + Math.hypot(point[0] - px, point[1] - py));
  return acc;
}, []);

/** The whole run, end to end. Every `t` below is a distance along it. */
const TRACK_LEN = TRACK_AT[TRACK_AT.length - 1];

/** Where a station sits, by name, so a scene never repeats a number. */
const AT = {
  plan: 68,
  build: 218,
  test: 397,
  debug: 547,
  release: 866,
} as const;

/** The point at distance `t`, linear between samples. */
function pointAt(t: number): [number, number] {
  const d = Math.min(Math.max(t, 0), TRACK_LEN);
  let i = 1;
  while (i < TRACK_AT.length - 1 && TRACK_AT[i] < d) i += 1;
  const span = TRACK_AT[i] - TRACK_AT[i - 1];
  const f = span === 0 ? 0 : (d - TRACK_AT[i - 1]) / span;
  const [ax, ay] = TRACK[i - 1];
  const [bx, by] = TRACK[i];
  return [ax + (bx - ax) * f, ay + (by - ay) * f];
}

/** The stretch of the run between two distances, as an SVG path. */
function subPath(from: number, to: number): string {
  const [sx, sy] = pointAt(from);
  const parts = [`M ${r1(sx)} ${r1(sy)}`];
  for (let i = 0; i < TRACK.length; i += 1) {
    if (TRACK_AT[i] <= from || TRACK_AT[i] >= to) continue;
    parts.push(`L ${TRACK[i][0]} ${TRACK[i][1]}`);
  }
  const [ex, ey] = pointAt(to);
  parts.push(`L ${r1(ex)} ${r1(ey)}`);
  return parts.join(" ");
}

/** One decimal is plenty in a 420-unit frame, and keeps the markup readable. */
function r1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * A station's centre, as the `x`/`y` a glyph takes.
 *
 * Spread rather than passed as a point, because `FlowNode` and `HumanFlowNode` both take
 * two numbers and neither should learn about the track. It also keeps a scene reading as a
 * distance along the run — `xy(487)` is "just past halfway" — which is the only coordinate
 * that means anything once the path turns twice.
 */
function xy(t: number): { x: number; y: number } {
  const [x, y] = pointAt(t);
  return { x: r1(x), y: r1(y) };
}

/**
 * Radius of every disc in these five frames.
 *
 * The five boxes each drawing used to be were the CAD register the author rejected by
 * name (redesign spec §1), and this file was one of the three still shipping it. A disc
 * carries one label and no sub-label, so what a sub-label used to say is in the glyph's
 * accessible name now: the drawings lost "does the typing" and "writes it and runs it" as
 * printed words and kept them as what a screen reader is told.
 */
const R = 7;

/** Level 5's run, as a table, so five near-identical lines do not have to be read. */
const RUN_5: readonly { at: number; label: string }[] = [
  { at: AT.plan, label: "plan" },
  { at: AT.build, label: "build" },
  { at: AT.test, label: "test" },
  { at: AT.debug, label: "debug" },
  { at: AT.release, label: "release" },
];

/**
 * One stretch of the run, in arc length.
 *
 * `human` paints it in `HUMAN_PRESENCE_MARK` violet, because that is what "somebody acts
 * along here" looks like on every other surface of the site (doc 2 §1.1, and the reason
 * `lib/format.ts` holds the colour rather than each component choosing one). The mark
 * that stands on the run carries the same meaning in a glyph, so the colour is never
 * alone in saying it.
 */
interface PathRun {
  from: number;
  to: number;
  human?: boolean;
}

function WorkPath({
  runs,
  start,
  end,
}: {
  runs: readonly PathRun[];
  /** What enters at the top left. */
  start: string;
  /** What leaves at the bottom right. */
  end: string;
}) {
  const [fx, fy] = pointAt(0);
  const [tx, ty] = pointAt(TRACK_LEN);
  return (
    <g data-viz="path">
      {runs.map((run) => (
        <path
          key={`${run.from}-${run.to}`}
          d={subPath(run.from, run.to)}
          fill="none"
          stroke={run.human === true ? toneColor("human") : toneColor("dim")}
          strokeWidth={VIZ.stroke.base}
        />
      ))}
      <path
        d={`M ${fx} ${fy - 7} L ${fx} ${fy + 7}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
      />
      <path
        d={`M ${tx} ${ty - 7} L ${tx} ${ty + 7}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
      />
      {/* Above each tick rather than beside it. Beside the run, "specification" at
          `FLOW.label.size` runs off the left edge of a 420-unit frame; centred over its own
          tick it fits, and the two ends read as a pair. The end label clears the last lane
          because it sits in the band between lane B and lane C, which no run occupies at
          that x. */}
      <text
        data-viz="label"
        x={fx}
        y={fy - 14}
        textAnchor="middle"
        fontSize={FLOW.label.size}
        fill={toneColor("dim")}
      >
        {start}
      </text>
      <text
        data-viz="label"
        x={tx}
        y={ty - 14}
        textAnchor="middle"
        fontSize={FLOW.label.size}
        fill={toneColor("dim")}
      >
        {end}
      </text>
    </g>
  );
}

/**
 * A group drawn around several nodes, for level 4's harness.
 *
 * A hairline rather than a dash: `VIZ.dash.absent` already means "this is not here", and
 * a harness is present.
 *
 * The caption sits at the top left, which is the end of the top edge nothing arrives at.
 */
function Boundary({
  x,
  y,
  width,
  height,
  label,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}) {
  return (
    <g data-viz="boundary">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill="none"
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
      />
      <text
        data-viz="label"
        x={x + 8}
        y={y - 6}
        fontSize={VIZ.font.sub}
        fill={toneColor("dim")}
      >
        {label}
      </text>
    </g>
  );
}
interface LevelDrawing {
  /** The accessible name. A drawing is an image, and `role="img"` with no name says nothing. */
  label: string;
  /** Title block, right. Who is standing on the path, in the drawing's own terms. */
  note: string;
  body: React.ReactNode;
}

/**
 * Keyed by the level number rather than carried on `Level`, so the copy above stays a
 * block of sentences with nothing interleaved. Five drawings of one job.
 */
const DRAWINGS: Record<Level["n"], LevelDrawing> = {
  1: {
    label:
      "The path from request to merge, drawn in one unbroken violet run, held by one person from end to end with nobody and nothing else standing on it.",
    note: "the person holds the path end to end",
    /* ── Why this frame is a bare run, 2026-08-07 ──
       It carried three marks that the rest of the site's vocabulary refuses, and the author
       asked for the figure redrawn rather than annotated:

         · a `completion model` FlowNode. A lit disc on these frames means "a step in a
           run", and a model is not one — it is a tool a card DECLARES, the way `model:`
           sits in a node card beside `tools:`. `ConceptFigures.tsx` was rebuilt out of the
           identical error with the identical noun, and the author's verdict on it there is
           recorded as "very wrong". The level's own sentence beside the frame already says
           the model finishes the line you are typing, which is the honest place for it: a
           sentence, not a station on the path.
         · the `the next few tokens` edge into that disc, which had nothing left to point at
           once the disc went, and which drew a model's output as though it were a handoff
           between steps.
         · a HumanFlowNode at x=210, the midpoint. The note on this frame claims a SPAN —
           "the person holds the path end to end" — and a disc says it at a POINT. Level 2
           spends that same violet disc on genuine crossings, so a reader scanning 1 then 2
           read "one touchpoint, then two", which is the inverse of the truth: level 1 is
           the person holding everything and level 2 is the first place they let go.

       What carries the claim now is `WorkPath`'s own `human: true`, which strokes the whole
       run in the human tone from the request tick to the merge tick. That is the span the
       note describes, drawn as a span. With this frame and level 5 (`nobody stands on the
       path`, no violet at all) the ladder now has two clean poles, and every violet disc
       between them marks a real crossing.

       Do not restore a disc here to "balance" the frame against its neighbours. An empty
       run is the drawing. */
    body: (
      <WorkPath runs={[{ from: 0, to: TRACK_LEN, human: true }]} start="request" end="merged" />
    ),
  },
  2: {
    label:
      "The path from request to merge, crossing a person at the prompt and again at the review, with an agent writing the change between them.",
    note: "the path crosses the person twice",
    body: (
      <>
        <WorkPath
          runs={[
            { from: 0, to: 272, human: true },
            { from: 272, to: 703, human: false },
            { from: 703, to: TRACK_LEN, human: true },
          ]}
          start="request"
          end="merged"
        />
        {/* The agent is on lane B, in the middle of the dim stretch; the two people are on
            lanes A and C, inside the violet ones. The run crosses the person twice and the
            title block says so, which is unchanged from the straight version — what the S
            adds is that the two crossings are now visibly at opposite ends of the work. */}
        <FlowNode
          mark="schematic"
          {...xy(487)}
          r={R}
          tone="cyan"
          label="the agent"
          name="the agent, which does the typing"
        />
        <HumanFlowNode {...xy(120)} r={8} label="prompts" mark="schematic" />
        <HumanFlowNode {...xy(850)} r={8} label="reviews, merges" mark="schematic" />
      </>
    ),
  },
  3: {
    label:
      "The path from task to landing, with one agent that writes and runs its own work and reads its own output, and a person at the end.",
    note: "the person reads the result",
    body: (
      <>
        <WorkPath
          runs={[
            { from: 0, to: 703, human: false },
            { from: 703, to: TRACK_LEN, human: true },
          ]}
          start="task"
          end="lands"
        />
        {/* Bowed over the disc rather than under it, and the sign is the whole of the fix.
            A `FlowEdge` writes its label above its own curve, so an arc bowing down put
            "reads its own output" 11 units above "the agent" in a band that holds one line
            of 13-unit type, and the two words were printed over each other on every screen.
            `scene-labels.test.ts` found it. Bowing up moves the label into the empty half
            of the frame, where levels 1 and 4 already put a glyph, and `labelT` was no help
            because this arc is 31 units long and sliding a 156-unit label along it moves it
            by five. The magnitude is the vocabulary's own `wide`, which is what level 5's
            return arc takes, so the two loops on this page are mirror images. */}
        <FlowEdge
          from={[180, 92]}
          to={[314, 92]}
          bend={-FLOW.edge.bend.wide}
          fromRadius={R}
          toRadius={R}
          tone="dim"
          label="reads its own output"
          pulse={false}
        />
        <FlowNode
          mark="schematic"
          {...xy(450)}
          r={R}
          tone="cyan"
          label="the agent"
          name="the agent, which writes it and runs it"
        />
        <HumanFlowNode {...xy(866)} r={8} label="decides whether it lands" mark="schematic" />
      </>
    ),
  },
  4: {
    label:
      "The path from task to shipped, running through a harness of an orchestrator and an evaluator, inside constraints a person wrote, with a person reading the output at a checkpoint.",
    note: "the person reads at a checkpoint",
    body: (
      <>
        <WorkPath
          runs={[
            { from: 0, to: 790, human: false },
            { from: 790, to: TRACK_LEN, human: true },
          ]}
          start="task"
          end="shipped"
        />
        {/* Every number on this row is pinned by a word, and the box is pinned by the two
            it must not touch.

            `scene-labels.test.ts` first measured "evaluator" and the checkpoint mark's
            label as 49 units of the same line, printed on top of each other. Sliding the
            harness left cleared that and drew a second defect nothing was looking for: at
            `x={82}` the rectangle's top-left corner was stroked across the last letters of
            "task", and its left edge ran three units from the path's own start tick, which
            at this frame's phone scale is two hairlines two pixels apart.
            `labelsOverBoxEdges` is the case that now sees it.

            The box cannot cross that word by moving up or down instead: "task" sits on a
            baseline seven units above the discs and the node labels hang thirteen below
            them, so a rectangle enclosing both discs has no vertical room to dodge either
            band. It has to be horizontally clear of "task", and everything else follows.
            The box starts at 103, eight units past where "task" ends; that puts the
            orchestrator at 123, the evaluator at 216 to keep twelve and nine characters of
            13-unit type apart, and the checkpoint mark at 325 — as far right as it can go
            before its ring meets the end tick at 341. The margins around the two discs are
            20 units, down from 32, which is what that chain leaves. */}
        <Boundary x={185} y={78} width={130} height={28} label="harness" />
        <FlowEdge from={[300, 92]} to={[200, 92]} fromRadius={R} toRadius={R} pulse={false} />
        <FlowNode {...xy(397)} r={R} tone="cyan" mark="schematic" label="orchestrator" />
        <FlowNode {...xy(497)} r={R} tone="cyan" mark="schematic" label="evaluator" />
        {/* The person is upstream of the harness rather than on the path. A label hangs
            directly under its own glyph, so the run out of the mark leaves sideways: an
            edge dropping away would be drawn straight through the words. */}
        {/* Off the run, in the band between lane A and lane B, and to the left of the
            harness box it is the boundary OF. That band is the largest empty region on the
            serpentine, which is what makes an off-path mark drawable at all here — on the
            straight version it had to go above the line, and there was no above. */}
        <HumanFlowNode x={95} y={52} r={8} label="wrote the constraints" mark="schematic" />
        {/* ── The constraints are no longer a disc, 2026-08-07 ──
            An anonymous `dim` FlowNode sat at [189, 24] carrying the accessible name "the
            constraints the harness runs inside", with a vertical edge dropping from it onto
            the box's top edge. It is the same category error the author had `ConceptFigures`
            and level 1 redrawn for: a lit disc on these frames means a STEP IN A RUN, and a
            set of constraints is a document — the thing a person writes and hands over, not
            a station the work passes through. It was also the one mark on this frame with no
            label at all, which is what a drawing looks like when a noun has nowhere to go.

            Both the disc and its edge are gone rather than recoloured. What said "the person
            wrote the constraints the harness runs inside" is now said by the two marks that
            were already saying it: the violet `wrote the constraints` upstream of the box,
            and the `harness` Boundary the constraints are the boundary OF. The person is
            deliberately off the path here — that is this level's whole point, and it is why
            the mark sits above the run rather than on it.

            Nothing dangles: the edge deleted with the disc was the only run into it. */}
        {/* "reads at a checkpoint" was 21 characters on a row that had room for 16. The
            level's own sentence says people read the output at named checkpoints and the
            title block under the drawing says at a checkpoint, so the word the glyph itself
            has to carry is what the person does there. */}
        <HumanFlowNode {...xy(880)} r={8} label="reads the output" mark="schematic" />
      </>
    ),
  },
  5: {
    label:
      "The path from specification to release, running through five agents that plan, build, test, debug and release, with a return arc from debug to test and no person anywhere on it.",
    note: "nobody stands on the path",
    body: (
      <>
        <WorkPath runs={[{ from: 0, to: TRACK_LEN }]} start="specification" end="released" />
        {/* The loop, on lane B where debug and test both sit. It bows UP, into the band
            between the lanes: the two node labels hang below their discs at about y=112,
            and an arc bowing down would be drawn straight through both of them. */}
        <FlowEdge
          from={[150, 92]}
          to={[300, 92]}
          bend={-FLOW.edge.bend.wide}
          fromRadius={R}
          toRadius={R}
          tone="dim"
          pulse={false}
        />
        {RUN_5.map((step) => (
          <FlowNode
            key={step.label}
            {...xy(step.at)}
            r={R}
            tone="cyan"
            mark="schematic"
            label={step.label}
          />
        ))}
      </>
    ),
  },
};

/**
 * One level: its words on one side, its drawing on the other, sides alternating.
 *
 * Its own component because each row observes its own arrival. `useReveal` reports
 * `static` on the server, without JS and under reduced motion, and `shown` is true in
 * all three, so the row is at rest and legible before any script runs.
 */
function LevelRow({ level, flip }: { level: Level; flip: boolean }) {
  const { ref, shown } = useReveal<HTMLLIElement>({ amount: 0.15 });
  const drawing = DRAWINGS[level.n];

  return (
    <li
      ref={ref}
      className={cx(
        "grid items-center gap-6 transition duration-700 ease-out md:grid-cols-2 md:gap-10",
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <div className={cx("flex flex-col gap-3", flip ? "md:order-2" : "md:order-1")}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span className="inline-flex items-center rounded border border-line-bright bg-surface-3 px-2 py-0.5 font-mono text-sm text-fg">
            level {level.n}
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
            {level.name}
          </span>
          {/* A `⌖ you are probably here` chip hung off level 2 until 2026-08-07, when the
              author asked it out. The `you` field stays on the data (`LEVELS`) and is
              simply unread here: the section's own heading is still "Most teams are at
              level 2", so the claim the chip made is made once, in the largest type on the
              section, instead of twice. */}
        </div>
        <p className="text-sm leading-relaxed text-muted">{level.body}</p>
      </div>

      <Sheet
        className={cx(flip ? "md:order-1" : "md:order-2")}
        bodyClassName="p-3 sm:p-4"
        note={drawing.note}
      >
        {/* A `FlowScene` rather than a plain `Scene`, because `FLOW_CSS` is scoped to the
            attribute this writes: without it a disc inside would keep its drawn focus ring
            switched off by the presentation attribute that hides it, and a keyboard reader
            would land on the glyph with nothing to show for it. */}
        <FlowScene width={SCENE.width} height={SCENE.height} label={drawing.label}>
          {drawing.body}
        </FlowScene>
      </Sheet>
    </li>
  );
}

export function SectionLevels() {
  return (
    <section id="levels" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="Where you are today"
          title="Most teams are at level 2"
          lead="Before the rest of this makes sense, find yourself on the list. It describes how far along a team is with agents, and where you land decides which problem you actually have."
        />

        {/* Five drawings of the same job. The frame is identical in each, so what a
            reader compares is who is standing on the path and nothing else. */}
        <ol className="mt-12 flex flex-col gap-14 sm:gap-16">
          {LEVELS.map((l, i) => (
            <LevelRow key={l.n} level={l} flip={i % 2 === 1} />
          ))}
        </ol>

        {/* Doc 2 §1's hook. The one sentence that does the positioning. */}
        <div className="mt-14 rounded-lg border border-cyan/30 bg-cyan/5 p-6 sm:p-8">
          <p className="max-w-3xl font-display text-xl leading-snug text-fg sm:text-2xl">
            The gap between level 2 and level 5 is architectural and organisational.
          </p>
          {/* Full width, on the author's instruction 2026-08-07: `max-w-3xl` off this
              paragraph. The line above it keeps its cap — it is one display-size sentence
              and a 48rem measure is what stops it running as a banner. */}
          <p className="mt-4 text-base leading-relaxed text-muted">
            The technology to run at level 5 already exists. What is missing are the
            patterns for structuring the work: what each agent is handed, and what each
            one is kept away from. Better models will not supply that. It is a design
            problem, and designs are what this site collects.
          </p>
        </div>

        {/* ---------- the two-scales panel stood here ----------
            `id="autonomy"`, an `h3` reading "Two scales, and only one of them is a
            number", a two-column `dl` and three closing paragraphs. The author asked the
            section out on 2026-08-07.

            The constraint it carried is doc 2 §1.1 and it is NOT lost with the panel:
            `/towards-a-dark-factory`'s own deck states it above everything, in the words
            this panel was the long form of — two things get called autonomy here, only
            one is a number, the ladder counts an organisation, the class on a blueprint
            records where its author put a person and ranks nothing. That paragraph was
            written when the correction moved upstream of the picture, and it is the
            reason the long form could go without the claim going with it.

            What DID go is the `#autonomy` anchor. Two links pointed at it: the deck's own
            "named apart in full", rewritten in the same commit, and one in
            `WhichTasksRemedies`, deleted whole in the same commit for its own reason.
            `components/home/levels.test.ts` held two assertions on this copy and now
            holds them on the deck instead. */}

        {/* ---------- sources ---------- */}
        <div className="mt-10 border-t border-line pt-6">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            Where this framing comes from
          </h3>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {SOURCES.map((s) => (
              <li key={s.href} className="flex flex-col gap-1.5">
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium leading-snug text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
                >
                  {s.title}
                  <span className="ml-1 font-mono text-[11px] text-dim" aria-hidden>
                    ↗
                  </span>
                </a>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                  {s.where}
                </span>
                <p className="text-xs leading-relaxed text-dim">{s.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
