"use client";

/* ============================================================
   Spec §3.3 — the division of labour a healthy factory is built on.

   The author asked for it by name: "The explicit division between
   planner, builder, tester, debugger, and deployment should be
   mentioned when indicating what we should expect as high level
   structure of a healthy dark factory."

   ── The graph is not invented, and now something holds it there ──
   Every node, every edge and every label below comes from
   `./roles.ts`, and `./roles.test.ts` checks that file against
   `content/blueprints/starter-software-factory/blueprint.dot` and
   the five cards it names. That matters more here than anywhere
   else on the landing: this section makes two claims the engine
   actually enforces, and a figure drawn from imagination would put
   the site one edit away from asserting something no bundle would
   validate. The reader can open the same graph at
   `/blueprints/starter-software-factory` and check it line by line.

   This comment used to claim the drawing was read off the DOT
   while the labels, the wires and the iteration cap were literals
   typed into the JSX with no test anywhere near them. They were
   correct, and correct by luck: the sibling figure in the hero had
   been parsed against the same file since it was written, and this
   one had nothing.

   ── The two things the drawing exists to show ──

   1. **The loop.** Doc 2 §5.5: "Il loop è `tester → debugger →
      tester`. **Non torna al `builder`.**" Two independent reasons
      that reinforce each other: the work already done is preserved
      rather than regenerated, and the builder stays isolated from
      every fact about the failures for the whole run. The loop is
      bounded by `params.max_iterations` on the debugger's card, and
      §5.5 gives that cap a second job beyond terminating the cycle:
      each turn leaks another slice of the acceptance surface through
      the failure messages, so the cap is also a bound on how much of
      the criteria the debugger can reconstruct by accumulation.

   2. **The absent edge.** Doc 2 §5.2: "la lezione centrale non sta
      in un nodo, sta in un arco che non c'è." Nothing runs from the
      planner to the builder. `FlowAbsence` draws the place it would
      have gone and names the prohibition, and the prohibition is a
      real entry: `code-builder@1.0.0` lists `acceptance-criteria`
      under `cannot`, that entry names a data type in the ontology,
      and the resolver refuses the bundle with
      `bundle/prohibition-violated` if the edge is drawn.

   ── Roles are not the ontology's phases, and the names collide ──
   Spec §3.3: "Getting this wrong would create exactly the
   two-scales confusion §1.1 warns about." The five phases in doc 3
   §2 are `planning`, `implementation`, `testing`, `debugging`,
   `deployment` — near-identical words for a different kind of
   thing. A role is the job a node does in a graph; `phase` is a
   field on a node card, drawn from a closed list, and phase
   coverage is descriptive, so a graph may carry several nodes in
   one phase or none at all. The distinction is stated on the page
   in one line, with `/ontology` beside it.

   ── Why the cap's number can be quoted ──
   `targeted-debugger@1.0.0` is a published version and versions are
   archived side by side in `content/cards/` rather than edited in
   place, which is what the bump engine in `lib/core/version/` is
   for. Changing `params.max_iterations` on it would produce a new
   version and leave 1.0.0 saying what it says today, so a figure
   that quotes the version alongside the number cannot drift away
   from a card that still exists.

   ── Rendering (spec §1) ──
   Every label is real DOM at SSR time. The timeline plays only on
   `useReveal`'s `shown` phase and spends itself on opacity, on
   transform and on `draw`; `static` is the server, no JS and
   reduced motion, and in that phase the markup is already the
   finished drawing.

   ── The register changed under this figure ──
   Redesign spec §1, on the author's verdict about this drawing in
   particular: "the look of [the roles figure] and related figure
   using the same style, I don't like at all. What I like is the
   pattern on the background but not the style of the graph." So the
   graticule is untouched and the CAD boxes are gone. A node is a lit
   disc, a run is a curve with a light travelling it, and the
   placement is imported from `./graph.ts` rather than restated,
   which is what keeps this figure and the landing's second beat the
   same drawing at two magnifications.

   The hand-rolled timeline went with the boxes. `useLuminousFlow`
   owns the entrance for every scene in this register, including the
   rule that the absence arrives last and alone.
   ============================================================ */

