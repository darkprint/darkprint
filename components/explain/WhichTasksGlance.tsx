"use client";

import {
  FLOW,
  FlowEdge,
  FlowNode,
  FlowScene,
  HumanFlowNode,
  Sheet,
} from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";

/* ============================================================
   Spec §4.3, and the author's sentence behind it: "you need to
   make people get in a glance the concepts."

   The section under this figure is right and it was long. So it
   opens with the whole argument as one drawing, and the drawing
   has to carry four things:

     1. there are four questions and they are asked in series;
     2. a no on 01, 02 or 03 names something missing that you can
        go and supply, so it is a state of the task rather than a
        verdict on it;
     3. a no on 04 is answered by a person standing at the step
        where a mistake gets expensive, which is a design and not
        a consolation (doc 2 §1.1, and `HumanFlowNode` is violet by
        construction so this branch cannot be drawn as a defect);
     4. four yeses mean the task is a candidate.

   Every reading below restates a sentence the sections underneath
   state in full, and the numbering is the numbering
   `WhichTasksChecks` uses, so a reader who scans the figure and
   then reads the page meets the same four things twice under the
   same names.

   ── Redesign spec §1 ──
   The boxed register the author rejected carried a second line
   under each gate. This one does not, so each gate says its number
   and its handle and the question itself is the card underneath.
   Labels stay `always` here: the four words are the argument, and
   a figure whose meaning waits for a pointer is a broken figure.

   ── Two placements, because one of them was 42% off the screen ──
   The figure used to be one 660-unit frame in an `overflow-x-auto`
   box with `min-w-[34rem]`. Measured at 390: clientWidth 316
   against scrollWidth 544, so 42% of the drawing was off the right
   edge of a phone — including "04 cost", "a good fit" and "before
   the expensive step", which are the two branches and the outcome.
   It photographed as a crop, and this is the opening argument of
   the page a reader is meant to take in at a glance.

   The narrowest viewport this site lays out for renders 278 CSS px
   of `<svg>` (`FLOW.frame.phone - FLOW.frame.chrome`), so a frame
   has to be about 360 units wide or narrower for a 13-unit label to
   clear `FLOW.frame.legible`. 660 cannot be squeezed to that. So
   the wide frame stays for `sm` and up — where the sheet is at
   least 544 px and its labels land at 10.7 — and a portrait frame
   of the same drawing takes over below it, turned through ninety
   degrees: the four questions run DOWN a thread and the two
   branches go out to the right. That is `PhaseStrip`'s standing
   proof applied here, and its labels land at 11.8 CSS px on a
   390-pixel phone against the 6.2 a squeezed 660 would have given.

   `components/viz/scene-labels.test.ts` measures both frames, which
   is why its roster entry says two. Neither placement is a
   simplification of the other: every node, every branch and every
   word is in both.

   ── Amber left this figure (2026-08-07) ──
   The three "supply what is missing" arcs and the disc they land on
   were amber, and this comment used to argue for it: amber as "the
   colour of something missing you can go and get", with the fourth
   branch dim so that a person standing where a mistake gets
   expensive could not be read as a shortfall.

   The distinction is right and it is preserved. The colour was not
   available. Amber has exactly two jobs on this site — `ComingSoonBadge`
   ("not built yet") and `.route-box` ("this box leaves the page") —
   and a third meaning for it, however well argued locally, is what
   makes the other two stop working. It fired five ways on this
   material alone: three arcs, a disc, a caption callout, plus the
   two pager cards.

   Cyan carries them now, which is what cyan already means
   everywhere else here: the run that carries work. A no on 01 to 03
   sends you to fetch something and then back onto the same
   pipeline, so the loop is drawn in the pipeline's own colour. The
   fourth branch stays `dim` and still lands on a violet mark, so
   the one distinction that comment was protecting is exactly as
   visible as it was. Amber now fires twice on this whole route: the
   pager's two cards.
   ============================================================ */

/**
 * The wide frame. Read left to right, four questions on one line.
 *
 * `sm` and up only. See the header for the measurement.
 */
const WIDE = {
  width: 660,
  height: 300,
  /** The four questions and the outcome, on one line. */
  row: 92,
  /** Where a no lands. */
  branch: 232,
  /** The four, in the order and under the names `WhichTasksChecks` gives them. */
  gates: [78, 208, 338, 468],
  fits: { x: 600, y: 92 },
  supply: { x: 248, y: 232 },
  person: { x: 470, y: 232 },
} as const;

