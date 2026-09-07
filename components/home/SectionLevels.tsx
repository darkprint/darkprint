/* ============================================================
   The ladder: four levels of working with coding agents, turned
   toward the reader so they can find where they stand.

   Three jobs, in this order: put the reader somewhere, land the hook
   that the gap to the top is architectural and organisational rather
   than technological, and keep the per-blueprint autonomy class from
   inheriting the ladder's sense of a destination. Nothing in this file
   may teach a reader to optimise a number: the levels describe an
   organisation, the class describes one graph, and no arrow, progress
   track or wording makes level 2 a deficiency.

   The four drawings are the same figure four times, a path from a
   request to a shipped change, and the only thing that differs is who
   is standing on it. That does the work structurally: the levels are
   co-ordinate because they share one frame and one size, a person on
   the path is drawn in the violet the site reserves for where somebody
   acts and never for a fault, and level 4 has no human mark because
   its own sentence says nobody is standing on the path.

   The drawing is finished markup at SSR time and the reveal spends
   itself on opacity and transform; `useReveal` returns `static` on the
   server, without JS and under reduced motion.
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
import { SectionHeading } from "@/components/ui/SectionHeading";

type Level = {
  n: 1 | 2 | 3 | 4;
  name: string;
  body: string;
  /** The one the reader is most likely standing on. Stated, never styled as a fault. */
  you?: boolean;
};

/**
 * The four rungs: the linked article's numbering, in this site's words.
 *
 * The distinction each rung turns on is the article's: the model completes what you are
 * typing; an agent writes whole files and every change passes your review; an agent works
 * from a spec, unseen scenarios gate it and you approve the merge; specs in, merged tested
 * code out, your existing pipeline deploys it. The article's half step at 3.5, where some
 * services auto-merge, is a rollout rather than a place to stand, so it is not a rung
 * here; the gate below still says what it said by being the one thing separating 3 from 4.
 *
 * The sentences are this site's, because the article's rows are written for its reader
 * and these have to name the phases this site's vocabulary closes over. `levels.test.ts`
 * holds the names and the numbering.
 */
const LEVELS: Level[] = [
  {
    n: 1,
    name: "Autocomplete",
    body: "The model finishes the line you are typing. Everything else on the run is yours: you plan it, build it, test it, debug it and release it.",
  },
  {
    n: 2,
    name: "Reviewed generation",
    body: "An agent writes whole functions and files. Every change passes under your eye before it lands, so you are on the critical path for all of them.",
    you: true,
  },
  {
    n: 3,
    name: "Spec-driven",
    body: "An agent works from a specification inside a harness, and test scenarios the agent never saw decide whether what came back is good enough. You approve the merge, every time.",
  },
  {
    n: 4,
    name: "Dark factory",
    body: "A specification goes in. Tested and merged code comes out. The pipeline you already have deploys it. The harness is the same one as level 3; the approval checkpoint is gone and every other constraint stays.",
  },
];

type Source = { title: string; where: string; href: string; note: string };

/**
 * The two sources the page credits. Every URL is real, and every note says only what the
 * source supports: the article runs a ladder of its own to level 4 with a half step at
 * 3.5 and gives no rung a name, so it is credited with the account of the climb and not
 * with the names.
 */
