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

   Not one sentence was cut. The four cards now sit two abreast
   and show the question and the two readings, which is what a
   reader compares their own task against; the probe and the
   paragraph on what stops working move into a `<details>` under
   each card. Both are prose that rewards the reader who has
   already found their question and costs the reader who has not.

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
  yes: string;
  no: string;
  /** What inside the factory stops working when the answer is no. */
  breaks: React.ReactNode;
};

const CHECKS: Check[] = [
  {
    id: "verdict",
    n: "01",
    name: "The verdict",
    color: "var(--color-cyan)",
    question: "Can something other than you decide whether the output is correct?",
    probe:
      "Name the command that exits non-zero when the work is wrong. If you cannot name it, stop at this question.",
    yes: "pytest exits 1, or tsc reports fourteen errors. The parser round-trips every sample in the corpus and the bytes match.",
    no: "You read the output and it seems off. The criterion is in your head, and the only way to apply it is to look.",
    breaks: (
      <>
        The tester is the one node standing between generated code and the release gate,
        and it works by producing a verdict. Give it nothing to produce a verdict from
        and it approves everything, which turns the whole graph into an expensive way to
        run one prompt.
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
      "Write the failing test now. If writing it takes longer than doing the task yourself, the factory is the slower route.",
    yes: "A suite already covers the module. The old implementation is still in the tree and you can diff every output against it.",
    no: "Nothing covers this code and nobody can say what correct looks like until they have seen the output.",
    breaks: (
      <>
        The rule that makes a verdict worth anything is that the builder never sees the
        acceptance criteria, so the criteria have to live somewhere the builder cannot
        reach. With no harness there is nowhere to put them, and the model that wrote the
        change goes back to being the model that signs it off.{" "}
        <Link
          href="/what-it-isnt"
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
      "Say out loud what is out of scope. Name three files you do not want touched. If you cannot, the requirements are still being invented.",
    yes: "Move forty call sites off a deprecated API. Add one field through migration, model, handler and client.",
    no: "Modernise the billing code. Clean up the auth layer. The planner will return a plan, and it will be a competent plan for a task nobody has defined.",
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
    yes: "A red pipeline. A branch you abandon without merging it.",
    no: "A migration that rewrites rows in place. A deploy that reaches customers before anyone has read the diff.",
    breaks: (
      <>
        Cheap failure is what pays for the debug loop, and the loop is most of the design.
        A task that has to be right on the first attempt is a task with no loop, and what
        is left is a code generator you are not watching.
      </>
    ),
  },
];

function Side({
  word,
  glyph,
  color,
  text,
}: {
  word: string;
  glyph: string;
  color: string;
  text: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]"
        style={{ color }}
      >
        <span aria-hidden>{glyph}</span>
        {word}
      </span>
      <p className="text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}

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

            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Side
                word="reads as yes"
                glyph="✓"
                color="var(--color-emerald)"
                text={c.yes}
              />
              <Side
                word="reads as no"
                glyph="✕"
                color="var(--color-signal)"
                text={c.no}
              />
            </div>

            <details className="group border-t border-line pt-3">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden font-mono text-[11px] uppercase tracking-[0.14em] text-dim transition-colors hover:text-fg">
                <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
                  ▸{" "}
                </span>
                How to settle it, and what breaks on a no
              </summary>
              <p className="mt-3 rounded border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-muted">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                  Settle it{" "}
                </span>
                {c.probe}
              </p>
              <p className="mt-3 border-l-2 border-line-bright pl-4 text-sm leading-relaxed text-dim">
                {c.breaks}
              </p>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
