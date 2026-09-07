import { cx } from "@/lib/format";
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

/* `SHEET`, `DISC`, `SPOTS`, `RUNS`, `HEAD` and `trimmed()` stood here and drew the little
   four-disc graph inside `EvalHarnessBlueprint`'s innermost frame. They went with it: the
   drawing that replaced it, `components/explain/RunLayers.tsx`, puts the same diamond on
   the page with CARDS instead of discs, on the author's instruction that "the node should
   be clear they are cards in the blueprint".

   Its trim is written the same way and for the same reason the note above gives — four
   straight lines do not justify importing the whole luminous-edge register to get one
   subtraction — but it trims to a 22x16 rectangle rather than to a radius, which is a
   different sum. Nothing here would have been reusable.

   The paragraph above this stays: the no-`<text>` rule it states is what `RunLayers`'
   card glyph obeys, and it is the reason that glyph carries no words at 22 units wide. */

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
  willNot,
  riskMarkers,
}: {
  model: string;
  tools: string;
  mcp: string;
  skill: string;
  cannot: string;
  willNot: string;
  riskMarkers: string;
}) {
  /* Seven rows, each with its own fine print: the gloss says what the field reaches, and
     the note says the thing about it a reader would otherwise find out by trying it. The
     two prohibition fields are two rows because the card format keeps them apart.
     `code-builder` declares no risk markers, and the row says so: the field exists on every
     card and this card leaves it empty. */
  return (
    <ReachList label="One card, seven rows">
      <ReachRow
        field="model"
        value={model}
        /* The direction is the claim: a graph-level model_stylesheet looks like the outer
           scope, so a reader arriving from the DOT side reads it as the thing that wins,
           and Attractor spec §8.5 ranks it the other way. `rows.test.ts` reads this note. */
        note="A stylesheet on the graph is a default for the nodes that name no model; a line here outranks it. A reader can still point the run at something else."
      >
        The model this step runs on, named the way the provider names it.
      </ReachRow>
      <ReachRow
        field="tools"
        value={tools}
        note="The card names a capability rather than a vendor, so a graph says what it touches and never what you bought."
      >
        Capabilities it may reach for: a shell, a search index, a browser.
      </ReachRow>
      <ReachRow
        field="mcp"
        value={mcp}
        /* Equal reach and nothing more: a card only names a server, nothing on this site
           runs a graph, and whether a runner opens one connection or two is the runner's
           business. */
        note="Two nodes naming the same server have the same reach; two naming different servers do not. Reach is declared per card, so a graph says what each node may touch rather than what the whole system may."
      >
        An MCP server this step may talk to, by the name it is registered under on the
        machine that runs the graph.
      </ReachRow>
      <ReachRow
        field="skill"
        value={skill}
        note={
          <>
            <span className="text-muted">
              Nothing here reads what this path points at, so no skill document travels in
              the folder.
            </span>{" "}
            Each blueprint&rsquo;s README lists the ones you supply yourself.
          </>
        }
      >
        A written procedure it follows. A pointer only.
      </ReachRow>
      <ReachRow
        field="cannot"
        value={cannot}
        barred
        note="Data types from the vocabulary, and nothing else. Writing one here is what turns a stated rule into a checked one."
      >
        What must never arrive. The validator enforces it against every incoming edge, no
        matter which node draws the edge.
      </ReachRow>
      <ReachRow
        field="will_not"
        value={willNot}
        barred
        note="The prohibitions nothing can check, kept apart from the ones the validator can, so a reader can tell them apart without running anything."
      >
        What the card promises, in the author&rsquo;s own sentences. It reaches whoever
        runs the node, and the model that is handed the specification at run time.
      </ReachRow>
      <ReachRow
        field="risk_markers"
        value={riskMarkers}
        /* No link to a grading page and no score sentence: no page prints a security
           number beside a card. What the row teaches is that a marker is a term out of the
           vocabulary rather than a sentence, which is what makes a stated blast radius a
           checked one. */
        note="Risk-marker terms from the vocabulary, and nothing else. Writing one here puts the blast radius in the file, where the validator can hold the author to a word the vocabulary defines."
      >
        The blast radius, declared. The card states what this step could break if it goes
        wrong.
      </ReachRow>
    </ReachList>
  );
}