const SOURCES: Source[] = [
  {
    title: "The Dark Factory Pattern: Moving From AI-Assisted to Fully Autonomous Coding",
    where: "HackerNoon",
    href: "https://hackernoon.com/the-dark-factory-pattern-moving-from-ai-assisted-to-fully-autonomous-coding",
    note: "One team's account of the climb, and the source this framing is borrowed from. The four rungs above are numbered as the article numbers them; the article also has a half step at 3.5, which this ladder leaves out.",
  },
  {
    title: "strongdm/attractor",
    where: "GitHub",
    href: "https://github.com/strongdm/attractor",
    /* "written to Attractor's specification" and not "a graph it can run": StrongDM
       published a specification and no source, so nothing in this repository has ever run
       Attractor on an export. The exporter proves conformance to the spec, never execution. */
    note: "The runner this site keeps its files compatible with. StrongDM published the specification of Attractor, its graph runner, and no source code; a DarkPrint topology exports to a graph written to Attractor's specification.",
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

/**
 * The merge gate: where a person sits when they are approving a machine's work rather than
 * doing a phase of it.
 *
 * It is OFF the row on purpose. A person drawn at `release` says they are the one releasing,
 * which is levels 1 and 2; from level 3 up the release is the agent's and what the person
 * does is let it through. That is a decision on an EDGE, so it is drawn on the edge —
 * halfway between debug and release, on the lane above the row.
 *
 * The gate is what makes the top three rungs one picture with one variable, which is the
 * whole of what the author asked for:
 *
 *   3   every run goes through the gate, and the direct run does not exist
 *   4   only the direct run, and no gate
 *
 * A middle state where both runs are drawn — the source's 3.5 — was built and removed with
 * that rung. The two-armed prop it needed is gone with it: `gate` is a boolean, and what it
 * answers is the one question separating the top two rungs.
 *
 * y=34 rather than the return lane's 28: an 8-unit mark centred at 28 would touch the
 * harness box's top edge at 20, and `scene-labels.test.ts` fails a box edge drawn through a
 * word. At 34 the mark spans 26–42 and its label lands near 54, clear of the station discs
 * whose tops are at 65.
 *
 * x=318 is the midpoint of debug and release, and the return lane it shares a corridor with
 * runs from 204 to 280, so the two never overlap.
 */
const GATE = { x: 318, y: 34 } as const;

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

/** The harness, drawn as a group around the whole run. A hairline, because a harness is
    PRESENT — `VIZ.dash.absent` already means the opposite.

    On levels 4 and 5, not on 4 alone. The author: "The dark factory itself has a harness."
    The source agrees and is the reason this was wrong: it lists what the harness is —
    sandboxes, CI/CD, policy engines, testing layers, observability — and says the dark
    factory "depends entirely on this layered control system". Drawing level 5 as a bare row
    of discs said a factory graduates OUT of its constraints, which is the opposite claim and
    the dangerous one on a page whose second half is a filter for work that must not be run
    unattended.

    So the boundary is identical in both frames and only the person differs, which is the
    property this whole file is built on. */
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
function Run({
  people,
  harness,
  loop = false,
  gate,
}: {
  people: readonly number[];
  harness?: string;
  /**
   * Whether the run closes on itself — debug hands a patch back to test and the run
   * carries on — WITHOUT anyone deciding that it should.
   *
   * The author, 2026-08-08: "why does each graphic show a loop between test and debug? Not
   * in every step such edge loop exists. You should introduce only when it is really
   * present."
   *
   * It was in all five, and the comment that put it there argued "the work is the same work
   * at every rung — only who is doing it changes." That is true of the WORK and false of
   * the drawing. These frames draw what the system does unattended, and at the first two
   * rungs the return is a person's hand: they read the failure, they decide to patch, they
   * run the tests again. Drawing a machine lane there credits the system with the one
   * behaviour the source treats as the whole threshold.
   *
   * The linked HackerNoon piece is explicit that the closed loop is what separates assisted
   * from autonomous — "the workflow becomes closed-loop: the agent observes the current
   * state of the system, takes an action, measures the result, and decides what to do next",
   * and its examples are exactly this edge ("if a test fails, it reads the failure and
   * patches the implementation"). So the lane appears at level 3 and stays: level 3's own
   * sentence is "running what it wrote and reading the output before it decides what to do
   * next", which IS the lane.
   */
  loop?: boolean;
  /**
   * Whether a person has to let the run through before it releases, and whether every run
   * goes that way.
   *
   * True at level 3 — "you approve the merge, every time" — and the direct run from debug to
   * release is then NOT drawn: there is no path to release that does not pass the gate.
   * Level 4 passes nothing and keeps only the direct run. See `GATE`.
   */
  gate?: boolean;
}) {
  const at = (i: number) => (people.includes(i) ? HR : R);
  /* The last forward run, debug → release, is the one the gate is about. At `"all"` it is
     replaced by the two legs through the gate rather than drawn beside them. */
  const forward = STATIONS.slice(0, gate === true ? -2 : -1);
  return (
    <>
      {harness !== undefined && <Boundary label={harness} />}

      {forward.map((s, i) => (
        <Wire key={s.label} from={s.x} to={STATIONS[i + 1].x} fromR={at(i)} toR={at(i + 1)} />
      ))}

      {gate === true && (
        <>
          <FlowEdge
            from={[STATIONS[3].x, ROW]}
            to={[GATE.x, GATE.y]}
            fromRadius={at(3)}
            toRadius={HR}
            pulse={false}
          />
          <FlowEdge
            from={[GATE.x, GATE.y]}
            to={[STATIONS[4].x, ROW]}
            fromRadius={HR}
            toRadius={at(4)}
            pulse={false}
          />
          <HumanFlowNode x={GATE.x} y={GATE.y} r={HR} label="approve" mark="schematic" />
        </>
      )}

      {loop && (
        <ReturnLane
          from={STATIONS[LOOP_FROM].x}
          to={STATIONS[LOOP_TO].x}
          fromR={at(LOOP_FROM)}
          toR={at(LOOP_TO)}
        />
      )}

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
 *
 * ── What differs between two frames, and what may not ──
 * Three things, and each one is a claim the level's own sentence makes:
 *
 *   who stands where   violet marks. 5 → 3 → 1 → 1 → 0.
 *   the return lane    whether the run patches and re-tests without being told to.
 *                      Absent at 1 and 2, present from 3 on.
 *   the harness        the box around the run. Absent below 3, present at 3 and 4.
 *   the merge gate     whether a person has to let the run through. Present at 3, gone
 *                      at 4, and it is the ONLY thing those two frames disagree about.
 *
 * Everything else — the five stations, their positions, their names, the four forward
 * runs, the frame — is identical in all five, which is what lets a reader answer "how much
 * of this runs unattended" by scanning the column rather than by reading five pictures.
 *
 * The last two of those three were wrong until 2026-08-08 and the author caught both. The
 * lane was in every frame; the harness was in one. Both are now read off the linked source
 * rather than off a claim in a comment — see `Run`'s `loop` and `Boundary`.
 */
const DRAWINGS: Record<Level["n"], LevelDrawing> = {
  1: {
    label:
      "The five-phase run (plan, build, test, debug, release) with a person standing at every one of the five. No harness. No return run. When a test fails, the person carries the work back.",
    note: "a person at all five",
    body: <Run people={[0, 1, 2, 3, 4]} />,
  },
  2: {
    label:
      "The same five-phase run, with a person at plan, test and release and an agent doing the building and the debugging. Still no return run. The person reads a failure and decides to go round again.",
    note: "a person at three of five",
    body: <Run people={[0, 2, 4]} />,
  },
  3: {
    label:
      "The same five-phase run, inside a harness, with an agent at every one of the five. A return run goes from debug back to test, and the only way to reach release is through a person marked approve.",
    note: "every run stops at a person",
    body: <Run people={[]} harness="harness" loop gate />,
  },
  4: {
    label:
      "The same five-phase run, its return run and the same harness. An agent works at every station. The run goes direct to release. No person is anywhere inside it.",
    note: "the same harness, nobody in it",
    body: <Run people={[]} harness="harness" loop />,
  },
};

/** One comparison row. Keeping every drawing on the same side makes changes scannable. */
function LevelRow({ level }: { level: Level }) {
  const drawing = DRAWINGS[level.n];

  return (
    <li className="grid items-center gap-6 md:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] md:gap-10">
      <div className="flex flex-col gap-3">
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

      {/* Off the drafting paper, and the strip moves to the foot. 2026-08-11, from the mock.
          ------------------------------------------------------------
          The drawing itself was already right — `SCENE` is 420x116, which is the mock's
          viewBox to the unit — and every difference a reader could see was `Sheet`'s chrome
          around it:

            · the blueprint register put a 96px graticule and four corner ticks under four
              figures whose subject is who ACTS at each phase, not what a blueprint looks
              like. The mock fills them flat with `--color-surface-2` and frames them in
              `--color-line`, which is what the level cards on the left are already drawn in,
              so the row reads as one object rather than as a caption beside a blueprint.
            · `label` draws a strip along the TOP. The mock has one strip, at the foot,
              carrying both texts — `title` on the left and `note` on the right — which is
              what `Sheet`'s title block is for and is the shape every other sheet on the
              site uses. A top strip made the figure open on its own name before the drawing.

          `border`, `surface` and `paper` are the three opt-ins added to `Sheet` for the
          landing's beat 2, which took its two panels off the graticule for the same reason:
          neither figure is a drawing OF a blueprint. This is their second caller and the
          register still holds everywhere else. */}
      <Sheet
        border="var(--color-line)"
        surface="var(--color-surface-2)"
        paper={false}
        title={`level ${level.n} · who acts where`}
        bodyClassName="p-5"
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

/* ============================================================
   Three bands, since 2026-08-11, where this was one flowing section.

   The route was a single `bg-surface` column carrying the ladder, the gap and the sources
   one after another, with the only seams inside it: a rounded card around the gap and a
   `border-t` above the sources. `/spec/ontology` had already set the pattern the rest of
   this nav group uses — full-bleed bands, a hairline seam at every edge, and the ground
   alternating between `--color-void` and `--color-surface` so a reader can see where one
   subject stops without reading to find out.

   So the three parts become those three bands and nothing inside them moves: the four level
   rows, their scenes, the gap's card and the two sources are the same markup they were. The
   author compared these figures against a single consolidated matrix (option 3a of the mock)
   and chose to keep them, so this pass is the page's spine and not its content.

   ── The last band is shared with the pager ──
   `app/towards-a-dark-factory/page.tsx` closes on `SpecPager`, and 4a puts the sources and
   that pager on one ground. The seam between them is therefore drawn by neither: this file
   ends its own band without a bottom rule and the page's pager band carries no `border-t`,
   so the two read as one. It is the only coupling between the two files and it is written
   down at both ends.
   ============================================================ */
export function SectionLevels() {
  return (
    <>
      <section
        id="levels"
        aria-labelledby="levels-heading"
        className="scroll-mt-24 border-t border-line bg-surface py-16 sm:py-20"
      >
      <div className="container-page">
        {/* The two-line band header the other bands on this route use: a `.label-lead` over
            the `h2`, rather than `SectionHeading`'s cyan `.eyebrow`.

            `.eyebrow` names a page or a full-bleed band and is rationed to one of each, and
            this route's `h1` has spent it; `.label-lead` titles a block, which is what this
            is. It also puts the ladder's header in the same register as `/spec/ontology`'s
            three bands, which is the pattern 4a is copying.

            `SectionHeading` still draws the title and the lead, because its `h2` step is
            exactly the size that page hand-rolls as `BAND_H2` — the same four declarations,
            one of them a component that already exists. */}
        <div className="flex flex-col gap-3">
          <span className="label-lead">Where you are today</span>
          <SectionHeading
            as="h2"
            title={<span id="levels-heading">Most teams are at level 2</span>}
            /* Two sentences where there were three clauses. It read "Before the rest of this
               makes sense, find yourself on the list. It describes how far along a team is
               with agents, and where you land decides which problem you actually have" — and
               the middle clause described the list a reader is looking at, which the four
               rows under it do better than a sentence can. What is left is the instruction
               and the reason for it. */
            lead="Find yourself on the ladder first. Where you land decides which problem you have."
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-y border-line py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-violet bg-violet/25" />
            person acts here
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-cyan bg-cyan/25" />
            agent runs phase
          </span>
          <span>↩ the return path from debug back to test, drawn only where the harness closes the loop itself</span>
        </div>

        {/* One coordinate system, four times. Copy stays on the left and the drawing on
            the right so the actor marks can be compared vertically without zig-zagging. */}
        <ol className="mt-12 flex flex-col gap-14 sm:gap-16">
          {LEVELS.map((l) => (
            <LevelRow key={l.n} level={l} />
          ))}
        </ol>

      </div>
      </section>

      {/* ---------- the gap ----------
          Doc 2 §1's hook, and a band of its own on `--color-void` since 2026-08-11. The one
          sentence that does the positioning, addressable since the rail listed it as this
          stop's second section, and now separated from the ladder by a ground rather than by
          40px of margin: it is the conclusion the four rows above are for, and it was reading
          as a fifth thing in the list.

          `scroll-mt-24` on the same tag as the id, the way `anchors.test.ts` requires, and
          the same offset `#levels` uses so a fragment never lands under the sticky header.
          The card keeps its own frame — a cyan-bordered panel on the void is the one figure
          on this route that is a claim rather than a drawing. */}
      <section
        id="the-gap"
        className="scroll-mt-24 border-t border-line bg-void py-16 sm:py-20"
      >
      <div className="container-page">
        <div
          className="rounded-lg border border-cyan/30 bg-cyan/5 p-6 sm:p-8"
        >
          <p className="max-w-3xl font-display text-xl leading-snug text-fg sm:text-2xl">
            The gap between level 2 and level 4 is architectural and organisational.
          </p>
          {/* Full width, on the author's instruction 2026-08-07: `max-w-3xl` off this
              paragraph. The line above it keeps its cap — it is one display-size sentence
              and a 48rem measure is what stops it running as a banner. */}
          <p className="mt-4 text-base leading-relaxed text-muted">
            The technology to run at level 4 already exists. The patterns for structuring
            the work are missing: what each agent is handed, and what each one is kept
            away from. Better models will not supply that. This site collects designs.
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

      </div>
      </section>

      {/* ---------- sources ----------
          Headed since it was written and addressable since 2026-08-11. The `h3` was already
          the label the rail uses; all it lacked was an id to point the row at.

          Its own band on `--color-surface` now, and the last one on the route: the page's
          `SpecPager` sits on the same ground with no rule between them, so the two read as
          one closing band. That is why this section draws no bottom edge of its own. */}
      <section
        id="sources"
        className="scroll-mt-24 border-t border-line bg-surface py-16 sm:py-20"
      >
        <div className="container-page">
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
      </section>
    </>
  );
}
