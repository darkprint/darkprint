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
   correct, and correct by luck: the sibling figure in
   `components/hero/` has been parsed against the same file since
   it was written, and this one had nothing.

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
      planner to the builder. `AbsentEdge` draws the place it would
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
   Every label is real DOM at SSR time. The anime.js timeline plays
   only on `useReveal`'s `shown` phase and spends itself on opacity
   and on `draw`; `static` is the server, no JS and reduced motion,
   and in that phase the markup is already the finished drawing.
   ============================================================ */

import { createScope, createTimeline, stagger, svg, utils } from "animejs";
import Link from "next/link";

import {
  AbsentEdge,
  Edge,
  NodeBox,
  Scene,
  Sheet,
  VIZ,
  VIZ_SELECTOR,
  toneColor,
} from "@/components/viz";
import { useIsomorphicLayoutEffect, useReveal } from "@/components/viz/useReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cx } from "@/lib/format";

import { ROLE_ABSENCE, ROLE_LOOP_CAP, boxProps, wireProps } from "./roles";

/* ==================== the figure ====================

   Coordinates are viewBox units and a node is placed by its centre
   (`components/viz/Glyphs.tsx`). Two rows: the planner and the
   tester and the deployer along the top, the builder and the
   debugger beneath them, which puts the loop on one axis and the
   absence on the other so neither has to cross the other to be
   read.
   ==================================================== */

const FIGURE = { width: 900, height: 340 } as const;

/** Row centres. */
const TOP = 76;
const LOW = 234;

/** Column centres. */
const LEFT = 150;
const MID = 450;
const RIGHT = 750;

/** Half of `VIZ.node.width` and `VIZ.node.height`, for the port arithmetic below. */
const HW = VIZ.node.width / 2;
const HH = VIZ.node.height / 2;

