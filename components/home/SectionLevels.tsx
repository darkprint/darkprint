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
import { arrowHeadPath } from "@/components/viz/Glyphs";
import { returnLanePath } from "@/components/graph/return-lane";
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
/* ── These are graphs now, not marks standing on a rule (2026-08-07) ──
   The author: "revisit the graph graphics, making more clear and clean, showing loops as
   edges and also the rest that connect nodes as directed edges."

   What was wrong is worth stating exactly, because it was wrong in the same way twice. The
   drawing was ONE continuous line from a start tick to an end tick, with discs sitting on
   top of it. That is a timeline, not a graph: nothing pointed anywhere, the direction of
   the work was carried by nothing but left-to-right convention, and the one real loop on
   the page — a debugger handing a patch back to a tester — had to be drawn as an arc
   floating over a line it was not connected to.

   Every mark below is now a node and every connection is a `FlowEdge`, which trims itself
   to both rims and draws an arrowhead. The loop is two anti-parallel edges between the two
   nodes that actually have one. This is the vocabulary the rest of the site already draws
   its blueprints in — `components/home/SectionBlueprint.tsx` and the gallery's
   `GraphThumbnail` both wire nodes this way — so the ladder and the registry finally speak
   one language.

   ── The serpentine, and why it is gone ──
   These five frames spent one commit drawn on an S-shaped track. That was a misreading:
   the author's "S" described how the five ROWS are positioned down the page, alternating
   left and right, which is `LevelRow`'s `flip` and was never in question. The track is a
   straight run again. */
const SCENE = { width: 420, height: 140 } as const;

/** The row every graph is wired along, and the two ticks the work enters and leaves by. */
const ROW = 96;
const IN = 62;
const OUT = 358;

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
/** A `HumanFlowNode` is drawn larger than a `FlowNode` so its pause glyph fits inside. */
const HR = 8;

/**
 * One directed run between two marks.
 *
 * Every edge on these frames goes through here so that not one of them can be drawn
 * without an arrowhead. `FlowEdge` defaults `arrow` to true and `pulse` to true; the pulse
 * is off because these five are diagrams of a shape rather than of a run in progress, and
 * five frames each travelling a light is the register spent on the wrong thing.
 */
function Wire({
  from,
  to,
  fromR = R,
  toR = R,
  bend,
  label,
  tone,
}: {
  from: [number, number];
  to: [number, number];
  fromR?: number;
  toR?: number;
  bend?: number;
  label?: string;
  tone?: "line" | "dim";
}) {
  return (
    <FlowEdge
      from={from}
      to={to}
      fromRadius={fromR}
      toRadius={toR}
      bend={bend}
      label={label}
      tone={tone}
      pulse={false}
    />
  );
}

/**
 * The two ends of the work: what goes in on the left, what comes out on the right.
 *
 * A tick and a word rather than a disc, and the distinction is the one this whole rewrite
 * is about. A lit disc on this site means a node — a step something runs at — and neither
 * "request" nor "merged" is a step. They are the boundary of the drawing, so they are
 * drawn as the drawing's own furniture and the first and last EDGE runs from and to them.
 */
