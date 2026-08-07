import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   Doc 2 §4, the concrete half. The four questions are the
   instrument; these are readings taken with it, so every entry
   names the question it turns on rather than being adjudicated
   by adjectives.

   The unsuitable column is written at exactly the same weight as
   the suitable one. Softening it is the failure the page exists
   to prevent: somebody takes an impossible task to a factory,
   gets slop, and concludes the pattern is vapour.

   ── Spec §4.3: the split resolves before the reasoning ──
   Two columns of four titles is the fits / does-not-fit split the
   spec asks the page to lead with, and eight titles is something a
   reader settles in seconds: they look for the entry their own
   work resembles. The paragraph that adjudicates each one is what
   they read after they have found it, so it sits inside a
   `<details>` under the title rather than between the reader and
   the next title. Every word of all eight is still on the page and
   still in the prerendered HTML; the disclosure decides what is
   on screen before a click, and nothing else.

   ── Redesign spec §5: a section folded into this one ──
   The page carried a closing section, "Why the page is written
   this flatly", whose whole content was the paragraph above about
   the reader who takes an unverifiable task to a factory. It was a
   heading and a paragraph explaining a decision the reader was
   about to see anyway, three screens after they saw it. The
   sentences moved into the lead here, where the second column is
   in front of them.

   ── The length pass (PROJECT.md §3.1) ──
   The eight readings are now the only place the page works an
   example: `WhichTasksChecks` carried a one-line yes and a one-line
   no per question, and three of those eight lines were these
   titles retyped. Its header comment records the fold. What that
   costs this file is the obligation to be the worked half on its
   own, so the bodies were tightened rather than shortened by
   dropping one: each still names the mechanism that decides it, and
   the second column of four is still four.

   The unsuitable column's lead lost its second sentence, "a factory
   pointed at any of these produces confident output that nothing in
   the graph is able to reject", which is the sentence the section
   lead above it ends on.

   ── The scale pass ──
   The `h2` was a hand-written `font-display text-2xl`: 24px against
   the 28/32 `SectionHeading` draws every other section title on the
   site at. It is that component now, and the 78-word paragraph
   under it splits the way `/the-climb` records splitting its own —
   the first two sentences become the deck, verbatim, and the rest
   carries on underneath at body size inside `.prose-lane`. Not one
   word changed. All 78 in the deck would have run four lines of
   20px across the full column, which is the opposite of the "get it
   in a glance" this page was cut for.

   The two mono runs in here were `tracking-[0.12em]` at 11px, a
   fourth spelling of a tier that has exactly three. Both are
   `.label`; the pill keeps its column's hue through `style`, which
   outranks the class either way.

   `aria-labelledby` needs an id on the heading itself and
   `SectionHeading` has no id prop, so the id rides a `<span>` inside
   the title. The accessible name is the same string either way, and
   the alternative — a second hand-typed copy of the h2 class list —
   is the defect this pass exists to remove.

   ── The second column left `--color-signal` (2026-08-07) ──
   The does-not-fit column was painted in the alarm colour: the pill,
   the ✕ on all four rows, and the word beside it. Signal red means a
   DEFECT on this site — it is what a bundle refused with
   `bundle/prohibition-violated` is drawn in — and this section's own
   copy says the opposite about these four. "Make the onboarding less
   confusing" is not a fault. Its lead says the judgement is the work
   and it belongs to a person, which is doc 2 §1.1's subject, and
   `WhichTasksRemedies` exists to say what to do about each one. A
   reader who considered one of these made no error, and red told
   them they had.

   The column keeps its full strength through copy, which is where
   this file's own header says the strength belongs, and through the
   glyph: ✕ against ✓ is the distinction, drawn rather than coloured.
   `dim` is the tone, the same one the site spends on a run that is
   present but not the subject. Emerald stays on the fits column,
   because a task that answers four checks is a figure read off an
   instrument, and that is exactly emerald's job here.
   ============================================================ */

type Example = {
  title: string;
  /** Which check decides it, quoted as `NN · name` from WhichTasksChecks. */
  check: string;
  body: string;
};

type Column = {
  id: string;
  glyph: string;
  word: string;
  color: string;
  heading: string;
  lead: string;
  items: Example[];
};

