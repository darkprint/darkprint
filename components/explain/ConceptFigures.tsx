import Link from "next/link";

import { ReachList, ReachRow } from "@/components/ui/ReachList";

/* ============================================================
   The two drawings of the words section, second attempt. They
   were written for `/concepts`; that route folded into
   `/what-a-blueprint-is#the-words` and the figures moved with it.

   ── What was wrong with the first ──
   The author called them "very wrong", and they were. Both were
   `FlowScene` graphs, and in the luminous-flow register a lit
   circle joined by an edge means one thing on this site: a node,
   a step in a run. So drawing `model`, `skill` and `tool` as
   circles wired to a node said those are steps too. They are not.
   A node is a step; the card is the document *describing* that
   step, and its fields point at things that are not in the graph
   at all. The figure contradicted the model the page exists to
   explain.

   A second error travelled with it: `cannot` was drawn as a
   missing edge from a node labelled "judge". `cannot` names a
   data type, not a neighbour. Any edge able to carry that type is
   refused, whichever node draws it, so inventing a judge to draw
   the absence from asserted a topology the card never mentions.

   ── And why the register changed ──
   "adopt graphics and animations that are not necessarly drawn
   from a 'blueprint' style". So neither of these is a `FlowScene`
   and neither sits on the graticule. They are boxes and rules: a
   card drawn as the document it is, and two nested frames. Nothing
   here is in `components/viz/scene-labels.test.ts`'s roster,
   because nothing here draws a scene.

   The first figure's row/connector/gloss layout lives in
   `components/ui/ReachList.tsx`, because the author asked for it
   on the ontology and node pages too and one implementation is
   the only way those three stay the same drawing.

   Motion is `anim-strip-in` from `globals.css`, whose resting
   style is the finished one and which only plays under
   `prefers-reduced-motion: no-preference`. Server components: no
   hooks, no client bundle.
   ============================================================ */

/** Stagger between the two frames of the second figure, ms. Matches `ReachList`. */
const STEP = 90;

/* ==================== the shape inside the blueprint frame ====================
   The innermost frame of `EvalHarnessBlueprint` used to hold four mono chips —
   `plan → build → test → deploy` — and the author's objection is that a row of boxes
   joined by arrows is a pipeline, while the thing the frame is labelled with is a graph.
   He is right, and the chips were saying the one thing this page cannot afford to say
   about a blueprint: that it runs in a line.

   ── Why a disc here, when this file's own header rules the luminous register out ──
   That header rules it out for a stated reason: "in the luminous-flow register a lit
   circle joined by an edge means one thing on this site: a node, a step in a run", and
   the first draft drew `model`, `skill` and `tool` as such circles, which asserted they
   were steps. They are not. The things in THIS frame are nodes and are steps — that is
   what a blueprint is — so the objection does not reach them, and drawing them as
   anything but a disc would be the site saying a node is a box on the one page whose
   band 01 draws a node as a disc. `components/learn/PartFigures.tsx` records that exact
   defect being fixed two sections up.

   What still binds is the rest of it: no `FlowScene`, no graticule, no halo, no hover
   labels. This is a 200-unit schematic inside a nested-frame diagram, not a scene, and
   `components/viz/scene-labels.test.ts` derives its roster by walking every source in
   `components/` and `app/` for the opening tag of that component — so mounting one here
   would owe the roster an entry and take on the whole register's machinery for a drawing
   that needs none of it. (Naming the tag in prose is enough to trip that walk, which is
   why this paragraph spells it the long way round.)

   ── Not one of the nine ──
   A bare diamond: one node fans out to two, both merge into a fourth. It is the smallest
   shape that cannot be read as a line, because it contains a branch and a merge, which
   is the whole difference between a graph and a queue. It is also not any of the nine
   published bundles, and cannot become one by accident: the smallest of them draws six
   nodes (`starter-software-factory`) and the rest run to ten, and the two that fan out
   at all — `grounded-research-desk` and `frontline-triage` — carry stages after the
   merge. So the figure illustrates the idea without impersonating a file a reader can
   download, which is the rule `/what-a-blueprint-is` states for itself in its own header
   ("a picture of a graph that is not one of the graphs"). Four unlabelled discs assert
   no bundle at all; four named ones would have.

   ── Not a word inside the viewBox ──
   `components/learn/figures.test.ts` exists because a number inside an `<svg>` is in
   viewBox units and lands at that number times rendered-width ÷ viewBox-width; three
   figures shipped under the 10px floor that way. This frame's inner width is 198px on a
   390px phone, the tightest box on the page. So the drawing carries no `<text>` at all:
   the discs are unlabelled, the shape is described to a screen reader by the svg's own
   `aria-label`, and the words live in the sentence under it as real 13px DOM text. Sub-
   floor type is impossible here by construction rather than by measurement.

   ── What this deletes, on the record ──
   The chips carried four of `CORE_PHASE_IDS`, and the note under them justified them as
   the ontology's phase verbs. That justification was already half-false: `debugging`
   never appeared, and "build" is not `implementation`, so the figure was already
   spelling a term a second way — the exact failure the note claimed to prevent. The
   phases are taught on the landing and counted, off the ontology, by `VocabularyFigure`
   two sections up. They are not taught here any more. */

