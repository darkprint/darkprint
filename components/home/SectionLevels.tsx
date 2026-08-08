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
/* ══════════════════════════════════════════════════════════════
   One pipeline, five times, and the only thing that moves is who is standing in it.

   The author, 2026-08-08: "revisit also all the graphics about the five levels of autonomy
   ... They are not totally clear to me." They were not, and the diagnosis is worth writing
   down because the previous two passes both fixed the wrong thing.

   ── What was actually wrong ──
   The five frames were five DIFFERENT drawings. Level 1 had one person and no agent, level
   2 had three marks, level 3 had a self-loop, level 4 had a harness and a floating figure,
   level 5 had five stations and a return lane. Every one of them was individually legible,
   and together they said nothing: a reader had to read five pictures and hold them in their
   head to see the progression.

   A ladder measures ONE variable. This one measures how much of the work runs unattended.
   That should be readable by scanning down the column without reading a word, and it was
   not — you had to count violet marks across five different compositions and infer.

   This file's own header has claimed "one frame, five times ... the only thing that differs
   is who is standing on the path" since the drawings were introduced. It was never true.
   It is now.

   ── What the frames are ──
   The same five-phase run in every one: plan, build, test, debug, release, wired left to
   right with the debug→test loop the starter blueprint actually writes. Identical
   positions, identical labels, identical return lane.

   Each station is drawn as ONE mark, and the mark says who is at it — `FlowNode` in cyan
   for an agent, `HumanFlowNode` in violet for a person. That is the site's own vocabulary
   doing exactly the job it was defined for (doc 2 §1.1: violet is where a person acts, and
   `FlowTone` has no `human` member so nothing else can claim it), and it means the answer
   to "how much of this is unattended" is the number of violet marks, visible at a glance
   and without a caption.

   Scanning the five: five violet, three, one at the end, one in the middle inside a
   harness, none. The person retreats and then leaves.

   ── Where each person stands, read off the level's own sentence ──
     1 "You are still the one writing the code."          → all five
     2 "You prompt, you review, you merge. An agent does
        most of the typing."                              → plan, test, release
     3 "An agent takes a whole task end to end ... You
        read the result and decide whether it lands."     → release
     4 "People read the output at named checkpoints, and
        the checkpoints are part of the design."          → test, inside a harness
     5 "nobody is standing on the path it takes."         → none

   Levels 3 and 4 both hold one person and the difference is the point: 3 has them at the
   END, reading a finished result, and 4 has them INSIDE the run at a station the design
   chose, with everything downstream of them still unattended. The harness boundary is what
   says the checkpoint was designed rather than left over.

   ── What went, and why nothing true went with it ──
   The terminal ticks and their labels ("request"/"merged", "task"/"lands", …) are gone.
   They were a second label band above the row, running a different vocabulary per level,
   and they were the other half of why five frames would not compare: a reader had to learn
   that words above the line were boundaries and words below it were stations. The first
   station IS where the work enters now.

   `WorkPath`, `Ends` and the per-level station sets went with them. Nothing they said is
   lost: what enters and leaves is in each level's own sentence beside the drawing, and the
   title block under each frame still names who is standing where.
   ══════════════════════════════════════════════════════════════ */
const SCENE = { width: 420, height: 116 } as const;

/** The row every station sits on, and the corridor the return edge runs back along. */
const ROW = 72;
const LANE_Y = 28;

/**
 * Radius of an agent's disc, and of a person's mark.
 *
 * A `HumanFlowNode` is drawn one unit larger so its pause glyph fits inside, and
 * `labelOffset` scales off the radius — which is why the violet names hang two units lower
 * than the cyan ones and why the frame's height is measured against a violet label rather
 * than against the tallest frame.
 */
const R = 7;
const HR = 8;

/**
 * The five phases, in the closed set doc 3 §2 draws and the page's own deck names.
 *
 * Positions are 76 apart, which is what the widest neighbouring pair of labels needs:
 * "debug" and "release" are the tightest, at 18 and 25 units of half-width.
 */
const STATIONS = [
  { x: 52, label: "plan" },
  { x: 128, label: "build" },
  { x: 204, label: "test" },
  { x: 280, label: "debug" },
  { x: 356, label: "release" },
] as const;

/** Index of the station a return edge leaves, and the one it arrives at. */
const LOOP_FROM = 3;
const LOOP_TO = 2;

/** One directed run between two stations, trimmed to both rims and always arrowed. */
function Wire({ from, to, fromR, toR }: { from: number; to: number; fromR: number; toR: number }) {
  return (
    <FlowEdge
      from={[from, ROW]}
      to={[to, ROW]}
      fromRadius={fromR}
      toRadius={toR}
      pulse={false}
    />
  );
}