function RolesFigure() {
  const { ref, shown, phase } = useReveal<SVGSVGElement>({ amount: 0.2 });

  useIsomorphicLayoutEffect(() => {
    /* `static` is the server, a reader without JS and a reader who asked for reduced
       motion, and in all three `useReveal` has already rendered the finished drawing.
       Playing here would take it apart in front of exactly the reader who said no. */
    if (phase !== "shown") return;
    const root = ref.current;
    if (root === null) return;

    const scope = createScope({ root }).add(() => {
      const nodes = root.querySelectorAll(VIZ_SELECTOR.node);
      const carried = root.querySelectorAll(`${VIZ_SELECTOR.edge} ${VIZ_SELECTOR.label}`);
      const absent = root.querySelectorAll(VIZ_SELECTOR.absentEdge);
      /* Only the edges that exist are drawn. `createDrawable` works by writing
         `stroke-dasharray`, and the absent edge's dash is the whole of what makes it
         read as absent, so it arrives by opacity instead. */
      const wires = svg.createDrawable(root.querySelectorAll(`${VIZ_SELECTOR.edge} path`));

      /* Set rather than declared as a `from` value: a layout effect runs before paint,
         so the hidden state is what the reader's first frame shows and there is no
         finished drawing flashing up before it collapses. */
      utils.set(nodes, { opacity: 0 });
      utils.set(carried, { opacity: 0 });
      utils.set(absent, { opacity: 0 });
      utils.set(wires, { draw: "0 0" });

      createTimeline({ defaults: { ease: "outQuad" } })
        .add(nodes, { opacity: 1, duration: 340 }, stagger(90))
        .add(wires, { draw: "0 1", duration: 460 }, stagger(60, { start: 300 }))
        .add(carried, { opacity: 1, duration: 260 }, stagger(60, { start: 540 }))
        /* Last, and alone. A reader who has just watched five edges land is the reader
           most likely to notice the sixth one that never connects. */
        .add(absent, { opacity: 1, duration: 560 }, 1280);
    });

    return () => {
      scope.revert();
    };
  }, [phase, ref]);

  return (
    <Scene
      ref={ref}
      id="roles"
      width={FIGURE.width}
      height={FIGURE.height}
      label="Five roles wired in order. The planner sends acceptance criteria to the tester and the builder sends its build to the tester. The tester sends failure evidence to the debugger and the debugger sends a patch back, a loop bounded by an iteration cap. The tester sends the approved build to the deployer. A dashed non-edge marks the run that is deliberately missing, from the planner to the builder, labelled acceptance-criteria."
      className={cx(
        "transition-opacity duration-500 ease-out",
        shown ? "opacity-100" : "opacity-0",
      )}
    >
      {/* what the run is started with */}
      <Edge from={[26, TOP]} to={[LEFT - HW - 6, TOP]} tone="dim" label="request" />
      <Edge from={[26, LOW]} to={[LEFT - HW - 6, LOW]} tone="dim" label="plan" />

      {/* Doc 2 §5.2's absence, drawn in the place it would have gone. `code-builder@1.0.0`
          lists `acceptance-criteria` under `cannot`, so this is a rule the resolver holds
          the graph to and not a convention an author remembered. */}
      <AbsentEdge
        from={[LEFT, TOP + HH]}
        to={[LEFT, LOW - HH]}
        label={ROLE_ABSENCE.prohibition}
        id="absent"
      />

      <Edge
        from={[LEFT + HW, TOP]}
        to={[MID - HW - 6, TOP]}
        {...wireProps("planner", "tester")}
      />
      <Edge from={[LEFT + HW, LOW]} to={[400, TOP + HH + 6]} {...wireProps("builder", "tester")} />

      {/* Doc 2 §5.5. Two arcs bowing apart so each says what it carries in its own
          space, and so the direction of each is readable without a legend. */}
      <Edge
        from={[MID - 22, TOP + HH]}
        to={[MID - 22, LOW - HH]}
        bend={30}
        {...wireProps("tester", "debugger")}
      />
      <Edge
        from={[MID + 22, LOW - HH]}
        to={[MID + 22, TOP + HH]}
        bend={30}
        {...wireProps("debugger", "tester")}
      />

      <Edge
        from={[MID + HW, TOP]}
        to={[RIGHT - HW - 6, TOP]}
        {...wireProps("tester", "deployer")}
      />

      <NodeBox x={LEFT} y={TOP} {...boxProps("planner")} />
      <NodeBox x={LEFT} y={LOW} {...boxProps("builder")} />
      <NodeBox x={MID} y={TOP} {...boxProps("tester")} />
      <NodeBox x={MID} y={LOW} {...boxProps("debugger")} />
      <NodeBox x={RIGHT} y={TOP} {...boxProps("deployer")} />

      {/* The run ends here. `release-gate@1.0.0` emits nothing onward, so there is no
          outgoing edge to draw and the note says what it leaves behind instead. */}
      <text
        data-viz="label"
        x={RIGHT}
        y={TOP + HH + 20}
        textAnchor="middle"
        fontSize={VIZ.font.sub}
        fill={toneColor("dim")}
      >
        writes the tag and the digest
      </text>

      {/* The cap, attached to the node that declares it. */}
      <path
        d={`M ${MID} ${LOW + HH + 2} L ${MID} ${LOW + HH + 30}`}
        stroke={toneColor("dim")}
        strokeWidth={VIZ.stroke.hair}
        strokeDasharray={VIZ.dash.leader}
      />
      <text
        data-viz="label"
        x={MID}
        y={LOW + HH + 46}
        textAnchor="middle"
        fontSize={VIZ.font.label}
        fill={toneColor("ink")}
      >
        {`${ROLE_LOOP_CAP.param}: ${ROLE_LOOP_CAP.value}`}
      </text>
      <text
        data-viz="label"
        x={MID}
        y={LOW + HH + 62}
        textAnchor="middle"
        fontSize={VIZ.font.sub}
        fill={toneColor("dim")}
      >
        {`the cap on the loop, declared on ${ROLE_LOOP_CAP.card}`}
      </text>
    </Scene>
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
          <RolesFigure />
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
