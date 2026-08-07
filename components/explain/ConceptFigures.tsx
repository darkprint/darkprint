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
        /* The second sentence is the podcast document's least-privilege point, folded
           into the row it is about rather than given a block of its own. In a graph the
           question is never what an agent may do; it is what THIS node may do, and the
           four reach fields are declared per card, which is per-node identity. */
        note="Two nodes naming the same server share the same door, and two that do not are two different reaches. Every field on this list is declared per card, so a graph says what each node may touch rather than what the system may."
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
        {/* The equation, in the slot the caption already had.
            ────────────────────────────────────────────────
            The podcast document's one-line definition, `Agente = Modello + Harness`, and
            it costs one line and no geometry because both of its terms are already frames
            in the drawing below: the harness is a box, and the model is the field the
            `model` row of the figure above names. The third thing — the blueprint — is
            neither, and that is the point of putting the equation here rather than in a
            paragraph: it sits directly over a drawing in which the blueprint is the
            innermost box, so a reader sees that the thing this site hands over is not on
            either side of the equals sign. */}
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-muted">
          <code className="font-mono text-[12px] text-dim">agent = model + harness</code>
          <span>A blueprint is what you download from here. Give it a harness and it runs.</span>
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

            {/* blueprint — the one frame drawn on the cyanotype sheet
                ────────────────────────────────────────────────
                The author's instruction: give this box "the background a blueprint gets on
                the blueprint page", which is `.bp-grid` over the blueprint pole. It was
                `border-cyan/40` on `bg-void/50`, a neutral hole with a cyan edge; every
                other drawing of a blueprint on this site — the gallery card's plate, the
                graph panes, the doors — is a graticule on deep blue, and this was the one
                place the site named a blueprint and did not draw it on its own paper.

                The whole frame moves register with the ground, because a light-blue sheet
                with slate ink on it is two registers in one box:

                  - the label goes `blueprint-line`, not `cyan`. Cyan is the interactive
                    semantic and there is nothing to click here;
                  - the gloss goes `blueprint-ink`, the pole's own text colour;
                  - the little graph's runs go `blueprint-line` and its discs go
                    `blueprint-ink`. They were `line-bright` and `cyan`: `line-bright`
                    (#333a54) computes 1.15:1 on this ground and would have vanished
                    outright, which is the failure mode of changing a ground and leaving
                    the ink. Discs brighter than runs keeps the one relation the site's
                    whole visual language rests on — a lit figure on a receding sheet.

                ── Measured, not assumed ──
                Ground: `bg-blueprint-deep/60` (#061c52 at 60%) over the figure's own
                `bg-surface/70`-over-`bg-surface` (#0a0c16) resolves to #08163a. `.bp-grid`
                lays 1px rules over it at 12% and 5% of `blueprint-line`, and the 12% rule
                is the brightest pixel a glyph can land on: #152952. Every ratio below is
                quoted against that worst case, with the field value after it.

                  blueprint-ink gloss   10.92:1  (13.51 on the field)   AA needs 4.5
                  blueprint-line label  6.64:1   (8.21)                 AA needs 4.5
                  blueprint-ink discs   10.92:1  (13.51)                AA-graphic needs 3
                  blueprint-line runs   6.64:1   (8.21)                 AA-graphic needs 3

                The border is `blueprint-line/55`: 3.42:1 against the neutral ground
                outside it and 3.12:1 against the sheet inside it, both past the 3:1 a
                non-text boundary owes. `/50` was 3.02 and 2.75 — it fails on the inside —
                and `/40`, what the cyan border used, is 2.34 and 2.13. The intensity was
                picked the same way: at `/35` the sheet barely reads as blue, and past
                `/70` the border's inner contrast slides under 3:1 because the sheet
                brightens faster than the rule does. */}
            <div
              className="anim-strip-in bp-grid flex flex-col gap-3 rounded-lg border border-blueprint-line/55 bg-blueprint-deep/60 p-4"
              style={{ animationDelay: `${STEP * 2}ms` }}
            >
              {/* `blueprint-ink`, and it was `blueprint-line` for one draft.
                  Measured against real rendered pixels rather than against the arithmetic:
                  `.bp-grid` lays two lattices, and where two 96px major rules cross, the
                  sheet reaches rgb(38,68,115) — brighter than the 12% single rule the
                  arithmetic predicts, because the crossing composites twice. Against that
                  pixel `blueprint-line` computes 4.50:1, which meets AA exactly and by
                  nothing, on 11px type whose stems are a pixel wide. `blueprint-ink` is
                  7.41:1 on the same pixel and 13.47:1 on the field.

                  Nothing is lost by it. The `harness` frame directly outside already draws
                  its label and its gloss in one colour, so a frame whose name matches its
                  own body text is this figure's existing practice, and `blueprint-line`
                  keeps the two jobs it is named for: the border, and the runs of the
                  little graph. */}
              <p className="label text-blueprint-ink">
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
                      <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--color-blueprint-line)" />
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
                        stroke="var(--color-blueprint-line)"
                        strokeWidth={DISC.stroke}
                        markerEnd={`url(#${HEAD})`}
                      />
                    );
                  })}
                  {Object.entries(SPOTS).map(([id, [x, y]]) => (
                    <circle
                      key={id}
                      cx={x}
                      cy={y}
                      r={DISC.r}
                      fill="var(--color-blueprint-ink)"
                    />
                  ))}
                </svg>
              </div>
              <p className="text-[13px] leading-snug text-blueprint-ink">
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