/* `EvalHarnessBlueprint` stood here, 240 lines of nested frames with their contrast
   arithmetic, and it is deleted rather than left unmounted.

   The author moved its subject to a band of its own on `/what-a-blueprint-is` ("a new
   section that start with such drawing"), asked the nodes drawn as cards, asked the boxes
   to arrive on scroll, and struck the caption's `agent = model + harness` as "not totally
   correct". That is a different figure, and it is `components/explain/RunLayers.tsx`.

   Three findings survived the move, because they were measured rather than decorative:

     the harness frame takes NO accent. It is the one box a reader brings themselves, and
     amber, which it wore until 2026-08-07, means "not built yet" sitewide — an amber
     harness said DarkPrint intends to ship one. It does not.

     the blueprint frame is the only one on the cyanotype sheet, `bp-grid` over
     `bg-blueprint-deep/60` inside a `blueprint-line/55` border. That border weight is the
     one that clears 3:1 on BOTH sides; `/50` fails on the inside at 2.75:1. Its label is
     `blueprint-line` and its ink `blueprint-ink`, quoted against the brightest pixel
     `.bp-grid` can put under a glyph, which is where two 96px major rules cross.

     eval is violet and rubric is emerald, for the reasons this file gives at each of its
     remaining figures: violet is where a person decides, emerald is what the engine reads.

/* ==================== the guardrail, drawn as a shape ====================
   The one idea the podcast document carries that this site had nowhere: a guardrail is
   not "please be careful" in a prompt, it is a structural constraint, and it can sit in
   exactly one of three places — on what arrives, on what a node may reach for, on what
   leaves. A grep for the word over `components/` and `app/` returned one hit before this
   figure, inside an autonomy blurb.

   ── Why the site can draw it at all ──
   Because the definition is already the machinery. `lib/core/bundle/resolve.ts`'s
   `checkProhibitions` raises `bundle/prohibition-violated` at **error** severity when an
   incoming edge can carry a `data-type` a card lists under `cannot`, whichever node drew
   the edge; `bundle/port-mismatch` refuses an edge whose two ends do not agree on a
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

   The `cannot` and `will_not` rows of `WhatACardReaches` sit about one screen above this
   and draw their connectors in AMBER, via `ReachList`'s `barred`. That was noticed and
   deliberately not matched. `barred` means "this row is a refusal"; copper here means
   "this cell is something a card declares" — two different claims, so the two drawings
   are not one idea in two colours. The amber itself is a standing question for
   `ReachList`, whose own docblock calls amber "this site's colour for a limit" against a
   sitewide rule that says it is not; `barred` renders on exactly two rows sitewide, both
   of them there, so the flip is cheap whenever the author wants it. It is not made here,
   in a file that does not own it.

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
        <Field>cannot</Field>, holding a data type. The resolver refuses every incoming
        edge that can carry it, at error severity, no matter which node draws the edge.
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
        card. Each node states its own reach. There is no system-wide reach statement.
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
 *
 * ── The two columns are two moments, and 2026-08-08 said so ──
 * The author, moving this figure below `HandoverAxis`: reorganise it so that "the orange
 * part is how in the bundle defined statically, and on the right it is an example of what
 * a harness does when running according the indications provided by the static files in
 * the bundle."
 *
 * That is what the columns always were, and the heads did not say it. "Written in the
 * bundle" and "Done by your harness, at run time" name WHO, which a reader can only use
 * once they already know that one of the two happens before anything runs. So the heads now
 * name the moment first — `STATIC` before the run, `AT RUN TIME` — and the right column is
 * labelled as what it holds: an example, not a specification. This site does not ship a
 * harness, so the right column can never be a list of what one WILL do, and calling it an
 * example is both truer and the thing the author asked for.
 *
 * The dependency this creates is why the figure moved. `HandoverAxis` draws the handover as
 * a named step on one axis; standing after it, these two columns are that axis's two sides
 * seen close up, on one node. Standing before it, they were two unexplained columns.
 */