/**
 * The portrait frame, for everything below `sm`.
 *
 * 340 units wide, which renders at 11.8 CSS px per label on a 390-pixel phone and 10.6 on
 * the 360 `FLOW.frame` calls the floor — both clear of `FLOW.frame.legible`.
 *
 * Every number here is pinned by a word. The thread sits at x=66 because the widest gate
 * label ("01 verdict", "02 harness") is ten characters of 13-unit type, 81 units wide,
 * centred: any further left and it starts off the sheet. The two branch points sit at
 * x≈230 because "before the expensive step" is 24 characters, 193 units, and centred there
 * it ends 15 units short of the right edge. The rows are 88 units apart, which is what
 * keeps an edge's own "no" — written 8 units above the midpoint of its curve — off the
 * baseline of the gate label it passes.
 */
const TALL = {
  width: 340,
  height: 470,
  /** The thread the four questions hang on. */
  x: 66,
  gates: [40, 128, 216, 304],
  fits: { x: 66, y: 428 },
  supply: { x: 232, y: 268 },
  person: { x: 228, y: 392 },
} as const;

/** The four, in the order and under the names `WhichTasksChecks` gives them. */
const GATES = [
  { id: "verdict", label: "01 verdict" },
  { id: "harness", label: "02 harness" },
  { id: "edges", label: "03 edges" },
  { id: "blast", label: "04 cost" },
] as const;

const FITS_LABEL = "a good fit";
const SUPPLY_LABEL = "supply what is missing";
const PERSON_LABEL = "before the expensive step";

/** The accessible description. One string, because the drawing is one drawing. */
const DESCRIPTION =
  "A task enters four questions in order: the verdict, the harness, the edges, and the cost of being wrong. A no on the first three branches to supplying what is missing. A no on the fourth branches to a person standing at that step. Four yeses reach a point reading that the task is a good fit.";

/**
 * One placement, as the centre of every point in it.
 *
 * The two frames differ in geometry and in nothing else: same points, same runs, same
 * words, same tones. Writing the scene once against a table of centres is what keeps them
 * from drifting into two drawings that say different things.
 */
interface Place {
  width: number;
  height: number;
  /** Centre of gate `i`. */
  gate: (i: number) => [number, number];
  fits: [number, number];
  supply: [number, number];
  person: [number, number];
  className?: string;
}

const WIDE_PLACE: Place = {
  width: WIDE.width,
  height: WIDE.height,
  gate: (i) => [WIDE.gates[i], WIDE.row],
  fits: [WIDE.fits.x, WIDE.fits.y],
  supply: [WIDE.supply.x, WIDE.supply.y],
  person: [WIDE.person.x, WIDE.person.y],
  /* The sheet may not squeeze this frame below the width its labels were sized for. Under
     `sm` the portrait placement is the one on screen, so this cap is never the reason a
     page scrolls sideways. */
  className: "min-w-[34rem]",
};

const TALL_PLACE: Place = {
  width: TALL.width,
  height: TALL.height,
  gate: (i) => [TALL.x, TALL.gates[i]],
  fits: [TALL.fits.x, TALL.fits.y],
  supply: [TALL.supply.x, TALL.supply.y],
  person: [TALL.person.x, TALL.person.y],
};

function GlanceScene({ place }: { place: Place }) {
  const flow = useLuminousFlow({ amount: 0.25 });

  return (
    <FlowScene
      {...flow.scene}
      width={place.width}
      height={place.height}
      className={place.className}
      label="Four questions, asked in order"
      description={DESCRIPTION}
    >
      {/* ---------- the spine, one gate to the next ---------- */}
      {GATES.slice(0, -1).map((gate, index) => (
        <FlowEdge
          key={gate.id}
          from={place.gate(index)}
          to={place.gate(index + 1)}
          tone="cyan"
          id={`${gate.id}-next`}
        />
      ))}
      <FlowEdge from={place.gate(3)} to={place.fits} tone="emerald" id="to-fits" />

      {/* ---------- what a no leads to ---------- */}
      {/* Cyan, not amber. See the header: a no here names something you can go and fetch,
          after which the task rejoins the same pipeline, and the pipeline is cyan
          everywhere on this site. */}
      {GATES.slice(0, 3).map((gate, index) => (
        <FlowEdge
          key={`${gate.id}-no`}
          from={place.gate(index)}
          to={place.supply}
          bend={FLOW.edge.bend.gentle}
          tone="cyan"
          label="no"
          name={`no on ${gate.label}, supply what is missing`}
          id={`${gate.id}-no`}
        />
      ))}
      <FlowEdge
        from={place.gate(3)}
        to={place.person}
        toRadius={9}
        tone="dim"
        label="no"
        name="no on 04, a person stands at that step"
        id="blast-no"
      />

      {/* ---------- the points ---------- */}
      <FlowNode
        x={place.supply[0]}
        y={place.supply[1]}
        label={SUPPLY_LABEL}
        tone="cyan"
        reveal="always"
        id="supply"
      />
      {/* Doc 2 §1.1: the answer to a task whose failure lands in production is a graph
          with somebody standing in it, and that is a design decision. The mark is violet
          because `HumanFlowNode` cannot be painted any other colour. It is the only mark
          in the drawing that is neither the pipeline nor the verdict, which is what the
          recolour above buys back: the person is now the one thing on the sheet with a
          colour of their own. */}
      <HumanFlowNode
        x={place.person[0]}
        y={place.person[1]}
        label={PERSON_LABEL}
        reveal="always"
        id="person"
      />
      {GATES.map((gate, index) => (
        <FlowNode
          key={gate.id}
          x={place.gate(index)[0]}
          y={place.gate(index)[1]}
          label={gate.label}
          tone="cyan"
          reveal="always"
          id={gate.id}
        />
      ))}
      <FlowNode
        x={place.fits[0]}
        y={place.fits[1]}
        label={FITS_LABEL}
        tone="emerald"
        lit
        reveal="always"
        id="fits"
      />
    </FlowScene>
  );
}

