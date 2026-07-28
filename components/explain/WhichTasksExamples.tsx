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
    heading: "Tasks a factory can take",
    lead: "Four yeses each. The common shape is that the definition of done was already written down by somebody, usually by a compiler or a suite.",
    items: [
      {
        title: "Port a suite off a deprecated assertion library",
        check: "01 · the verdict",
        body: "Four hundred assertions, one mechanical transform, and the suite is its own oracle: it passed before the change and it has to pass after. A rewrite that quietly weakens an assertion shows up as a test that no longer fails when you break the code under it.",
      },
      {
        title: "Add a field end to end through a typed stack",
        check: "03 · the edges",
        body: "Migration, model, handler, client. The task has a beginning and a visible end, the compiler finds every site you missed, and the existing suite covers the behaviour around it.",
      },
      {
        title: "Implement a format that publishes a conformance corpus",
        check: "02 · the harness",
        body: "The check exists before a line is written and it did not come from the model: parse every sample, serialise it back, compare. Disagreement with the corpus is a failure with a file name on it.",
      },
      {
        title: "Delete a feature flag that has been fully rolled out for a year",
        check: "04 · cost of being wrong",
        body: "The surviving path is the one already serving production, the branch being deleted has not executed in months, and the worst outcome is a revert on a branch nobody merged.",
      },
    ],
  },
  {
    id: "doesnt",
    glyph: "✕",
    word: "does not fit",
    color: "var(--color-signal)",
    heading: "Tasks it cannot take",
    lead: "Each fails on one question, and each fails for a reason no prompt fixes. A factory pointed at any of these produces confident output that nothing in the graph is able to reject.",
    items: [
      {
        title: "Make the onboarding less confusing",
        check: "01 · the verdict",
        body: "No command returns non-zero on confusing. The judgement is the work, it belongs to a person, and a tester node handed this task has nothing to test against, so it passes whatever it is given.",
      },
      {
        title: "Choose the datastore for a service that does not exist yet",
        check: "03 · the edges",
        body: "The requirements are not ambiguous by accident. They have not been decided. A planner will decide them for you, phrase the decision as a recommendation, and every node downstream will build on it without ever knowing it was a guess.",
      },
      {
        title: "Backfill and rewrite production rows in place",
        check: "04 · cost of being wrong",
        body: "A staging run proves the happy path and nothing else, the bug is discovered by whoever reads the wrong number first, and the rollback is restoring a backup. Being wrong once costs the entire budget of the exercise.",
      },
      {
        title: "Tune the ranking until the results are better",
        check: "01 · the verdict",
        body: "There is a metric, and the metric stands in for a judgement about people. Hand a proxy to a system that iterates against it a hundred times and you get the proxy, paid for with the thing it stood for. The scores go up. The results do not.",
      },
    ],
  },
];

export function WhichTasksExamples() {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="examples-heading">
      <div className="flex flex-col gap-3">
        <h2
          id="examples-heading"
          className="font-display text-2xl font-semibold tracking-tight text-fg"
        >
          Eight real tasks, run through the four questions
        </h2>
        <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
          Find the entry your task most resembles and read the check it turns on. The
          second column is written at full strength on purpose. This page exists to
          prevent one outcome: somebody picks a task nothing can verify, points a factory
          at it, gets back fluent work that is wrong in a way no node in the graph can
          detect, and concludes that dark factories do not work. The graph was fine. The
          task was never a candidate.
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
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
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
                        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim transition-colors group-hover:text-muted">
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