/* ==================== the guardrail, drawn as a shape ====================
   The one idea the podcast document carries that this site had nowhere: a guardrail is
   not "please be careful" in a prompt, it is a structural constraint, and it can sit in
   exactly one of three places — on what arrives, on what a node may reach for, on what
   leaves. A grep for the word over `components/` and `app/` returned one hit before this
   figure, inside an autonomy blurb.

   ── Why the site can draw it at all ──
   Because the definition is already the machinery. `lib/core/bundle/resolve.ts`'s
   `checkProhibitions` raises `bundle/prohibition-violated` at **error** severity when a
   `cannot` entry names a `data-type` and an incoming edge can carry it, whichever node
   drew the edge; `bundle/port-mismatch` refuses an edge whose two ends do not agree on a
   type. Those are the document's input and output guardrails, written in a file, checked
   by a reader of files. So this figure reports the engine rather than illustrating an
   idea, which is the rule `/what-a-blueprint-is` states for its own drawings.

   ── The two columns, and why the right one is not a disclaimer ──
   The right-hand column names retry, budgets, blocking a call in flight. None of that
   exists here and none of it ever will: DarkPrint reads files and analyses them standing
   still. The author has twice asked the site to stop saying so in a sentence, so it is
   not said in a sentence. The column is headed with what it is — "Done by your harness,
   at run time" — the attribution rides in the head rather than in a lead above the
   figure, and the head is held by `components/site/honesty.test.ts` so a later wording
   pass cannot quietly drop the possessive and leave the capabilities reading as ours.
   No `ComingSoonBadge`: amber means "not built yet", and a badge here would promise a
   harness this site is not going to ship.

   ── The colours, and the one amber question they raise ──
   Copper on the declared side, and copper only. `--color-copper-line` is this site's
   "this describes a node card", which is exactly what the left column is: four field
   names off the card schema. Amber is out by the standing rule (`ComingSoonBadge` and
   `.route-box`, nothing else), signal red is out because it means a defect and a
   constraint in the abstract is not one, violet is out because nobody acts here. The
   harness side takes no accent at all, which is the ruling `EvalHarnessBlueprint`'s
   harness frame already made two figures up and is worth being consistent about: on this
   page, neutral means "the box you bring yourself".

   The `cannot` row of `WhatACardReaches` sits about one screen above this and draws its
   connector in AMBER, via `ReachList`'s `barred`. That was noticed and deliberately not
   matched. `barred` means "this row is a refusal"; copper here means "this cell is
   something a card declares" — two different claims, so the two drawings are not one
   idea in two colours. The amber itself is a standing question for `ReachList`, whose own
   docblock calls amber "this site's colour for a limit" against a sitewide rule that says
   it is not; `barred` renders on exactly one row sitewide, this one, so the flip is cheap
   whenever the author wants it. It is not made here, in a file that does not own it.

   ── No text inside a viewBox ──
   There is no viewBox. The whole drawing is boxes and rules in DOM text, so
   `components/learn/figures.test.ts`'s failure mode — a number in viewBox units landing
   at a third of its written size on a phone — cannot happen here by construction. Nothing
   in this file draws a scene, so nothing owes `components/viz/scene-labels.test.ts` a
   roster entry. */

interface GuardrailBand {
  /** Where in one node's pass the constraint sits. */
  band: string;
  /** What a file in the bundle can say about it. Field names off the card schema. */
  bundle: React.ReactNode;
  /** What only a runner can do about it. Never attributed to this site. */
  harness: React.ReactNode;
}