export function GuardrailShape() {
  return (
    <figure className="flex flex-col gap-4 rounded-xl border border-line bg-surface/70 p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="label">Three places a constraint can sit</span>
        {/* "Input, logic, output: the order a value moves through one node." stood here and
            the author asked it out. It was reciting the three band labels down the left of
            the figure, in the order they are already in, four pixels below itself.

            REMOVED TWICE, which is worth recording: it went once and came back with a
            `git checkout` that reverted this file to recover from a bad splice, and the
            revert was not re-inspected. The lesson is the recovery, not the sentence. */}
      </figcaption>

      <div className="flex flex-col gap-3">
        {/* One head per column, centred over it, since 2026-08-08. The author: take the
            two labels out of the boxes and place them "aligned centered over" their column.

            They were per-cell for one revision — repeated on every band — which was my fix
            for the two heads wrapping unevenly once they became two moments. Repeating a
            label three times to keep two labels from wrapping is the wrong trade: it puts
            the same eleven words in the figure six times, and the attribution stops reading
            as a column head and starts reading as part of each cell.

            Centred is what makes one row work at the new lengths. Left-aligned, a
            48-character head over a 1fr column and a 26-character head over its sibling sat
            on one baseline with a ragged right; centred, each is symmetric in its own track
            and the pair reads as two captions rather than as a broken table row.

            Printed at every width now, not `hidden sm:grid`: the cells no longer carry a
            copy for the stacked layout to fall back on, so hiding these would leave a phone
            reader with two unattributed columns. Below `sm` the grid collapses and the heads
            sit directly over their own boxes, which is the same relation. */}
        <div className={BAND_GRID}>
          <span aria-hidden className="hidden sm:block" />
          <span className="label block text-copper-line sm:text-center">
            Static · written in the bundle
          </span>
          <span className="label mt-4 block text-emerald sm:mt-0 sm:text-center">
            At run time · an example of what your harness does with it
          </span>
        </div>

        {GUARDRAIL_BANDS.map((row, i) => (
          <div
            key={row.band}
            /* A rule between the bands, not just a gap. The author asked for "a more
               evident split between the subsections input, logic and output": three pairs of
               boxes 12px apart read as six boxes, and what a reader has to see first is that
               they come in threes. `first:` clears it off the top one so the figure does not
               open on a line. */
            className={cx(
              "anim-strip-in flex flex-col gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0",
              BAND_GRID,
            )}
            style={{ animationDelay: `${i * STEP}ms` }}
          >
            <span className="label sm:pt-2">{row.band}</span>
            {/* Copper edge at 55%: 3.19:1 on the figure's ground, past the 3:1 a
                non-text boundary owes. `/40`, the weight the sibling figures use for a
                frame nobody has to tell apart from its neighbour, is 2.20 and would
                have left the one distinction this drawing rests on under the floor. */}
            <p className="flex flex-col gap-1 rounded border border-copper-line/55 bg-surface-2 px-3 py-2 text-[13px] leading-snug text-muted">
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
            {/* `border-emerald/40`, matching the column head above it, on the author's
                instruction 2026-08-08. The head went green when the two columns became two
                moments; the cells under it stayed `line-bright`, so a reader scanning down
                the run-time column lost the thread after the first row. The static column
                beside it has read `copper-line/55` on every cell since it was built, so this
                is the pair finally being drawn the same way twice.

                40% and not 55%: emerald is a lighter hue than copper at the same alpha, and
                measured on this figure's ground the two borders land within a tenth of each
                other at 40 and 55 — 3.24:1 against 3.19:1, both past the 3:1 a non-text
                boundary owes. Matched weight rather than matched number. */}
            <p className="flex flex-col gap-1 rounded border border-emerald/40 bg-surface-2 px-3 py-2 text-[13px] leading-snug text-muted">
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
    note: "the analyzer reads them and reports what it finds",
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

      {/* A caption stood here — "An eval measures before a run … one artefact serves both"
          — and the author asked it out on 2026-08-08. It was defining eval and guardrail a
          second time: `RunLayers`, in the band four sections up this page, now writes all
          four of those words from the author's own source, and this strip's job is the
          one thing that band does not draw, which is WHEN each of them can act.

          The note it carried is worth keeping, because it constrains anything written here
          next: say "before the handover" and "after it", never "on the left" and "on the
          right". The strip is four columns at `sm` and four stacked blocks below it, so a
          caption in compass directions describes a layout half this page's readers are not
          looking at. The handover is a named step in the drawing at both widths. */}
    </figure>
  );
}
