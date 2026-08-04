import Link from "next/link";

/* ============================================================
   Doc 2 §4 — "quali task sono adatti", turned from two bullet
   lists into something a reader can run against their own work.

   The doc gives four conditions for suitable and three for not
   suitable, and they are not seven independent facts: they pair
   up onto four questions. Automatic verifiability and an existing
   suite stay apart, because one asks whether a verdict is possible
   at all and the other whether the harness exists yet. Bounded
   scope and ambiguous requirements are one question read from two
   ends, and so are cheap-to-be-wrong and an error reaching
   production.

   Each question therefore carries both sides of its pair. The
   second side is written as flatly as the first: this page is a
   filter, and a filter that hedges lets through the person who
   was about to run a factory at something nothing can check.

   ── Spec §4.3: the same four, at a quarter of the height ──
   The author's reading of this page was "good but too wordy, you
   need to make people get in a glance the concepts." Four
   full-width cards carrying a question, a probe, two readings and
   a paragraph on what breaks came to four screenfuls, and the
   fourth question is the one that decides the most.

   Not one sentence was cut at the time. The four cards sit two
   abreast and show the question, which is what a reader compares
   their own task against; the probe and the paragraph on what
   stops working move into a `<details>` under each card. Both are
   prose that rewards the reader who has already found their
   question and costs the reader who has not.

   `<details>` and not a script: the content is in the prerendered
   HTML either way, it is searchable in the page, and it opens
   with JavaScript switched off.

   ── Redesign spec §5: one panel removed ──
   A closing panel headed "Three of the four are work. One is a
   veto." restated, at a hundred and thirty words, the two
   paragraphs the opening figure's caption already carries. Its one
   sentence that was not a repeat, the instruction not to add the
   four up, moved into that caption, where a reader meets the
   counting temptation first. Nothing else went.

   ── The length pass (PROJECT.md §3.1): the two readings went ──
   Each card carried a `yes` and a `no`, one line each, illustrating
   the question with an example. `WhichTasksExamples` sits directly
   above and does that at length, with eight worked tasks, and every
   one of them is already tagged with the check it turns on. So the
   readings were the same instrument applied twice on one screen,
   and in two places three times over: `03`'s yes was "Move forty
   call sites off a deprecated API. Add one field through migration,
   model, handler and client", which is the titles of two of the
   four suitable examples, and `03`'s no was "Modernise the billing
   code", which `WhichTasksRemedies` quotes as the sentence it
   rewrites. `04`'s pair named the branch nobody merged and the
   migration that rewrites rows in place, which are two more example
   titles.

   One fragment of them was not a repeat and it moved rather than
   went: `02`'s yes offered a second kind of oracle, the old
   implementation still in the tree to diff every output against.
   That is now the second half of `02`'s probe.

   What each card keeps is the part the examples do not carry: the
   question itself, something the reader can do in under a minute
   to settle it, and what inside the factory stops working on a no.

   ── `01` and `03` were cut and are back ──
   That pass dropped both, on the reading that each was a second
   statement of a sentence the examples above already make. Half of
   each was. The other half was not, and nothing on the site picked
   it up.

   `01`: "a tester handed this has nothing to test against and
   passes whatever it is given" is indeed in the doesn't-fit column
   above. What is not anywhere else is why that matters — the tester
   is the one node standing between generated code and the release
   gate, and a graph whose only verdict rubber-stamps is an
   expensive way to run one prompt. A grep for "release gate" over
   the built pages returned one hit, the figure's description of the
   starter wiring, which states the edge and not the tester's
   position on it.

   `03`: "every node downstream will build on a guess" is in the
   examples. That ambiguity never surfaces as an error, and that the
   run is over before anyone finds out, is the part that tells a
   reader why this check is a veto rather than a caution, and it had
   no home.

   Both sit in the same `<details>` as the probe, so restoring them
   costs no visible words: the disclosure is one summary line either
   way.
   ============================================================ */