import Link from "next/link";

import {
  FLOW,
  FlowAbsence,
  FlowEdge,
  FlowNode,
  FlowScene,
  Sheet,
  VIZ,
  VIZ_INK,
  labelOffset,
  toneColor,
  type Point,
} from "@/components/viz";
import { useLuminousFlow } from "@/components/viz/useLuminousFlow";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { LANDING_NARROW, LANDING_WIDE, type LandingGraph } from "./graph";
import { ROLE_LOOP_CAP, boxProps, wireProps } from "./roles";

/* ==================== the figure ====================

   The five centres come from `./graph.ts`: the planner and the
   tester and the deployer along the top, the builder and the
   debugger beneath them, which puts the loop on one axis and the
   absence on the other so neither has to cross the other to be
   read.

   ── Two placements, and why there had to be ──
   A label inside an `<svg>` is drawn in viewBox units, so its
   rendered size is the label's units times the ratio of pixel width
   to viewBox width. This figure shipped as one 900-unit frame,
   which `container-page` and `Sheet` render at 320 CSS px on a
   402-pixel phone: `FLOW.label.size` landed at **3.9 pixels**, on
   the one branch of the label gate that shows every label
   unconditionally, on the grounds that "below `md` a figure is
   small and the labels are what make it legible at all"
   (`components/viz/flow.ts`). The landing's second beat already
   drew this graph at two magnifications for exactly that reason and
   this page did not.

   The frame is taller than the landing's at both sizes, because
   this figure carries two annotations the landing does not: the cap
   on the loop, and what the deployer leaves behind.
   ==================================================== */

/**
 * One placement of the figure: a graph from `./graph.ts`, plus the room this page's own
 * annotations need under it.
 */
interface RolesPlacement {
  graph: LandingGraph;
  /** Frame height. Taller than the graph's, for the two annotations under the discs. */
  height: number;
  /** Where the two runs that start the graph come in from. */
  offSheet: number;
  /**
   * How far the loop's two arms are moved off the discs they join, along the axis the
   * loop does not run on.
   *
   * A label sits at the midpoint of its own curve, so two arcs between the same pair of
   * discs put "failure evidence" and "patch" on top of each other whatever bend they
   * take. Shifting the endpoints across the run moves the two midpoints apart, which is
   * the only lever that separates the words rather than only the lines.
   */
  loopShift: number;
  /** Which way that shift runs, which follows from how the two discs lie. */
  loopAxis: "x" | "y";
  /**
   * Where each edge's label sits along its own curve, keyed `source-target`. Default 0.5.
   *
   * `loopShift` separates the loop's two labels from each other. It does nothing about the
   * other three labels that crowd the same region once the frame is narrow: on the phone
   * placement "build" landed on "failure evidence", "failure evidence" on the tester's own
   * label, and "patch" on "approved build". Sliding a label along its own curve is the one
   * lever that fixes those without moving a disc and without shortening a word —
   * `roles.test.ts` holds these labels to `blueprint.dot`, so shortening is not available.
   *
   * `roles-labels.test.ts` renders the figure and compares every box, so a number here that
   * stops being enough fails the build rather than shipping as overlapping type.
   */
  labelTs?: Readonly<Record<string, number>>;
  className: string;
}

