import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
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
 */
export default function WhichTasksPage() {
  return (
    <div className="container-page flex flex-col gap-14 py-12">
      <header className="flex flex-col gap-5">
        <SectionHeading
          as="h1"
          eyebrow="Before you build one"
          title="Which tasks a dark factory can take"
          lead="A dark factory runs with nobody watching it, which puts the weight of the whole design on one property of the work: whether something other than your judgement can tell the graph that it is finished. That property belongs to the task, and it is fixed before you draw a single node. Four questions below tell you whether your task has it."
        />
        <p className="max-w-3xl border-l-2 border-cyan/50 pl-5 text-sm leading-relaxed text-muted">
          This page exists to prevent one outcome in particular. Somebody picks a task
          nothing can verify, points a factory at it, gets back fluent work that is wrong
          in a way no node in the graph is able to detect, and concludes that dark
          factories do not work. The graph was fine. The task was never a candidate, and
          five minutes of reading would have said so.
        </p>
      </header>

      <WhichTasksChecks />

      <WhichTasksExamples />

      <WhichTasksRemedies />

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
      </section>
    </div>
  );
}
