import type { Metadata } from "next";

import { SectionLevels } from "@/components/home/SectionLevels";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /towards-a-dark-factory: where you stand on the ladder, and what a
   dark factory is.

   The deck defines the phrase before the ladder can put it at risk. A
   dark factory is one shape a blueprint can take, and a graph with a
   person standing in it is a first-class blueprint shelved beside the
   rest; that constraint sits above the picture rather than in a
   smaller line under it, because three disclaimers do not fix a
   layout.

   The ladder is `components/home/SectionLevels.tsx`, imported by path
   rather than through the `components/home` barrel so that moving it
   off the landing's index cannot break this route. `levels.test.ts`
   holds its copy and this page's.

   The page ends on the pager, and its PREVIOUS is whatever
   `SPEC_SEQUENCE` puts before this stop: a hand-written arrow pointed
   at a deleted page twice in three days.
   ============================================================ */

export const metadata: Metadata = {
  title: "Towards a Dark Factory",
  description:
    "Four levels of working with coding agents, from autocomplete to a pipeline nobody watches, and where most teams sit today. The gap between level 2 and level 4 is architectural and organisational, which makes it a design problem.",
};

const HERE = "/towards-a-dark-factory";

export default function TowardsPage() {
  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SpecCrumb href={HERE} />
          <SectionHeading
            className="mt-5"
            as="h1"
            eyebrow="Four levels"
            title="Towards a Dark Factory"
            /* The five phases are the closed set a node card declares a `phase` from, so
               the definition costs no new vocabulary. "Inside a harness somebody wrote" is
               the cause and unattended is the consequence: the linked source defines the
               pattern by the layered control system holding it up, and a lead defining it
               purely by what is absent reads as fewer rules rather than more. */
            lead="A dark factory is one shape a blueprint can take: a graph where planning, implementation, testing, debugging and deployment all run unattended, inside a harness somebody wrote. Running unattended is something you pay to build, and it is one shape among several. A graph with a person standing in it is a first-class blueprint here, shelved beside the rest."
          />
          {/* The page's premise, ahead of the ladder: the ladder measures how much of a run
              goes unattended, and this is the one property that decides whether unattended
              is possible at all. `text-fg` across the whole line because it is the only
              body prose in this header. */}
          <p className="mt-6 text-[15px] leading-[1.7] text-fg">
            A dark factory runs with nobody watching it. So the design rests on one property
            of the work: whether something other than your judgement can tell the graph it
            is finished.
          </p>
        </div>
      </header>

      <SectionLevels />

      {/* Same ground as the sources band above and no `border-t`: the sources and this pager
          are the route's one closing block. */}
      <section className="bg-surface pb-20">
        <div className="container-page">
          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