/** The little graph's sheet, in viewBox units. */
const SHEET = { w: 200, h: 84 } as const;

/** A disc's radius, and the clearance a run keeps from the discs it joins. */
const DISC = { r: 5, gap: 3, stroke: 1.1 } as const;

/** Where the four discs sit. A diamond: one out to two, two back into one. */
const SPOTS: Record<string, readonly [number, number]> = {
  source: [16, 42],
  upper: [88, 15],
  lower: [88, 69],
  sink: [180, 42],
};

/** Which discs answer which. Four runs, one branch, one merge. */
const RUNS: readonly (readonly [string, string])[] = [
  ["source", "upper"],
  ["source", "lower"],
  ["upper", "sink"],
  ["lower", "sink"],
];

/** The arrowhead, defined once. Namespaced because an SVG id is document-wide. */
const HEAD = "dp-eval-blueprint-head";

/**
 * One run, trimmed off both discs so a curve never touches what it joins.
 *
 * The same rule `components/viz/flow.ts` applies to every luminous edge, done here by
 * hand because this drawing is four straight lines and importing the register to get one
 * subtraction would drag the whole scene apparatus in with it.
 */
function trimmed(from: readonly [number, number], to: readonly [number, number]) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const t = (DISC.r + DISC.gap) / len;
  return {
    x1: from[0] + dx * t,
    y1: from[1] + dy * t,
    x2: to[0] - dx * t,
    y2: to[1] - dy * t,
  };
}

/**
 * A card drawn as what it is: a document. Its rows point outward, at things that are
 * not nodes and are not in the graph.
 *
 * Values are the caller's, read off a real published card, so the figure cannot end up
 * teaching a schema nobody ships.
 */