function Ends({ start, end }: { start: string; end: string }) {
  return (
    <g data-viz="ends">
      <path
        d={`M ${IN} ${ROW - 7} L ${IN} ${ROW + 7}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
      />
      <path
        d={`M ${OUT} ${ROW - 7} L ${OUT} ${ROW + 7}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
      />
      {/* Above the ticks rather than beside them: "specification" at `FLOW.label.size` runs
          off the left edge of a 420-unit frame if it sits beside its own tick. */}
      <text
        data-viz="label"
        x={IN}
        y={ROW - 14}
        textAnchor="middle"
        fontSize={FLOW.label.size}
        fill={toneColor("dim")}
      >
        {start}
      </text>
      <text
        data-viz="label"
        x={OUT}
        y={ROW - 14}
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

/**
 * A run that goes backwards, drawn the way the gallery draws one.
 *
 * The author, 2026-08-07: "adopt the style to write the graph as the one present in the
 * blueprints gallery." That style's one distinctive move is this — a forward edge is a
 * curve between two ports and a RETURN edge is an orthogonal detour through a corridor
 * above the drawing. `components/graph/return-lane.ts` holds the geometry and the gallery
 * imports the same function, so the two are the same shape rather than two that resemble
 * each other.
 *
 * The arrowhead is drawn here rather than by `FlowEdge`, because the lane arrives
 * horizontally out of a `H` command and `FlowEdge` only knows how to point along its own
 * bezier. `arrowHeadPath` is the vocabulary's own head, so it matches every other arrow on
 * the frame.
 */
function ReturnLane({ from, to, laneY }: { from: number; to: number; laneY: number }) {
  const a = { x: from + R + FLOW.edge.gap, y: ROW };
  const b = { x: to - R - FLOW.edge.gap, y: ROW };
  return (
    <g data-viz="return-lane">
      <path
        d={returnLanePath(a, b, laneY)}
        fill="none"
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.thin}
        strokeOpacity={FLOW.edge.lineOpacity}
      />
      {/* Arriving from the left, so the head points right into the target's rim. */}
      <path
        d={arrowHeadPath([b.x, b.y], [b.x - 10, b.y])}
        fill={toneColor("dim")}
        fillOpacity={FLOW.edge.arrowOpacity}
      />
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
      "A request runs into one person, who writes the code, and out to a merge. The person is the only node in the graph.",
    note: "the person holds the path end to end",
    body: (
      <>
        <Ends start="request" end="merged" />
        <Wire from={[IN, ROW]} to={[210, ROW]} fromR={0} toR={HR} />
        <Wire from={[210, ROW]} to={[OUT, ROW]} fromR={HR} toR={0} />
        {/* One node, and it is a person. The level's sentence is that the model finishes
            your line and you are still the one writing the code, so there is no agent in
            this graph to draw — the whole of the work happens at the mark. */}
        <HumanFlowNode
          x={210}
          y={ROW}
          r={HR}
          label="writes the code"
          mark="schematic"
        />
      </>
    ),
  },
  2: {
    label:
      "A request runs into a person who prompts, on to an agent that does the typing, on to a person who reviews and merges, and out.",
    note: "the path crosses the person twice",
    body: (
      <>
        <Ends start="request" end="merged" />
        <Wire from={[IN, ROW]} to={[120, ROW]} fromR={0} toR={HR} />
        <Wire from={[120, ROW]} to={[195, ROW]} fromR={HR} />
        <Wire from={[195, ROW]} to={[310, ROW]} toR={HR} />
        <Wire from={[310, ROW]} to={[OUT, ROW]} fromR={HR} toR={0} />
        <HumanFlowNode x={120} y={ROW} r={HR} label="prompts" mark="schematic" />
        <FlowNode
          mark="schematic"
          x={195}
          y={ROW}
          r={R}
          tone="cyan"
          label="the agent"
          name="the agent, which does the typing"
        />
        <HumanFlowNode x={310} y={ROW} r={HR} label="reviews, merges" mark="schematic" />
      </>
    ),
  },
  3: {
    label:
      "A task runs into an agent that writes the work and runs it, with an edge from the agent back to itself for the output it reads, then on to a person who decides whether it lands.",
    note: "the person reads the result",
    body: (
      <>
        <Ends start="task" end="lands" />
        <Wire from={[IN, ROW]} to={[150, ROW]} fromR={0} />
        <Wire from={[150, ROW]} to={[300, ROW]} toR={HR} />
        <Wire from={[300, ROW]} to={[OUT, ROW]} fromR={HR} toR={0} />
        {/* The loop, as an edge. It leaves the agent and arrives back at the agent, which
            is what "reads its own output" IS — the one thing the old drawing could not
            say, because an arc over a rule connects nothing. Drawn as a wide bow up into
            the empty half of the frame so its label clears the node's own. */}
        <Wire
          from={[134, ROW]}
          to={[166, ROW]}
          fromR={0}
          toR={0}
          bend={-FLOW.edge.bend.wide}
          label="reads its own output"
          tone="dim"
        />
        <FlowNode
          mark="schematic"
          x={150}
          y={ROW}
          r={R}
          tone="cyan"
          label="the agent"
          name="the agent, which writes it and runs it"
        />
        <HumanFlowNode x={300} y={ROW} r={HR} label="decides whether it lands" mark="schematic" />
      </>
    ),
  },
  4: {
    label:
      "A task runs into a harness of an orchestrator and an evaluator, wired to each other, then out to a person who reads the output at a checkpoint. A second person, off the graph, wrote the constraints the harness runs inside.",
    note: "the person reads at a checkpoint",
    body: (
      <>
        <Ends start="task" end="shipped" />
        <Wire from={[IN, ROW]} to={[115, ROW]} fromR={0} />
        <Wire from={[115, ROW]} to={[215, ROW]} />
        <Wire from={[215, ROW]} to={[330, ROW]} toR={HR} />
        <Wire from={[330, ROW]} to={[OUT, ROW]} fromR={HR} toR={0} />
        {/* The box encloses the two nodes it is the harness OF and nothing else. Its left
            edge stands clear of "task", which sits on the terminal's own baseline, and its
            right edge clear of the checkpoint mark's rim. */}
        <Boundary x={100} y={82} width={130} height={28} label="harness" />
        <FlowNode x={115} y={ROW} r={R} tone="cyan" mark="schematic" label="orchestrator" />
        <FlowNode x={215} y={ROW} r={R} tone="cyan" mark="schematic" label="evaluator" />
        {/* Off the graph, with no edge into it, and that is the level's whole point: the
            person wrote the constraints the harness runs inside and does not stand in the
            run. A disc for "the constraints" was deleted from this frame once already —
            a lit circle here means a step something runs at, and a document is not one. */}
        <HumanFlowNode x={300} y={30} r={HR} label="wrote the constraints" mark="schematic" />
        <HumanFlowNode x={330} y={ROW} r={HR} label="reads the output" mark="schematic" />
      </>
    ),
  },
  5: {
    label:
      "A specification runs into plan, build, test, debug and release in a line, with a return edge from debug back to test routed through a lane above the graph, and no person anywhere in it.",
    note: "nobody stands on the path",
    body: (
      <>
        <Ends start="specification" end="released" />
        <Wire from={[IN, ROW]} to={[95, ROW]} fromR={0} />
        <Wire from={[95, ROW]} to={[150, ROW]} />
        <Wire from={[150, ROW]} to={[205, ROW]} />
        <Wire from={[205, ROW]} to={[262, ROW]} />
        <Wire from={[262, ROW]} to={[325, ROW]} />
        <Wire from={[325, ROW]} to={[OUT, ROW]} toR={0} />
        {/* The loop, and the one edge on this page that runs backwards. Debug hands a patch
            back to test and the run continues from there — the starter blueprint's own
            `tester -> debugger -> tester`, which never returns to the builder. Drawn as the
            gallery draws every return edge: out of the source, up into a corridor, back
            along it, down into the target. */}
        <ReturnLane from={262} to={205} laneY={44} />
        <FlowNode x={95} y={ROW} r={R} tone="cyan" mark="schematic" label="plan" />
        <FlowNode x={150} y={ROW} r={R} tone="cyan" mark="schematic" label="build" />
        <FlowNode x={205} y={ROW} r={R} tone="cyan" mark="schematic" label="test" />
        <FlowNode x={262} y={ROW} r={R} tone="cyan" mark="schematic" label="debug" />
        <FlowNode x={325} y={ROW} r={R} tone="cyan" mark="schematic" label="release" />
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