/** A field name as the card spells it, in the declared side's own colour. */
function Field({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] text-copper-line">{children}</code>;
}

const GUARDRAIL_BANDS: readonly GuardrailBand[] = [
  {
    band: "input",
    bundle: (
      <>
        <Field>cannot</Field>, naming a data type. The resolver refuses every incoming
        edge that can carry it, at error severity, whichever node draws the edge.
      </>
    ),
    harness:
      "Scrubbing a secret out of a prompt; catching an injection before the model reads it.",
  },
  {
    band: "logic",
    bundle: (
      <>
        <Field>tools</Field>, <Field>mcp</Field> and <Field>skill</Field>, written per
        card, so reach is stated node by node rather than for the system.
      </>
    ),
    harness:
      "Holding a call to that list, capping a budget, routing the work, stopping for a person before an irreversible step.",
  },
  {
    band: "output",
    bundle: (
      <>
        <Field>outputs</Field>, typed. An edge whose two ends disagree about the type it
        carries is refused before anything runs.
      </>
    ),
    harness:
      "Checking the shape of a result, retrying a failed call, blocking or diverting one in flight.",
  },
];

/** The three-column template, written once so the head row and the bands cannot drift. */
const BAND_GRID =
  "sm:grid sm:grid-cols-[minmax(0,4.5rem)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3";

/**
 * Three bands, two columns: where a constraint can sit, and which half of it a file can
 * hold.
 *
 * Read down the left column and you have the whole of what a bundle can promise. Read
 * down the right and you have what somebody else's runner does with it. The figure makes
 * the split visible instead of asserting it, which is the only reason it is a drawing.
 */
export function GuardrailShape() {
  return (
    <figure className="flex flex-col gap-4 rounded-xl border border-line bg-surface/70 p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="label">Three places a constraint can sit</span>
        <span className="text-[13px] text-muted">
          Input, logic, output: the order a value moves through one node.
        </span>
      </figcaption>

      <div className="flex flex-col gap-3">
        {/* The column heads. Hidden below `sm` because the columns are not columns down
            there; each cell carries the same words itself at that width, so the
            attribution is never off-screen. Both spellings are real SSR text. */}
        <div className={`hidden ${BAND_GRID}`}>
          <span aria-hidden />
          <span className="label text-copper-line">Written in the bundle</span>
          <span className="label text-muted">Done by your harness, at run time</span>
        </div>

        {GUARDRAIL_BANDS.map((row, i) => (
          <div
            key={row.band}
            className={`anim-strip-in flex flex-col gap-2 ${BAND_GRID}`}
            style={{ animationDelay: `${i * STEP}ms` }}
          >
            <span className="label sm:pt-2">{row.band}</span>
            {/* Copper edge at 55%: 3.19:1 on the figure's ground, past the 3:1 a
                non-text boundary owes. `/40`, the weight the sibling figures use for a
                frame nobody has to tell apart from its neighbour, is 2.20 and would
                have left the one distinction this drawing rests on under the floor. */}
            <p className="flex flex-col gap-1 rounded border border-copper-line/55 bg-surface-2 px-3 py-2 text-[13px] leading-snug text-muted">
              <span className="label text-copper-line sm:hidden">Written in the bundle</span>
              <span>{row.bundle}</span>
            </p>
            {/* Shorter than the column head above it, and still possessive. The head's
                own wording runs to two wrapped lines in a 326px cell and is repeated on
                every band, which turns the attribution into noise on the width where a
                reader has the least patience for it. What may never go is the "your":
                that word is the whole difference between describing a harness and
                claiming one, and the full sentence is held by
                `components/site/honesty.test.ts` over the head, which is in the markup at
                every width. */}
            <p className="flex flex-col gap-1 rounded border border-line-bright bg-surface-2 px-3 py-2 text-[13px] leading-snug text-muted">
              <span className="label sm:hidden">Your harness, at run time</span>
              <span>{row.harness}</span>
            </p>
          </div>
        ))}
      </div>
    </figure>
  );
}

/* ==================== offline and online, as one axis ====================
   The cheapest drawing on this page and the one carrying the most. "Guardrail" has a
   runtime connotation everywhere else it is written, so naming it two blocks up without
   locating it in time would let a reader assume this site enforces something during a
   run. This is where that is answered, and it is answered by a picture of when rather
   than by a third repetition of what DarkPrint does not do.

   Four steps and one tick. Left of the tick is what a file can say and what a reader of
   files can check; right of it is what happens on a machine this site never sees. The
   tick is a 1px column at `--color-dim` (5.68:1, well past the 3:1 a meaningful boundary
   owes), and the two halves are told apart by their heads and by a tint, never by a
   hairline nobody can measure — a dashed-versus-solid distinction at `--color-line`
   computes 1.09:1 and would have carried the figure's whole meaning at a ratio no reader
   with low vision could resolve.

   Below `sm` the columns stop being columns, so the tick is dropped and the DOM order is
   what reads: head, its two steps, head, its two steps. That is why the markup is written
   in that order and placed explicitly at `sm` rather than the other way round. */