export function WhichTasksGlance() {
  return (
    /* One column at every width. The drawing and its 117-word caption sat side by side
       from `lg` up, which put the whole of the route's opening argument on one screen
       beside the figure it explains and asked a reader to take both at once. The author:
       "too information condensed in a 16:9 page. Think a user like it is a child where
       you need to point the attention to a concept at time."

       `lg:w-[30rem] lg:shrink-0` goes with the `lg:flex-row` it was sized for. Left
       behind, the drawing keeps a desktop column width under a now full-width caption,
       which is the same figure in a worse place. */
    <figure className="flex flex-col gap-4">
      {/* The portrait sheet is first in the document, the way `SectionRoles` orders its
          two placements, so the markup a phone reads is the markup a phone shows. Only one
          of the two is ever laid out; both are the same drawing. */}
      <Sheet
        label="Read this first"
        title="Four questions, asked in order"
        bodyClassName="p-3 sm:p-4"
        className="sm:hidden"
      >
        <GlanceScene place={TALL_PLACE} />
      </Sheet>
      <Sheet
        label="Read this first"
        title="Four questions, asked in order"
        bodyClassName="p-3 sm:p-4"
        className="hidden sm:block"
      >
        {/* Still a scroll container above `sm`, and it now has nothing to scroll on the
            widths that used to hide 42% of the drawing: between `sm` and the width at
            which the sheet exceeds 34rem the frame is at its floor rather than squeezed,
            and below `sm` the portrait placement is what is on screen. */}
        <div className="overflow-x-auto">
          <GlanceScene place={WIDE_PLACE} />
        </div>
      </Sheet>

      {/* The length pass (PROJECT.md §3.1). Two sentences left this caption and both were
          second copies: "that property belongs to the task, and it is fixed before you
          draw a single node", which is the section's own lead one paragraph up, and the
          tally reading's restatement of what a no on 04 does, which the paragraph directly
          above it now carries alone. `WhichTasksRemedies` used to open its third card with
          this caption's 04 sentence word for word; that copy is the one that went, and this
          is the one that stayed, because it stands beside the branch it describes. */}
      {/* The scale pass put `.prose-lane` on it. This caption is body prose and it had no
          measure at all, so on a 1440 it ran the full 1152px container — roughly 180
          characters a line at 14px, the widest paragraph on the route, sitting directly
          under a figure whose whole job is to be taken in at a glance. The drawing keeps
          the container; the reading of it does not, which is the rule `FigureFrame`
          already carries wherever a spec figure is drawn.

          The two callouts are `.label`. They were `tracking-[0.14em]` at 11px, which is
          the 14px tier's tracking on the 11px tier's size — the exact collision the three
          mono tiers were separated to make impossible. Their colours still quote the
          figure's own two branches, which is why the first one moved from amber to cyan
          when the arcs above it did: the callout and the branch have to be the same
          colour or the caption is reading a drawing that is not there. */}
      <figcaption className="prose-lane flex flex-col gap-4 text-sm leading-relaxed text-muted lg:pt-2">
        <p>
          A dark factory runs with nobody watching it, so the design rests on one property
          of the work: whether something other than your judgement can tell the
          graph it is finished.
        </p>
        <p>
          <span className="label text-cyan">01 to 03</span>{" "}
          name something missing you can supply: a harness nobody has written, a target
          nobody has decided. Answer them and ask again.
        </p>
        <p>
          <span className="label text-violet">04</span>{" "}
          works differently. No amount of coverage makes a wrong answer cheap once it is in
          production, so the graph changes instead of the task: a person at the step where a
          mistake becomes expensive, everything upstream running unattended.
        </p>
        {/* The tally reading, denied where the four are first counted. Doc 2 §1.1 is about
            the autonomy class rather than this page, and the failure mode is the same
            shape: turn four questions into a score and people optimise the score. */}
        <p className="border-l-2 border-cyan/50 pl-4 text-dim">
          So do not add these up. Four yeses mean the task is a good fit.
        </p>
      </figcaption>
    </figure>
  );
}
