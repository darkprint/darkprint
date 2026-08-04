import type { Metadata } from "next";
import Link from "next/link";

import { WhichTasksChecks } from "@/components/explain/WhichTasksChecks";
import { WhichTasksExamples } from "@/components/explain/WhichTasksExamples";
import { WhichTasksGlance } from "@/components/explain/WhichTasksGlance";
import { WhichTasksRemedies } from "@/components/explain/WhichTasksRemedies";
import { RoutePager } from "@/components/howto";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   Doc 2 §4, moved under `/towards-a-dark-factory` by redesign spec
   §4.2. The author asked for it in one line: "/which-tasks should
   be placed in The climb part which I'd rename Towards a Dark
   Factory". Same material, second page of three.

   The page has two jobs at once. The first is the one the tester
   asked for and nobody answers. The second is to work as a filter:
   someone who takes an unverifiable task to a factory gets
   confident garbage back and concludes the pattern is vapour, and
   that reader is lost for good. Which is why the unsuitable side
   is written at full strength.

   ── The running order, and what left ──
   Figure, then the eight tasks, then the four questions in full,
   then what to do with a no. A reader settles a comparison faster
   than a definition, so the examples sit above the definitions.

   Redesign spec §5 licensed three cuts on this page and they are
   recorded where they happened: the tally panel in
   `WhichTasksChecks`, the "why the page is written this flatly"
   section in `WhichTasksExamples`, and the closing panel this file
   used to end on. That panel restated, word for word, the honesty
   note `/towards-a-dark-factory/the-climb` and `/what-it-isnt`
   both carried; one copy survives, on the page most likely to read
   as a pitch, and it is now the only one anywhere since
   `/what-it-isnt` was removed. The links it held are the line under
   the pager.

   ── The length pass (PROJECT.md §3.1): 1,763 prose words ──
   The author's reading was that the page is long enough to skip.
   The figure at the top was already carrying the argument, so what
   went is what the figure or the eight examples had already said.
   Each of the four components records its own cut in its header;
   the one that happened in this file is the line under the pager,
   which named three destinations and glossed each. It names two
   now. The third gloss, "the isolation rules live in the topology
   where no single agent can talk itself out of them", is what
   `WhichTasksChecks`'s second card says at greater length, and its
   link is the same link — repointed to `/spec/topology` when
   `/what-it-isnt` was removed.
   ============================================================ */

export const metadata: Metadata = {
  title: "Which tasks a dark factory can take",
  description:
    "Four questions that decide whether a task belongs in a dark factory: whether a machine can return the verdict, whether the harness exists, whether the target is written down, and what a wrong answer costs. With eight worked examples on both sides.",
};

const HERE = "/towards-a-dark-factory/which-tasks";

const INLINE =
  "font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan";

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

      <div className="flex flex-col gap-6">
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          A yes now has somewhere to go: the{" "}
          <Link href="/build" className={INLINE}>
            guided path
          </Link>
          , and the{" "}
          <Link href="/blueprints" className={INLINE}>
            published graphs
          </Link>
          , whose authors handled the same four answers.
        </p>
        <RoutePager href={HERE} />
      </div>
    </div>
  );
}
