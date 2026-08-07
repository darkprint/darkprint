import { cx } from "@/lib/format";

/* ============================================================
   Spec §4.3, and the author's sentence behind it: "you need to
   make people get in a glance the concepts."

   ── The drawing this replaces, and why it had to go (2026-08-07) ──
   The author: "it has wrong concepts assigned to nodes". He is
   right, and `components/explain/ConceptFigures.tsx` records the
   site making the identical mistake once before and being told so
   in the same words ("very wrong"). The rule that file states is
   the rule broken here: **in the luminous-flow register a lit
   circle joined by an edge means one thing on this site — a node,
   a step in a run — and an edge is data handed from one step to
   the next.** `components/viz/FlowGlyphs.tsx` defines the register
   that way and `components/viz/flow.ts` makes `human`
   unrepresentable as a plain tone, so a violet disc can only ever
   mean "a node where a person waits".

   This figure drew the four QUESTIONS as five lit discs on one
   cyan rail. Everything that follows from that was wrong:

     · A question is not a step. `01 verdict`, `02 harness`,
       `03 edges` and `04 cost` read as four components of the
       machine rather than as four things to ask about your own
       work — and the section lead directly above says the
       opposite, that all four are "about the task rather than
       about the graph you would draw for it". The lead and the
       drawing could not both be right.
     · Two of the four labels collided with the site's own graph
       vocabulary. `edges` is this site's word for what runs
       BETWEEN nodes, and it was a disc; `harness` is drawn as a
       `Boundary` rectangle enclosing two nodes by
       `components/home/SectionLevels.tsx` a couple of thousand
       pixels up the same page, and it was a disc here. One word,
       two object kinds, one scroll apart.
     · Three arcs converged on one point, `supply what is missing`.
       `WhichTasksRemedies` three bands lower groups the remedies
       01/02 together, 03 on its own, and 03's is "shrink it until
       the edges are visible" — reduce the task, fetch nothing. The
       figure asserted a 3-into-1 merge the page does not hold.
     · The terminal `a good fit` was emerald and lit. Emerald on
       this site is a figure read off the engine. Nothing computes
       this one; it is the reader's own answer.
     · A left-to-right chain ending on one lit green disc is a
       scoring rail, which is why the caption had to spend its last
       line denying it ("So do not add these up"). When a caption
       must contradict its own figure, the figure is wrong.
       `SectionLevels` forbids exactly that shape on doc 2 §1.1
       grounds — "no arrows between the levels, no progress track"
       — on this same route.
     · And it did not even render what it claimed. The four `no`
       edge labels were in the SSR markup and invisible on every
       desktop: `useLuminousFlow` hands edges `hover` when the
       scene animates and `FLOW_CSS` hides those above `48rem` with
       a fine pointer. The nodes passed `reveal="always"`; the five
       edges passed nothing. The old header's own rule — "a figure
       whose meaning waits for a pointer is a broken figure" — was
       applied to the discs and missed on the arcs, so the branch
       semantics were gone on the widest screens and nothing in
       `components/viz/scene-labels.test.ts` could see it, because
       that guard renders static markup where the media query never
       applies.

   ── What the figure has to say ──
   The section under it is a checklist with one asymmetry, and the
   asymmetry is the whole argument:

     1. four questions, asked about the task, in order;
     2. a no on 01, 02 or 03 names something the task has not got
        yet, so the TASK changes and you ask again;
     3. a no on 04 names nothing missing, so the GRAPH changes: a
        person stands where a mistake stops being cheap (doc 2
        §1.1 — that is a design decision and never a shortfall);
     4. four yeses mean a candidate, and there is nothing to add up.

   A left-to-right chain actively hides (2) against (3): it has to
   spend three converging arrows on the thing a single brace says.
   So this is a brace, and it is the one mark that can carry the
   3-and-1 split at a glance.

   ── The register, and why nothing here is a scene ──
   "adopt graphics and animations that are not necessarly drawn
   from a 'blueprint' style". Same instruction, same answer as
   `ConceptFigures`: rows and rules, real DOM text, and not one
   svg element in the file. (Spelled out in words rather than as
   the tag, because `which-tasks-glance.test.ts` greps this source
   for it and `scene-labels.test.ts` greps every source on the site
   for the scene's opening tag — naming either the short way round
   would make both guards read their own documentation.) Three
   things follow for free.

     · Every word is HTML, so it obeys the browser's own type floor
       rather than viewBox units times rendered-width over frame-
       width — the arithmetic that put five figures under the
       legibility floor at once (see `scene-labels.test.ts`).
     · The figure cannot ship 42% off the right edge of a phone,
       which is what the old one did in an `overflow-x-auto` box
       and what forced it to carry two whole placements. Text
       wraps. One drawing now, not two.
     · Nothing waits for a pointer, because there is no reveal gate
       to forget.

   `components/ui/ReachList.tsx` is the site's row/connector/gloss
   figure and it is deliberately NOT used here. Its own header
   scopes it: "the left cell is the name as it is written in a
   file". These left cells are not names in a file, they are the
   numbers of four questions, and its rows point one-to-one while
   the whole point of this drawing is that three of them point at
   the same place. Its connector glyph is quoted, because that is
   the mark this site already uses for "this reaches that".

   ── Colour ──
   One accent, and it is the asymmetry itself. Violet is where a
   person acts, and the answer to a no on 04 is literally a person
   standing at a step; `WhichTasksChecks` puts the same violet on
   card 04 and `WhichTasksRemedies` on the third remedy, so the
   three marks are one mark. Everything else is `--color-line` and
   `--color-dim`. Amber is not spent here at all: it has exactly
   two jobs sitewide and this route already spends both on the
   pager's cards.

   ── The words this absorbed ──
   The caption used to carry four paragraphs, two of which were the
   figure's own branches written out in prose because the drawing
   could not say them. It carries one now. Nothing was lost: (2)
   and (3) are the two outcome cells, and the "do not add these up"
   line is the footnote under the rows.

   The four questions are the SHORT forms, and as of 2026-08-07 they
   are the ONLY forms: the author asked "The instrument / The four
   questions in full" off the route, and `WhichTasksChecks` is
   deleted. What this figure says is what the site says. The
   paragraphs below used to describe the division of labour between
   the two; they are kept because they record what the long form
   carried, and because restoring it means restoring that division.
   `WhichTasksChecks` asked
   them in full three bands lower under the same numbers and the
   same handles, which is the glance-then-read pairing this route
   is built on; shortening them here is what stops the figure being
   a fourth copy of that section. `WhichTasksGlance`,
   `WhichTasksChecks` and `WhichTasksRemedies` have each recorded a
   de-duplication pass against the other two, so the division has to
   be stated rather than left to the next author's judgement: the
   figure asks, the checks section asks in full and says how to
   settle each one, the remedies section says what to do with a no.
   Question 04's handle is the one shortened word — "the cost" here,
   "the cost of being wrong" in the two sections below — because
   twenty-three characters of 11px mono do not fit a 9rem column and
   the question printed beside it carries the rest.

   Server component: no hooks, no client bundle. Motion is
   `anim-strip-in` from `globals.css`, whose resting style is the
   finished one and which only plays under `prefers-reduced-motion:
   no-preference`. Guarded by `which-tasks-glance.test.ts`.
   ============================================================ */