const PLACEMENTS: readonly RolesPlacement[] = [
  /* The narrow one first, so the phone's markup is the first thing in the document. Its
     loop is vertical (tester above debugger), so the arms shift sideways is the wrong
     axis there and the shift runs down the frame instead. */
  {
    graph: LANDING_NARROW,
    height: LANDING_NARROW.height + 96,
    offSheet: 16,
    loopShift: 34,
    loopAxis: "y",
    labelTs: {
      "builder-tester": 0.32,
      "tester-debugger": 0.66,
      "debugger-tester": 0.4,
      "tester-deployer": 0.36,
    },
    className: "sm:hidden",
  },
  {
    graph: LANDING_WIDE,
    height: LANDING_WIDE.height + 40,
    offSheet: 26,
    loopShift: 26,
    loopAxis: "x",
    /* The wide frame has room; every label stays at the midpoint of its own curve. */
    className: "hidden sm:block",
  },
];

/** The tone every disc takes. Uniform, so the drawing's colour says nothing it should not. */
const NODE_TONE = "cyan" as const;

function RolesFigure({ placement }: { placement: RolesPlacement }) {
  const flow = useLuminousFlow({ amount: 0.2 });
  const { graph, loopShift, loopAxis, offSheet } = placement;
  /* 0.5 is `run.midpoint`, so a placement that names nothing draws exactly as before. */
  const labelT = (key: string): number => placement.labelTs?.[key] ?? 0.5;

  /** Every disc in this figure, at the size `./graph.ts` sets for this frame. */
  const R = graph.nodeRadius;
  /** How far below a disc's centre its own label sits, and therefore where an annotation
      may start without writing over one. */
  const UNDER = labelOffset(R);

  function centre(id: string): Point {
    const node = graph.nodes.find((candidate) => candidate.id === id);
    if (node === undefined) throw new Error(`the roles figure has no place for \`${id}\``);
    return [node.x, node.y];
  }

  /** Move a centre across the loop's own axis, by `by`. */
  function across(point: Point, by: number): Point {
    return loopAxis === "x" ? [point[0] + by, point[1]] : [point[0], point[1] + by];
  }

  const planner = centre("planner");
  const builder = centre("builder");
  const tester = centre("tester");
  const debug = centre("debugger");
  const deployer = centre("deployer");

  /* The loop's two arms, moved off the discs' centres so their labels land apart. */
  const testerOut: Point = across(tester, -loopShift);
  const debugIn: Point = across(debug, -loopShift);
  const debugOut: Point = across(debug, loopShift);
  const testerIn: Point = across(tester, loopShift);

  return (
    <FlowScene
      {...flow.scene}
      id="roles"
      width={graph.width}
      height={placement.height}
      className={placement.className}
      label="Five roles wired in order, with one run deliberately missing"
      description="The planner sends acceptance criteria to the tester and the builder sends its build to the tester. The tester sends failure evidence to the debugger and the debugger sends a patch back, a loop bounded by an iteration cap. The tester sends the approved build to the deployer. Nothing runs from the planner to the builder, and the prohibition that keeps it missing is acceptance-criteria."
    >
      {/* what the run is started with */}
      <FlowEdge
        from={[offSheet, planner[1]]}
        to={planner}
        fromRadius={0}
        toRadius={R}
        tone="dim"
        label="request"
      />
      <FlowEdge
        from={[offSheet, builder[1]]}
        to={builder}
        fromRadius={0}
        toRadius={R}
        tone="dim"
        label="plan"
      />

      <FlowEdge
        from={planner}
        to={tester}
        bend={-FLOW.edge.bend.gentle}
        fromRadius={R}
        toRadius={R}
        {...wireProps("planner", "tester")}
      />
      <FlowEdge
        from={builder}
        to={tester}
        bend={FLOW.edge.bend.gentle}
        fromRadius={R}
        toRadius={R}
        labelT={labelT("builder-tester")}
        {...wireProps("builder", "tester")}
      />

      {/* Doc 2 §5.5. Two arcs taking the same bend and bowing to opposite sides, because
          `edgeControl` offsets perpendicular to the run and the return runs the other way.
          One number, two arcs that separate. */}
      <FlowEdge
        from={testerOut}
        to={debugIn}
        bend={FLOW.edge.bend.wide}
        labelT={labelT("tester-debugger")}
        {...wireProps("tester", "debugger")}
      />
      <FlowEdge
        from={debugOut}
        to={testerIn}
        bend={FLOW.edge.bend.wide}
        labelT={labelT("debugger-tester")}
        {...wireProps("debugger", "tester")}
      />

      <FlowEdge
        from={tester}
        to={deployer}
        bend={-FLOW.edge.bend.gentle}
        fromRadius={R}
        toRadius={R}
        labelT={labelT("tester-deployer")}
        {...wireProps("tester", "deployer")}
      />

      {/* Doc 2 §5.2's absence, drawn in the place it would have gone. `code-builder@1.0.0`
          lists `acceptance-criteria` under `cannot`, so this is a rule the resolver holds
          the graph to and not a convention an author remembered. Its label stays on
          without a pointer, because this is the sentence the whole page is about. */}
      <FlowAbsence
        from={graph.absence.from}
        to={graph.absence.to}
        fromRadius={R}
        toRadius={R}
        label={graph.absence.label}
        id="absent"
      />

      {graph.nodes.map((node) => {
        const box = boxProps(node.id);
        return (
          <FlowNode
            key={node.id}
            id={box.id}
            x={node.x}
            y={node.y}
            r={R}
            label={box.label}
            /* The visible word is the role and the accessible name carries the card
               pinned on it, so a screen reader is told which document to go and open. */
            name={`${box.label}, running ${box.sub}`}
            tone={NODE_TONE}
          />
        );
      })}

      {/* The run ends here. `release-gate@1.0.0` emits nothing onward, so there is no
          outgoing edge to draw and the note says what it leaves behind instead. */}
      <text
        x={deployer[0]}
        y={deployer[1] + UNDER + 16}
        textAnchor="middle"
        fontSize={VIZ.font.sub}
        fill={toneColor("dim")}
      >
        writes the tag and the digest
      </text>

      {/* The cap, attached to the node that declares it. Dashed, and therefore never
          handed to a drawable: `createDrawable` writes `stroke-dasharray`, which is the
          whole of what makes this read as an annotation. */}
      <path
        d={`M ${debug[0]} ${debug[1] + UNDER + 8} L ${debug[0]} ${debug[1] + UNDER + 36}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
        strokeDasharray={VIZ.dash.leader}
      />
      <text
        x={debug[0]}
        y={debug[1] + UNDER + 52}
        textAnchor="middle"
        fontSize={FLOW.label.size}
        fill={VIZ_INK}
      >
        {`${ROLE_LOOP_CAP.param}: ${ROLE_LOOP_CAP.value}`}
      </text>
    </FlowScene>
  );
}

/** Small mono heading, matching the panels on the blueprint pages. */
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
      {children}
    </span>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[0.9em] text-fg">
      {children}
    </code>
  );
}

export function SectionRoles() {
  return (
    <section id="roles" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The shape of the work"
          title="Planner, builder, tester, debugger, deployer"
          lead="A factory that holds up divides the work five ways and writes the division into the graph. Two features of the drawing below carry the whole argument: the loop between the tester and the debugger, and one run that is deliberately missing."
        />

        {/* Spec §3.3 asks for this distinction in one line, on the page, because the two
            vocabularies use nearly the same five words and §1.1's two-scales problem is
            what happens when a reader merges them. */}
        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted">
          These five names are roles, meaning the job each node does in this graph. The
          ontology&rsquo;s five phases read almost the same and describe something else:{" "}
          <Code>phase</Code> is a field on a node card, drawn from a closed list, and a
          graph may hold several nodes in one phase or none at all.{" "}
          <Link
            href="/ontology"
            className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
          >
            The phases are on the ontology page
          </Link>
          .
        </p>

        <Sheet
          className="mt-8"
          label="DRW-003 · roles, wired in order"
          title="starter-software-factory"
          note="five nodes, five edges, one absence"
        >
          {PLACEMENTS.map((placement) => (
            <RolesFigure key={placement.className} placement={placement} />
          ))}
          {/* The cap's sentence sits here rather than inside the drawing. As an SVG
              `<text>` it was one unwrappable line: 55 characters centred on the debugger
              spans 336 units, and the narrow frame is 360 wide, so a fifth of it was
              clipped off the right edge on every phone. HTML wraps, and the number itself
              stays on the sheet where the dashed leader points at it. */}
          <p className="mt-1 text-center font-mono text-[11px] leading-relaxed text-dim">
            {`the cap on the loop, declared on ${ROLE_LOOP_CAP.card}`}
          </p>
        </Sheet>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* ---------- the loop ---------- */}
          <div className="panel flex flex-col gap-3 p-6">
            <PanelLabel>The loop, and what stops it</PanelLabel>
            <h3 className="font-display text-lg font-semibold text-fg">
              The tester hands failures to the debugger, and the debugger hands a patch
              back
            </h3>
            <p className="text-sm leading-relaxed text-muted">
              The cycle runs between those two and never returns to the builder. Two
              reasons hold it there. The work already done is preserved instead of
              regenerated from scratch, and the builder stays away from every fact about
              the failures for the length of the run.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              The obvious objection: if the builder may not read the criteria, why may the
              debugger read the failures? Reading the criteria lets a node write work
              shaped to pass them. Reading the evidence of a failure it caused says only
              what broke.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              <Code>max_iterations</Code> is what makes the cycle finite, and it bounds a
              second thing as well. Every turn reveals another slice of the acceptance
              surface through the failure messages, so the number of turns is the number
              of slices.{" "}
              <Link
                href="/nodes/targeted-debugger"
                className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
              >
                Read the debugger&rsquo;s card
              </Link>
              .
            </p>
          </div>

          {/* ---------- the absent edge ---------- */}
          <div className="panel flex flex-col gap-3 p-6">
            <PanelLabel>The run that is missing</PanelLabel>
            <h3 className="font-display text-lg font-semibold text-fg">
              The planner&rsquo;s acceptance criteria never reach the builder
            </h3>
            <p className="text-sm leading-relaxed text-muted">
              They go to the node that judges the work and to nothing else. The builder is
              handed its brief when the run is instantiated, which is why the two nodes
              have no edge between them at all, and why the gap in the drawing is the
              design rather than an omission.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              The prohibition is written down. <Code>code-builder@1.0.0</Code> lists{" "}
              <Code>acceptance-criteria</Code> under <Code>cannot</Code>, and that entry
              names a data type in the ontology, so the resolver holds the graph to it.
              Draw the edge and the bundle fails with{" "}
              <Code>bundle/prohibition-violated</Code>.{" "}
              <Link
                href="/nodes/code-builder"
                className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
              >
                Read the builder&rsquo;s card
              </Link>
              .
            </p>
          </div>
        </div>

        {/* §1.1 again, at the one moment a reader might take the drawing for a target:
            the division of labour says nothing about where a person stands inside it.

            The sentence used to say Guarded Merge Bot "uses the same five roles", which is
            false in three ways its own blueprint page prints. That graph has six nodes and
            no debugger, so `/blueprints/guarded-merge-bot` renders "□ Debugging  No node in
            this graph."; its red re-entry `tests -> draft` returns to `review-drafter`,
            whose `phase: implementation` makes it the builder, against the panel above; and
            `pr -> triage -> draft` wires planning straight into implementation, so there is
            no absent edge there either. The claim the paragraph needs is only the last
            clause, `gate -> merge [label="human approve"]`, which is true. */}
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">
          The division says nothing about where a person stands in it.{" "}
          <Link
            href="/blueprints/guarded-merge-bot"
            className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
          >
            Guarded Merge Bot
          </Link>{" "}
          divides the same work its own way and holds the run at the merge for a maintainer
          to approve, and it is shelved beside the rest.{" "}
          <Link
            href="/blueprints/starter-software-factory"
            className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
          >
            Open the graph drawn above
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