interface AxisStep {
  step: string;
  note: string;
  /**
   * The cell's column at `sm`, spelled in full.
   *
   * Written out rather than computed from the index because Tailwind resolves classes by
   * scanning source text: `sm:col-start-${i + 1}` is a string this file contains and the
   * generated stylesheet does not, so the rule would simply not exist and all four cells
   * would auto-place into the first free tracks.
   */
  col: string;
}

/** What this site can see. Both steps happen to files, standing still. */
const OFFLINE: readonly AxisStep[] = [
  {
    step: "written",
    note: "the graph, its cards, one vocabulary: text on disk",
    col: "sm:col-start-1",
  },
  {
    step: "checked",
    note: "the analyzer reads them and scores what it reads",
    col: "sm:col-start-2",
  },
];

/** What happens after the download. Named, and attributed, never claimed. */
const ONLINE: readonly AxisStep[] = [
  {
    step: "handed over",
    note: "the folder goes to your machine and your keys",
    col: "sm:col-start-4",
  },
  {
    step: "run",
    note: "your harness executes it; guardrails act here or nowhere",
    col: "sm:col-start-5",
  },
];

/** One cell of the axis. `tinted` is the offline half, on the cyanotype register. */
function AxisCell({ step, note, col, tinted }: AxisStep & { tinted: boolean }) {
  return (
    <div
      className={`anim-strip-in flex flex-col gap-1 rounded border px-3 py-2 sm:row-start-2 ${col} ${
        tinted
          ? "border-blueprint-line/55 bg-blueprint-line/8"
          : "border-line-bright bg-surface-2"
      }`}
    >
      <span className={`label ${tinted ? "text-blueprint-ink" : "text-fg"}`}>{step}</span>
      <span className="text-[13px] leading-snug text-muted">{note}</span>
    </div>
  );
}

/**
 * One horizontal axis, drawn once: an eval measures before a run, a guardrail acts during
 * one, and this site stops at the tick.
 *
 * It is the caption that carries the concept and the strip that carries the honesty. The
 * two halves are the podcast document's offline/online distinction, and the reason they
 * are worth drawing here is that the same artefact appears on both sides — which is
 * stated in the caption and would be invisible without it.
 */
export function HandoverAxis() {
  return (
    <figure className="flex flex-col gap-4 rounded-xl border border-line bg-surface/70 p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="label">One blueprint, four moments</span>
        <span className="text-[13px] text-muted">
          An eval measures before. A guardrail acts during.
        </span>
      </figcaption>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1px_minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-3">
        <span className="label text-blueprint-line sm:col-span-2 sm:col-start-1 sm:row-start-1">
          Offline &middot; what a file can say
        </span>
        {OFFLINE.map((cell) => (
          <AxisCell key={cell.step} {...cell} tinted />
        ))}
        {/* The tick. `aria-hidden`: the two heads already name the halves in words, so
            this adds nothing to a screen reader and would read out as a stray blank. */}
        <span
          aria-hidden
          className="hidden bg-dim sm:col-start-3 sm:row-start-1 sm:row-span-2 sm:block"
        />
        <span className="label sm:col-span-2 sm:col-start-4 sm:row-start-1">
          Online &middot; what a harness does
        </span>
        {ONLINE.map((cell) => (
          <AxisCell key={cell.step} {...cell} tinted={false} />
        ))}
      </div>

      {/* "Before the handover" and "after it", never "on the left" and "on the right".
          The strip is four columns at `sm` and four stacked blocks below it, so a caption
          written in compass directions describes a layout half the readers of this page
          are not looking at. The handover is a named step in the drawing at both widths,
          which makes it the one reference that survives the stack. */}
      <p className="text-[13px] leading-relaxed text-muted">
        An eval measures before a run, on cases you chose. A guardrail sits in the live
        path and can block, modify or divert. One artefact serves both:{" "}
        <code className="font-mono text-[12px] text-emerald">acceptance-criteria</code> is
        what the analyzer traces before the handover, standing still, and what a harness
        would grade against after it.
      </p>
    </figure>
  );
}