export function WhatACardReaches({
  model,
  tools,
  mcp,
  skill,
  cannot,
  riskMarkers,
}: {
  model: string;
  tools: string;
  mcp: string;
  skill: string;
  cannot: string;
  riskMarkers: string;
}) {
  /* Six rows, and each carries its own fine print.
     ------------------------------------------------------------
     Both changes come from the same defect. The page drew this figure with five rows
     and then set a six-box grid under it, one box per field, keyed by the same names. The
     same list twice, and the two disagreed: the figure said five rows, the grid explained
     six, and `risk_markers` appeared only in the grid. A reader counting fields on a page
     whose subject is what the fields are got two answers.

     So the sixth row is here, and the grid's sentences are the rows' `note`s. The gloss
     says what the field reaches; the note says the thing about it a reader would otherwise
     find out by trying it. Nothing was cut.

     `code-builder` declares no risk markers, and the row says so. That is the honest
     drawing: the field exists on every card and this card leaves it empty. */
  return (
    <ReachList label="One card, six rows">
      <ReachRow
        field="model"
        value={model}
        note="Written the way the provider writes it, and overridable. A reader can point the graph at something else."
      >
        The model it thinks with. The ceiling on what this step can be trusted to attempt.
      </ReachRow>
      <ReachRow
        field="tools"
        value={tools}
        note="The card names the capability, not a vendor, so a graph says what it touches rather than what you bought."
      >
        Capabilities it may reach for: a shell, a search index, a browser.
      </ReachRow>
      <ReachRow
        field="mcp"
        value={mcp}
        note="Two nodes naming the same server share the same door."
      >
        A server exposing one. MCP is the wire, so this row is the reach a run has.
      </ReachRow>
      <ReachRow
        field="skill"
        value={skill}
        note={
          <>
            <span className="text-muted">
              The engine reads nothing at the other end of this path, so no skill document
              travels in the download.
            </span>{" "}
            Each bundle&rsquo;s README lists the ones you supply yourself.
          </>
        }
      >
        A written procedure it follows. A pointer only: the document does not travel in
        the download.
      </ReachRow>
      <ReachRow
        field="cannot"
        value={cannot}
        barred
        note="An entry naming a data type is enforced; an entry naming anything else is a sentence addressed to a reader and checked by nothing."
      >
        What must never arrive. Naming a data type makes it a rule the resolver holds
        every incoming edge to, whichever node draws one.
      </ReachRow>
      <ReachRow
        field="risk_markers"
        value={riskMarkers}
        note={
          <>
            Each marker costs the blueprint security points.{" "}
            <Link
              href="/reading-the-radar"
              className="text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-amber-bright"
            >
              How a blueprint is graded <span aria-hidden>&rarr;</span>
            </Link>
          </>
        }
      >
        The blast radius, priced. What this step could break if it goes wrong, declared by
        the card rather than guessed at by a reader.
      </ReachRow>
    </ReachList>
  );
}

/**
 * Three frames, one inside the next, to the author's own sketch: "a third box containing
 * the harness that is defined as eval, and it contains the harness which contains the
 * blueprint, and the eval contains also a box named rubric."
 *
 * That is the whole page in one drawing. **Eval** is the outermost thing, because an eval
 * is the act of running something and grading it. It holds two things: the **harness**
 * that does the running, and the **rubric** it grades against. The harness in turn holds
 * the **blueprint**, which is the graph and its cards. Containment carries every relation,
 * so nothing has to be asserted in a sentence underneath.
 *
 * The rubric is a sibling of the harness rather than inside it on purpose: what the work
 * is judged against is decided before a run and does not belong to the runner. On this
 * site it has a name and a type, `acceptance-criteria`, which is why the analyzer can
 * follow it through a graph.
 */