/** Milliseconds between one row drawing in and the next. Matches `ReachList`. */
const STEP = 90;

interface Ask {
  id: string;
  /** The numeral, and the handle `WhichTasksChecks` files the same question under. */
  n: string;
  name: string;
  /** The question in glance form. The asked form is in `WhichTasksChecks`. */
  asks: string;
}

interface Group {
  id: string;
  rows: readonly Ask[];
  /** Which numbers this brace gathers, written out so the relation survives without it. */
  reads: string;
  /** What a no on those rows moves. The four words the figure exists to separate. */
  moves: string;
  what: string;
  /** Violet, and only on the group whose answer is a person. See the header. */
  accent?: boolean;
}

const GROUPS: readonly Group[] = [
  {
    id: "task",
    reads: "01 to 03",
    moves: "The task changes",
    what:
      "A no names something the work has not got yet: a check nobody wrote, a target nobody decided. Supply it, or make the task small enough to have edges, and ask the question again.",
    rows: [
      {
        id: "verdict",
        n: "01",
        name: "the verdict",
        asks: "Can anything but you say the output is correct?",
      },
      {
        id: "harness",
        n: "02",
        name: "the harness",
        asks: "Does that check exist, or can you write it first?",
      },
      {
        id: "edges",
        n: "03",
        name: "the edges",
        asks: "Is the target written down, and does it stop?",
      },
    ],
  },
  {
    id: "graph",
    reads: "04",
    moves: "The graph changes",
    accent: true,
    what:
      "A no names nothing missing. The task stays as it is and the drawing moves instead: a person stands at the step where a mistake stops being cheap, with everything upstream of them running unattended.",
    rows: [
      {
        id: "blast",
        n: "04",
        name: "the cost",
        asks: "If this lands wrong, who finds out?",
      },
    ],
  },
];