/**
 * The run that goes backwards, drawn the way the blueprint gallery draws one.
 *
 * `components/graph/return-lane.ts` holds the geometry and `GraphThumbnail` imports the
 * same function, so the ladder and the registry draw one shape rather than two that
 * resemble each other. The arrowhead is drawn here because the lane arrives out of a
 * horizontal `H` command and `FlowEdge` only knows how to point along its own bezier.
 */
function ReturnLane({ from, to, fromR, toR }: { from: number; to: number; fromR: number; toR: number }) {
  const a = { x: from + fromR + FLOW.edge.gap, y: ROW };
  const b = { x: to - toR - FLOW.edge.gap, y: ROW };
  return (
    <g data-viz="return-lane">
      <path
        d={returnLanePath(a, b, LANE_Y)}
        fill="none"
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.thin}
        strokeOpacity={FLOW.edge.lineOpacity}
      />
      <path
        d={arrowHeadPath([b.x, b.y], [b.x - 10, b.y])}
        fill={toneColor("dim")}
        fillOpacity={FLOW.edge.arrowOpacity}
      />
    </g>
  );
}

/** A group drawn around the whole run, for level 4's harness. A hairline, because a harness
    is present — `VIZ.dash.absent` already means the opposite. */
function Boundary({ label }: { label: string }) {
  return (
    <g data-viz="boundary">
      {/* Every number here is pinned by a word, and `scene-labels.test.ts` found all three.
          The caption at y=8 reached four units above the sheet, and a bottom edge at 96 was
          drawn straight through "plan" and "build" — the station names hang at about 94,
          because `labelOffset` scales off a radius and the violet marks are drawn one unit
          larger than the cyan ones. The box encloses the labels rather than clipping them:
          top at 20 leaves the caption room, bottom at 108 clears the deepest name, and the
          return lane at 28 is inside it, which is correct — the harness runs the loop. */}
      <rect
        x={22}
        y={20}
        width={376}
        height={88}
        rx={5}
        fill="none"
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
      />
      <text data-viz="label" x={30} y={14} fontSize={VIZ.font.sub} fill={toneColor("dim")}>
        {label}
      </text>
    </g>
  );
}

/**
 * The pipeline, with a person at each station named in `people`.
 *
 * One component for all five frames, which is what makes "the same drawing five times" a
 * property of the code rather than a claim in a comment. A caller passes the station
 * indices a person stands at and nothing else; every coordinate, every edge and every label
 * is the same in all five.
 */
function Run({ people, harness }: { people: readonly number[]; harness?: string }) {
  const at = (i: number) => (people.includes(i) ? HR : R);
  return (
    <>
      {harness !== undefined && <Boundary label={harness} />}

      {STATIONS.slice(0, -1).map((s, i) => (
        <Wire key={s.label} from={s.x} to={STATIONS[i + 1].x} fromR={at(i)} toR={at(i + 1)} />
      ))}

      {/* The loop, as an edge: the debugger hands a patch back to the tester and the run
          carries on from there. Present in every frame, because the work is the same work
          at every rung — only who is doing it changes. */}
      <ReturnLane
        from={STATIONS[LOOP_FROM].x}
        to={STATIONS[LOOP_TO].x}
        fromR={at(LOOP_FROM)}
        toR={at(LOOP_TO)}
      />

      {STATIONS.map((s, i) =>
        people.includes(i) ? (
          <HumanFlowNode key={s.label} x={s.x} y={ROW} r={HR} label={s.label} mark="schematic" />
        ) : (
          <FlowNode
            key={s.label}
            x={s.x}
            y={ROW}
            r={R}
            tone="cyan"
            mark="schematic"
            label={s.label}
          />
        ),
      )}
    </>
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
      "The five-phase run (plan, build, test, debug, release) with a person standing at every one of the five.",
    note: "a person at all five",
    body: <Run people={[0, 1, 2, 3, 4]} />,
  },
  2: {
    label:
      "The same five-phase run, with a person at plan, test and release and an agent doing the building and the debugging.",
    note: "a person at three of five",
    body: <Run people={[0, 2, 4]} />,
  },
  3: {
    label:
      "The same five-phase run, with agents at plan, build, test and debug and a person only at release.",
    note: "a person at the end",
    body: <Run people={[4]} />,
  },
  4: {
    label:
      "The same five-phase run, inside a harness, with agents at every station and one person at test: a checkpoint the design chose, with everything after it unattended.",
    note: "a person at one designed checkpoint",
    body: <Run people={[2]} harness="harness" />,
  },
  5: {
    label:
      "The same five-phase run with an agent at every station and no person anywhere in it.",
    note: "nobody stands on the path",
    body: <Run people={[]} />,
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
