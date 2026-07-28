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

import Link from "next/link";

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
const SCENE = { width: 420, height: 148 } as const;
/** The path from the request to the shipped change. Identical in all five drawings. */
const PATH = { y: 88, from: 79, to: 341 } as const;

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
const RUN_5: readonly { x: number; label: string }[] = [
  { x: 96, label: "plan" },
  { x: 148, label: "build" },
  { x: 200, label: "test" },
  { x: 252, label: "debug" },
  { x: 310, label: "release" },
];

/**
 * One stretch of the path.
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
  /** What enters at the left. */
  start: string;
  /** What leaves at the right. */
  end: string;
}) {
  return (
    <g data-viz="path">
      {runs.map((run) => (
        <path
          key={`${run.from}-${run.to}`}
          d={`M ${run.from} ${PATH.y} L ${run.to} ${PATH.y}`}
          stroke={run.human === true ? toneColor("human") : toneColor("dim")}
          strokeWidth={VIZ.stroke.base}
        />
      ))}
      <path
        d={`M ${PATH.from} ${PATH.y - 7} L ${PATH.from} ${PATH.y + 7}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
      />
      <path
        d={`M ${PATH.to} ${PATH.y - 7} L ${PATH.to} ${PATH.y + 7}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
      />
      {/* Above the ticks rather than outside them. Beside the path, "specification" at
          `FLOW.label.size` runs off the left edge of a 420-unit frame; centred over its own
          tick it fits, and the two ends read as a pair. */}
      <text
        data-viz="label"
        x={PATH.from}
        y={PATH.y - 14}
        textAnchor="middle"
        fontSize={FLOW.label.size}
        fill={toneColor("dim")}
      >
        {start}
      </text>
      <text
        data-viz="label"
        x={PATH.to}
        y={PATH.y - 14}
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
 * a harness is present. The caption sits at the top right because the traffic into a
 * group arrives at its top left, and a caption there is the first thing an incoming
 * leader runs over.
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
        rx={6}
        fill="none"
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
      />
      <text
        data-viz="label"
        x={x + width - 8}
        y={y - 6}
        textAnchor="end"
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
      "The path from request to merge, held by one person, with a completion model above it offering the next few tokens.",
    note: "the person holds the path end to end",
    body: (
      <>
        <WorkPath runs={[{ from: PATH.from, to: PATH.to, human: true }]} start="request" end="merged" />
        {/* Named rather than labelled. A vertical run this short puts its label within nine
            units of the disc's own label, and the two words overlapped on the drawing. The
            level's own sentence beside it says what the run carries — "the model finishes
            the line you are typing" — and the accessible name says it inside the figure. */}
        <FlowEdge
          from={[210, 34]}
          to={[210, 78]}
          fromRadius={R}
          toRadius={0}
          tone="dim"
          name="the next few tokens"
          pulse={false}
        />
        <FlowNode x={210} y={30} r={R} tone="dim" label="completion model" />
        <HumanFlowNode x={210} y={PATH.y} r={8} label="writes the code" />
      </>
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
            { from: PATH.from, to: 152, human: true },
            { from: 152, to: 268, human: false },
            { from: 268, to: PATH.to, human: true },
          ]}
          start="request"
          end="merged"
        />
        <FlowNode
          x={205}
          y={PATH.y}
          r={R}
          tone="cyan"
          label="the agent"
          name="the agent, which does the typing"
        />
        <HumanFlowNode x={112} y={PATH.y} r={8} label="prompts" />
        <HumanFlowNode x={312} y={PATH.y} r={8} label="reviews, merges" />
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
            { from: PATH.from, to: 268, human: false },
            { from: 268, to: PATH.to, human: true },
          ]}
          start="task"
          end="lands"
        />
        <FlowEdge
          from={[196, PATH.y]}
          to={[144, PATH.y]}
          bend={-34}
          fromRadius={R}
          toRadius={R}
          tone="dim"
          label="reads its own output"
          pulse={false}
        />
        <FlowNode
          x={170}
          y={PATH.y}
          r={R}
          tone="cyan"
          label="the agent"
          name="the agent, which writes it and runs it"
        />
        <HumanFlowNode x={305} y={PATH.y} r={8} label="decides whether it lands" />
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
            { from: PATH.from, to: 296, human: false },
            { from: 296, to: PATH.to, human: true },
          ]}
          start="task"
          end="shipped"
        />
        <Boundary x={128} y={72} width={154} height={32} label="harness" />
        <FlowEdge
          from={[160, PATH.y]}
          to={[250, PATH.y]}
          fromRadius={R}
          toRadius={R}
          pulse={false}
        />
        <FlowNode x={160} y={PATH.y} r={R} tone="cyan" label="orchestrator" />
        <FlowNode x={250} y={PATH.y} r={R} tone="cyan" label="evaluator" />
        {/* The person is upstream of the harness rather than on the path. A label hangs
            directly under its own glyph, so the run out of the mark leaves sideways: an
            edge dropping away would be drawn straight through the words. */}
        <HumanFlowNode x={88} y={24} r={8} label="wrote the constraints" />
        <FlowEdge
          from={[189, 24]}
          to={[189, 66]}
          fromRadius={R}
          toRadius={0}
          tone="dim"
          pulse={false}
        />
        <FlowNode x={189} y={24} r={R} tone="dim" label="constraints" />
        <HumanFlowNode x={318} y={PATH.y} r={8} label="reads at a checkpoint" />
      </>
    ),
  },
  5: {
    label:
      "The path from specification to release, running through five agents that plan, build, test, debug and release, with a return arc from debug to test and no person anywhere on it.",
    note: "nobody stands on the path",
    body: (
      <>
        <WorkPath runs={[{ from: PATH.from, to: PATH.to }]} start="specification" end="released" />
        <FlowEdge
          from={[252, PATH.y]}
          to={[200, PATH.y]}
          bend={-FLOW.edge.bend.wide}
          fromRadius={R}
          toRadius={R}
          tone="dim"
          pulse={false}
        />
        {RUN_5.map((step) => (
          <FlowNode key={step.label} x={step.x} y={PATH.y} r={R} tone="cyan" label={step.label} />
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
          {level.you === true && (
            /* §1.1: a location, and it has to read as one. A bordered marker beside the
               level's own name says "this is the spot on the map", where the same words
               trailing the paragraph read as a remark about the paragraph. */
            <span className="inline-flex items-center gap-1.5 rounded border border-cyan/50 bg-cyan/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
              <span aria-hidden>⌖</span>
              you are probably here
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted">{level.body}</p>
      </div>

      <Sheet
        className={cx(flip ? "md:order-1" : "md:order-2")}
        bodyClassName="p-3 sm:p-4"
        title={level.name}
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
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted">
            The technology to run at level 5 already exists. What is missing are the
            patterns for structuring the work: what each agent is handed, and what each
            one is kept away from. Better models will not supply that. It is a design
            problem, and designs are what this site collects.
          </p>
        </div>

        {/* ---------- doc 2 §1.1, in as many words ---------- */}
        <div id="autonomy" className="panel mt-6 scroll-mt-24 p-6 sm:p-8">
          <h3 className="font-display text-xl font-semibold text-fg">
            Two scales, and only one of them is a number
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            The word autonomy does two jobs here and the subjects are different. Keeping
            them apart matters, because the second one appears on every blueprint in the
            gallery.
          </p>

          <dl className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2 border-l-2 border-line-bright pl-4">
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                The five levels above
              </dt>
              {/* "The one thing on the site that is counted in rungs" was falsified three
                  sections down by this same page: `security level 4` is printed under the
                  example's schematic, and again on all nine blueprint pages, `/build`,
                  `/what-it-isnt` and the gallery. The binding constraint is the autonomy
                  ordinal, which appears nowhere, and that is what the clause was reaching
                  for. Narrowed to the claim that is true and that the panel is about: an
                  organisation is counted in rungs here and nothing else is. */}
              <dd className="text-sm leading-relaxed text-muted">
                <span className="text-fg">The maturity of an organisation.</span> What a
                team is able to do at all, across everything it ships. It is the only thing
                on this site that puts an organisation on a numbered scale.
              </dd>
            </div>
            <div className="flex flex-col gap-2 border-l-2 border-cyan/50 pl-4">
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">
                The autonomy class on a blueprint
              </dt>
              <dd className="text-sm leading-relaxed text-muted">
                <span className="text-fg">A design choice on one graph.</span> What that
                factory automated, and where its author decided a person should act. It
                is a name, and the gallery prints no number beside it.
              </dd>
            </div>
          </dl>

          <p className="mt-6 max-w-3xl border-t border-line pt-5 text-sm leading-relaxed text-muted">
            A team at level 5 publishes supervised blueprints on purpose. A factory that
            holds for a person before it releases is a factory whose author decided where
            a person belongs, and the class records that decision. In the gallery the
            class filters; it never ranks, and nothing here badges or rewards a blueprint
            for the class it is in.{" "}
            <Link
              href="/blueprints"
              className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
            >
              See it on the blueprints
            </Link>
            .
          </p>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
            The phrase <span className="text-fg">dark factory</span> lands on both scales,
            so it is worth saying which one a blueprint page means. On the ladder it is
            the fifth rung, a way of working. On a blueprint it classes the drawing: no
            node in this graph waits for a person, the way <em>acyclic</em> says a graph
            has no cycle. A graph with somebody in it is a first-class blueprint here and
            is shelved beside the rest.
          </p>
        </div>

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
