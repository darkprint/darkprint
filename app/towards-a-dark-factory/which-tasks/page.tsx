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

   ── The scale pass: this page was the last one off it ──
   It shipped as a single `container-page flex flex-col gap-14
   py-12` — 56px between sections and 48px of page padding, two
   values that are not on the eight-point scale the rest of the
   site now keeps, on the one page sitting between two that do.
   `/spec` recorded the same conversion and the same reason: the
   other two stops in this sequence, `/towards-a-dark-factory` and
   `/towards-a-dark-factory/the-climb`, mark every seam with a
   full-bleed edge and a ground change, so a reader crossing from
   one to the next met a third rhythm in the middle of a
   three-page route. The device here is theirs — `border-t`, an
   alternating ground, and `py-16 sm:py-20` — and the four
   components below it own their own headings, so each band is a
   ground and a container and nothing else.
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
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="Before you build one"
            title="Which tasks a dark factory can take"
            lead="Four questions settle it, and all four are about the task rather than about the graph you would draw for it."
          />
          {/* The block tier, not the 24px this stacked at. The figure is what the lead
              hands the reader to, and `SectionHeading` → content is 40px everywhere on
              the site the scale reached. */}
          <div className="mt-10">
            <WhichTasksGlance />
          </div>
        </div>
      </header>

      {/* No `border-t` on the first band: the header above it closes on its own
          `border-b`, which is how `/the-climb` opens too. The grounds alternate from
          here down so every seam is a change of ground as well as a rule. */}
      <section className="bg-surface py-16 sm:py-20">
        <div className="container-page">
          <WhichTasksExamples />
        </div>
      </section>

      <section className="border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <WhichTasksChecks />
        </div>
      </section>

      <section className="border-t border-line bg-surface py-16 sm:py-20">
        <div className="container-page">
          <WhichTasksRemedies />
        </div>
      </section>

      <section className="border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <p className="prose-lane text-sm leading-relaxed text-muted">
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
      </section>
    </>
  );
}