type Check = {
  id: string;
  n: string;
  /** Short handle, so the examples below can name the check they turn on. */
  name: string;
  color: string;
  /** The question, asked about the reader's own task. */
  question: string;
  /** Something they can do in under a minute that settles it. */
  probe: string;
  /** What inside the factory stops working when the answer is no, where nothing else says it. */
  breaks?: React.ReactNode;
};

const CHECKS: Check[] = [
  {
    id: "verdict",
    n: "01",
    name: "The verdict",
    color: "var(--color-cyan)",
    question: "Can something other than you decide whether the output is correct?",
    probe:
      "Name the command that exits non-zero when the work is wrong. If you cannot name it, stop here.",
    breaks: (
      <>
        The tester is the one node standing between generated code and the release gate.
        Give it nothing to produce a verdict from and it approves everything, which turns
        the whole graph into an expensive way to run one prompt.
      </>
    ),
  },
  {
    id: "harness",
    n: "02",
    name: "The harness",
    color: "var(--color-emerald)",
    question: "Does the check already exist, or can you write it before the work starts?",
    probe:
      "Write the failing test now, or diff every output against the old implementation still in the tree. If that is slower than doing the task, so is the blueprint.",
    breaks: (
      <>
        A verdict is worth something because the builder never sees the acceptance
        criteria, so they have to live somewhere it cannot reach. With no harness there is
        nowhere to put them, and the model that wrote the change signs it off.{" "}
        <Link
          href="/spec/topology"
          className="font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan"
        >
          Why that isolation is topology
        </Link>
        .
      </>
    ),
  },
  {
    id: "edges",
    n: "03",
    name: "The edges",
    color: "var(--color-violet)",
    question: "Is the target written down, and does it stop somewhere?",
    probe:
      "Name three files you do not want touched. If you cannot, the requirements are still being invented.",
    breaks: (
      <>
        Ambiguity never arrives as an error. It arrives as confident work in a direction
        somebody would have vetoed, executed faithfully by every node downstream. The run
        is over before anyone finds out.
      </>
    ),
  },
  {
    id: "blast",
    n: "04",
    name: "The cost of being wrong",
    color: "var(--color-amber)",
    question: "If this lands wrong, who finds out, and how long do you have?",
    probe:
      "Describe the rollback in one sentence. If the sentence contains the word incident, the answer is no.",
    breaks: (
      <>
        Cheap failure is what pays for the debug loop, and the loop is most of the design.
        A task with no loop leaves a code generator you are not watching.
      </>
    ),
  },
];

export function WhichTasksChecks() {
  return (
    <section className="flex flex-col gap-5" aria-labelledby="checks-heading">
      <h2
        id="checks-heading"
        className="font-display text-2xl font-semibold tracking-tight text-fg"
      >
        The four questions in full
      </h2>

      <ol className="grid gap-4 lg:grid-cols-2">
        {CHECKS.map((c) => (
          <li
            key={c.id}
            className="panel flex flex-col gap-4 p-5"
            style={{ borderTop: `2px solid ${c.color}` }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="font-mono text-[11px] uppercase tracking-[0.18em]"
                style={{ color: c.color }}
              >
                {c.n}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                {c.name}
              </span>
            </div>

            <h3 className="font-display text-lg font-semibold leading-snug text-fg">
              {c.question}
            </h3>

            <details className="group border-t border-line pt-3">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden font-mono text-[11px] uppercase tracking-[0.14em] text-dim transition-colors hover:text-fg">
                <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
                  ▸{" "}
                </span>
                {c.breaks === undefined ? "Settle it" : "Settle it, and what a no breaks"}
              </summary>
              <p className="mt-3 rounded border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-muted">
                {c.probe}
              </p>
              {c.breaks !== undefined && (
                <p className="mt-3 border-l-2 border-line-bright pl-4 text-sm leading-relaxed text-dim">
                  {c.breaks}
                </p>
              )}
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