const COLUMNS: Column[] = [
  {
    id: "fits",
    glyph: "✓",
    word: "fits",
    color: "var(--color-emerald)",
    heading: "Tasks a blueprint can take",
    lead: "Four yeses each. The common shape is that the definition of done was already written down, usually by a compiler or a suite.",
    items: [
      {
        title: "Port a suite off a deprecated assertion library",
        check: "01 · the verdict",
        body: "One mechanical transform across four hundred assertions, and the suite is its own oracle: it passed before the change and has to pass after. A weakened assertion shows up as a test that stops failing when the code under it breaks.",
      },
      {
        title: "Add a field end to end through a typed stack",
        check: "03 · the edges",
        body: "Migration, model, handler, client. The compiler finds every site you missed, and the existing suite covers the behaviour around it.",
      },
      {
        title: "Implement a format that publishes a conformance corpus",
        check: "02 · the harness",
        body: "The check exists before a line is written and did not come from the model: parse every sample, serialise it back, compare. Disagreement is a failure with a file name on it.",
      },
      {
        title: "Delete a feature flag that has been fully rolled out for a year",
        check: "04 · cost of being wrong",
        body: "The surviving path is the one already serving production, the branch being deleted has not executed in months, and the worst outcome is a revert nobody merged.",
      },
    ],
  },
  {
    id: "doesnt",
    glyph: "✕",
    word: "does not fit",
    color: "var(--color-dim)",
    heading: "Tasks it cannot take",
    lead: "Each fails for a reason no prompt fixes.",
    items: [
      {
        title: "Make the onboarding less confusing",
        check: "01 · the verdict",
        body: "No command returns non-zero on confusing. The judgement is the work and it belongs to a person, so a tester handed this has nothing to test against and passes whatever it is given.",
      },
      {
        title: "Choose the datastore for a service that does not exist yet",
        check: "03 · the edges",
        body: "The requirements are not ambiguous by accident. They have not been decided. A planner will decide for you, phrase it as a recommendation, and every node downstream will build on a guess.",
      },
      {
        title: "Backfill and rewrite production rows in place",
        check: "04 · cost of being wrong",
        body: "A staging run proves the happy path and nothing else, the bug is found by whoever reads the wrong number first, and the rollback is restoring a backup. Being wrong once costs the exercise.",
      },
      {
        title: "Tune the ranking until the results are better",
        check: "01 · the verdict",
        body: "The metric stands in for a judgement about people. Hand a proxy to a system that iterates against it a hundred times and you get the proxy, paid for with the thing it stood for. The scores go up, the results do not.",
      },
    ],
  },
];

export function WhichTasksExamples() {
  return (
    <section className="flex flex-col gap-10" aria-labelledby="examples-heading">
      <div>
        <SectionHeading
          eyebrow="The worked half"
          title={
            <span id="examples-heading">Eight real tasks, run through the four questions</span>
          }
          lead="Find the entry your task most resembles and read the check it turns on. The second column is at full strength on purpose."
        />
        {/* "This page" until the merge of 2026-08-07. The four sections this belongs to are
            the second half of a page whose first half is the ladder, and a reader who has
            just read that half would take "this page" to include it. */}
        <p className="prose-lane mt-5 text-[15px] leading-[1.7] text-muted">
          This filter exists to prevent one outcome: a blueprint pointed at a task nothing
          can verify returns fluent work no node in the graph can reject, and the reader
          concludes that dark factories do not work. The graph was fine; the task was
          never a candidate.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {COLUMNS.map((col) => (
          <section
            key={col.id}
            className="panel flex flex-col overflow-hidden"
            aria-labelledby={`${col.id}-heading`}
          >
            <div className="flex flex-col gap-2 border-b border-line px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* `.label` in a pill, recoloured by the column's own hue. It was
                    `tracking-[0.12em]` here and `0.12em` again on the check line below,
                    neither of which is one of the three mono tiers. */}
                <span
                  className="label inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5"
                  style={{ color: col.color }}
                >
                  <span aria-hidden>{col.glyph}</span>
                  {col.word}
                </span>
              </div>
              <h3
                id={`${col.id}-heading`}
                className="font-display text-lg font-semibold text-fg"
              >
                {col.heading}
              </h3>
              <p className="text-sm leading-relaxed text-dim">{col.lead}</p>
            </div>

            <ul className="flex flex-col divide-y divide-line">
              {col.items.map((item) => (
                <li key={item.title}>
                  <details className="group px-5 py-3.5">
                    <summary className="flex cursor-pointer list-none [&::-webkit-details-marker]:hidden gap-3">
                      <span
                        className="mt-0.5 shrink-0 font-mono text-xs leading-5"
                        style={{ color: col.color }}
                        aria-hidden
                      >
                        {col.glyph}
                      </span>
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="font-display text-[15px] font-semibold leading-snug text-fg">
                          {item.title}
                        </span>
                        <span className="label transition-colors group-hover:text-muted">
                          {item.check}
                          <span aria-hidden className="ml-2 inline-block transition-transform group-open:rotate-90">
                            ▸
                          </span>
                        </span>
                      </span>
                    </summary>
                    <p className="mt-2.5 pl-6 text-sm leading-relaxed text-muted">
                      {item.body}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