/**
 * One question on one line: its number, its handle, and what it asks.
 *
 * The number and the handle share a fixed column above `lg` so the four questions read as
 * one instrument asked four times rather than as four ragged entries. Below `lg` they sit
 * on their own line above the question: the two-column ledger needs a 9rem handle column
 * AND a question beside it, and at 768 that left the question 162px — every one of the four
 * wrapped to three lines and the rows stopped reading as rows.
 */
function Row({ row, delay, accent = false }: { row: Ask; delay: number; accent?: boolean }) {
  return (
    <li
      className="anim-strip-in flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex shrink-0 items-baseline gap-2 lg:w-[9rem]">
        {/* The numeral takes the group's accent where it has one, the way
            `WhichTasksChecks` gives 04's card its numeral and its rule as one mark. */}
        <span className={cx("label", accent && "text-violet")}>{row.n}</span>
        <span className="label">{row.name}</span>
      </span>
      <span className="text-[13px] leading-snug text-muted">{row.asks}</span>
    </li>
  );
}

/**
 * A set of questions, the brace that gathers them, and the one thing a no on any of them
 * moves.
 *
 * Three columns above `lg`; stacked below it, where the brace is hidden and the outcome
 * keeps a left edge instead — an arrow pointing right at a block that now sits underneath
 * it draws a relation the layout no longer has. `ReachList` stacks by the same rule, at
 * `sm`; this figure needs the extra tier because it puts a handle column and a question in
 * the left cell where `ReachList` puts one name.
 *
 * The brace is `aria-hidden` and carries no words, so the outcome names its own rows
 * ("a no on 01 to 03") rather than relying on a mark assistive technology cannot see. That
 * is also what keeps the drawing readable when the two columns stack.
 */