export function EvalHarnessBlueprint() {
  return (
    <figure className="flex flex-col gap-4 rounded-xl border border-line bg-surface/70 p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          Three things, one inside the next
        </span>
        <span className="text-[13px] text-muted">
          A blueprint is what you download from here. Give it a harness and it runs.
        </span>
      </figcaption>

      {/* eval */}
      <div className="anim-strip-in flex flex-col gap-3 rounded-lg border border-violet/40 p-4 sm:p-5">
        <p className="label text-violet">
          eval
        </p>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {/* harness
              ────────────────────────────────────────────────
              Neutral, and it is the only frame here that is. It wore
              `border-amber/45` + `text-amber` until 2026-08-07, which was a
              standing breach of the rule `app/globals.css` states over
              `.route-box`: amber has exactly two jobs sitewide,
              `ComingSoonBadge` ("not built yet") and a box that leaves the
              page, and a nested category frame is neither. Worse than
              spending the colour, it made a claim — amber reads "not built
              yet", so an amber harness said DarkPrint intends to ship one.
              It does not. The figcaption two elements up says the opposite in
              words: "A blueprint is what you download from here. Give it a
              harness and it runs."

              So neutral is not a fallback, it is the accurate register. Of
              the four boxes, three are things this site hands you or reads
              off the engine — the eval is where a person decides to grade
              (violet), the blueprint is the thing you download (cyan), the
              rubric is a real card type, `acceptance-criteria`, the analyzer
              can follow (emerald). The harness is the one box you bring
              yourself, and it is now the one box with no accent.

              Nothing is lost by it: the docblock above records that
              containment carries every relation in this drawing, so no
              frame's hue is load-bearing, and the svg's `aria-label` gives
              the shape to a screen reader independently.

              Measured against the figure's real ground (`bg-surface/70` over
              void resolves to #080a13): the label at `text-muted` #9aa1ba is
              7.87:1, past AAA and brighter than the 11px accent labels it
              sits beside. `border-line-bright` #333a54 computes 1.76:1
              against that ground, against 2.05:1 for the `border-violet/40`
              directly outside it — the same order as its siblings, so the
              frame does not read as weaker than the boxes it holds and is
              held by. */}
          <div
            className="anim-strip-in flex flex-1 flex-col gap-3 rounded-lg border border-line-bright p-4"
            style={{ animationDelay: `${STEP}ms` }}
          >
            <p className="label text-muted">
              harness
            </p>

            {/* blueprint */}
            <div
              className="anim-strip-in flex flex-col gap-3 rounded-lg border border-cyan/40 bg-void/50 p-4"
              style={{ animationDelay: `${STEP * 2}ms` }}
            >
              <p className="label text-cyan">
                blueprint
              </p>
              {/* The stagger stays on the wrapper rather than moving inside the svg:
                  `anim-strip-in` is a DOM keyframe and the drawing arrives as one thing,
                  which is also what it is — a shape, not four events. */}
              <div
                className="anim-strip-in"
                style={{ animationDelay: `${STEP * 3}ms` }}
              >
                <svg
                  viewBox={`0 0 ${SHEET.w} ${SHEET.h}`}
                  className="h-auto w-full max-w-[18rem]"
                  role="img"
                  aria-label="The shape of a blueprint: one node hands its work to two others, and both of those hand theirs to a fourth."
                >
                  <defs>
                    <marker
                      id={HEAD}
                      viewBox="0 0 8 8"
                      refX={8}
                      refY={4}
                      markerWidth={4}
                      markerHeight={4}
                      orient="auto"
                    >
                      <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--color-line-bright)" />
                    </marker>
                  </defs>
                  {RUNS.map(([from, to]) => {
                    const a = SPOTS[from];
                    const b = SPOTS[to];
                    if (a === undefined || b === undefined) return null;
                    return (
                      <line
                        key={`${from}-${to}`}
                        {...trimmed(a, b)}
                        stroke="var(--color-line-bright)"
                        strokeWidth={DISC.stroke}
                        markerEnd={`url(#${HEAD})`}
                      />
                    );
                  })}
                  {Object.entries(SPOTS).map(([id, [x, y]]) => (
                    <circle key={id} cx={x} cy={y} r={DISC.r} fill="var(--color-cyan)" />
                  ))}
                </svg>
              </div>
              <p className="text-[13px] leading-snug text-muted">
                The graph and the cards it pins. Text, versioned, checkable. It branches
                and comes back together, which is the difference between a blueprint and a
                list of steps.
              </p>
            </div>

            <p className="text-[13px] leading-snug text-muted">
              What executes the graph: a runner that takes each node in turn, and an
              evaluator that reads the result.
            </p>
          </div>

          {/* rubric, a sibling of the harness inside the eval */}
          <div
            className="anim-strip-in flex flex-col gap-3 rounded-lg border border-emerald/40 p-4 lg:w-[16rem]"
            style={{ animationDelay: `${STEP * 2}ms` }}
          >
            <p className="label text-emerald">
              rubric
            </p>
            <p className="text-[13px] leading-snug text-muted">
              What the result is graded against. Here it has a name and a type,{" "}
              <code className="font-mono text-[12px] text-emerald">
                acceptance-criteria
              </code>
              , so the analyzer can follow it through a graph.
            </p>
          </div>
        </div>

        <p className="text-[13px] leading-snug text-muted">
          One run of a blueprint through a harness, graded against a rubric. That is an
          eval.
        </p>
      </div>
    </figure>
  );
}
