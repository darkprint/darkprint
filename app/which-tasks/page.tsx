import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhichTasksGlance } from "@/components/explain/WhichTasksGlance";
import { WhichTasksChecks } from "@/components/explain/WhichTasksChecks";
import { WhichTasksExamples } from "@/components/explain/WhichTasksExamples";
import { WhichTasksRemedies } from "@/components/explain/WhichTasksRemedies";

export const metadata: Metadata = {
  title: "Which tasks fit",
  description:
    "Four questions that decide whether a task belongs in a dark factory: whether a machine can return the verdict, whether the harness exists, whether the target is written down, and what a wrong answer costs. With eight worked examples on both sides.",
};

/**
 * Doc 2 §4. Short page, and it has two jobs at once.
 *
 * The first is the one the tester asked for and nobody answers. The second is to work as
 * a filter: someone who takes an unverifiable task to a factory gets confident garbage
 * back and concludes the pattern is vapour, and that reader is lost for good. Which is
 * why the unsuitable side is written at full strength: a hedge here costs more than it
 * saves.
 *
 * ── Spec §4.3, the running order ──
 * "The section Which tasks is good but too wordy, you need to make people get in a glance
 * the concepts." The material was right and the sequence was wrong: four questions in
 * full, then eight examples, then the remedies, which is the instrument before anything
 * to point it at. So the page now opens with the whole argument as one drawing, puts the
 * eight tasks second because a reader settles a comparison faster than a definition, and
 * keeps the four questions and the three remedies underneath at full length.
 *
 * Nothing was removed. The two long sections moved their reasoning behind a `<details>`
 * per item, which changes what is on screen before a click and nothing else.
 */
export default function WhichTasksPage() {
  return (
    <div className="container-page flex flex-col gap-14 py-12">
      <header className="flex flex-col gap-6">
        <SectionHeading
          as="h1"
          eyebrow="Before you build one"
          title="Which tasks a dark factory can take"
          lead="Four questions settle it, and all four are about the task rather than about the graph you would draw for it."
        />
        <WhichTasksGlance />
      </header>

      <WhichTasksExamples />

      <WhichTasksChecks />

      <WhichTasksRemedies />

      <section className="flex flex-col gap-4" aria-labelledby="filter-heading">
        <h2
          id="filter-heading"
          className="font-display text-2xl font-semibold tracking-tight text-fg"
        >
          Why the page is written this flatly
        </h2>
        <p className="max-w-3xl border-l-2 border-cyan/50 pl-5 text-sm leading-relaxed text-muted">
          This page exists to prevent one outcome in particular. Somebody picks a task
          nothing can verify, points a factory at it, gets back fluent work that is wrong
          in a way no node in the graph is able to detect, and concludes that dark
          factories do not work. The graph was fine. The task was never a candidate, and
          five minutes of reading would have said so.
        </p>
      </section>

      {/* The register established by the telemetry section on the homepage: say what is
          missing in the same breath as what it is for, and do not dress an intention up
          as a feature. */}
      <section
        className="panel flex flex-col gap-3 p-6"
        aria-labelledby="standing-heading"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
          Where this leaves you
        </span>
        <h2
          id="standing-heading"
          className="font-display text-xl font-semibold text-fg"
        >
          Nothing on this site runs a factory
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          DarkPrint reads bundles, scores autonomy and security off the drawing without
          executing a line, and hands you the files. Execution happens on your own machine
          through Claude Code or an agent that reads the same cards. Publishing is not
          built, and there is no MCP server to point a client at yet.
        </p>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          The four questions are yours to apply, and a yes now has somewhere to go. The{" "}
          <Link
            href="/build"
            className="font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan"
          >
            guided path
          </Link>{" "}
          walks the choices that shape a starter factory, prints what each one does to the
          two computed scores, and ends with a folder you download and run yourself. You
          can also{" "}
          <Link
            href="/blueprints"
            className="font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan"
          >
            read published graphs
          </Link>{" "}
          and see how their authors handled the same four answers, or{" "}
          <Link
            href="/what-it-isnt"
            className="font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan"
          >
            read why the isolation rules live in the topology
          </Link>
          , where no single agent can talk itself out of them.
        </p>
        {/* The other half of a yes. This page answers whether the work qualifies; the
            climb answers what a team has to be able to do before any of it runs
            unattended, and the two questions are asked by the same reader on the same
            afternoon. */}
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          A task that passes all four still needs an organisation that can run it without
          watching.{" "}
          <Link
            href="/how-to-build-a-dark-factory"
            className="font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan"
          >
            How one team got there
          </Link>{" "}
          reads a published account of the climb: four phases, the holdout scenarios that
          make the quality gate mean something, and the thresholds they measured before
          taking a person off the merge button.
        </p>
      </section>
    </div>
  );
}