function GroupRows({ group, offset }: { group: Group; offset: number }) {
  const accent = group.accent === true;

  return (
    /* Two equal columns above `lg`, not a wide one and a narrow one.
       ------------------------------------------------------------
       The questions are short and the outcomes are two sentences each, so a `1fr` question
       column beside a fixed 16rem outcome put about 500px of nothing between the last word
       of a question and the brace that follows it, and stretched each outcome to six lines
       — which made the rule taller than the rows it gathers, so the brace read as bracketing
       empty space. Equal columns put the brace a short reach from the questions and let the
       outcomes wrap at three lines, which is the height of the three rows opposite them. */
    /* 12 between rows, 16 from the rows to their outcome, 20 between the two groups. Three
       canonical tiers in ascending order, so the stacked layout carries the same grouping
       the brace carries above `lg` — where all three are the same 12, an outcome sits as
       far from the rows it gathers as the rows sit from each other. */
    <li className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <ol className="flex flex-col gap-3">
        {group.rows.map((row, index) => (
          <Row key={row.id} row={row} delay={(offset + index) * STEP} accent={accent} />
        ))}
      </ol>

      {/* The pointing: a rule down the rows, a stub, and the connector glyph `ReachList`
          already uses for "this reaches that". `--color-dim` rather than
          `--color-line-bright`, which measures 1.74:1 on this ground — the defect that
          file records having made the relation invisible while its refusals shouted. */}
      <span aria-hidden className="hidden lg:flex lg:items-center">
        <span className={cx("w-px self-stretch", accent ? "bg-violet/50" : "bg-line-bright")} />
        <span className={cx("h-px w-3", accent ? "bg-violet/60" : "bg-dim")} />
        <span
          className={cx(
            "-ml-px inline-block w-3.5 text-center font-mono text-[12px]",
            accent ? "text-violet" : "text-dim",
          )}
        >
          &rarr;
        </span>
      </span>

      <div
        className={cx(
          /* Capped at the measure `ReachList` caps its gloss at: the column is `1fr` and
             on a 1440 that is about 85 characters a line, which is prose width inside a
             figure cell. */
          "flex max-w-[74ch] flex-col gap-1.5 border-l pl-3 lg:border-l-0 lg:pl-0",
          accent ? "border-violet/50" : "border-line",
        )}
      >
        <span className={cx("label", accent && "text-violet")}>A no on {group.reads}</span>
        <p className="text-sm font-medium leading-snug text-fg">{group.moves}</p>
        <p className="text-[13px] leading-snug text-muted">{group.what}</p>
      </div>
    </li>
  );
}

/**
 * Where each group's first row sits in the stagger, so the four rows draw in one sequence
 * rather than two groups each starting from zero.
 *
 * Derived at module scope off a module constant, not accumulated during render: the
 * stagger is a property of the table and a counter mutated inside `map` is a render that
 * depends on how many times it has run.
 */
const OFFSETS: readonly number[] = GROUPS.reduce<number[]>((acc, group, index) => {
  acc.push(index === 0 ? 0 : acc[index - 1] + GROUPS[index - 1].rows.length);
  return acc;
}, []);

export function WhichTasksGlance() {
  return (
    <div className="flex flex-col gap-5">
      <figure className="flex flex-col gap-5 rounded-xl border border-line bg-surface/70 p-5 sm:p-6">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="label">Four questions, asked about the task</span>
          <span className="text-[13px] text-muted">
            Three of them are answered by changing the work. One is not.
          </span>
        </figcaption>

        <ol className="flex flex-col gap-5">
          {GROUPS.map((group, index) => (
            <GroupRows key={group.id} group={group} offset={OFFSETS[index]} />
          ))}
        </ol>

        {/* The tally reading, denied where the four are first counted, and no longer
            denying the drawing above it: a braced ledger has no rail to run along and no
            terminal to reach. Doc 2 §1.1 is about the autonomy class rather than this
            page, and the failure mode is the same shape — turn four questions into a score
            and people optimise the score. */}
        <p className="border-t border-line pt-3 text-xs leading-relaxed text-dim">
          All four yes and the task is a candidate. They are not points: three out of four
          is not a score, and a no is the next thing to do rather than a verdict on the
          work.
        </p>
      </figure>

      {/* One paragraph, where there were four. The other three were the figure's own two
          branches written out because the drawing could not say them, plus a line denying
          the rail the drawing drew. This one is not in the figure and is not below it
          either: it says why question 01 is first, which is the only thing on this beat
          the ledger cannot carry. */}
      {/* No `.prose-lane`, on the author's instruction 2026-08-07: this runs the full
          width of the column. */}
      <p className="text-sm leading-relaxed text-muted">
        A dark factory runs with nobody watching it, so the design rests on one property of
        the work: whether something other than your judgement can tell the graph it is
        finished.
      </p>
    </div>
  );
}
