import type { Metadata } from "next";

import { TutorialWizard } from "@/components/tutorial/TutorialWizard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpecPager } from "@/components/spec/SpecPager";

/* ============================================================
   /tutorial: write one blueprint, one keyword at a time.

   The page is a shell. Everything that moves is `TutorialWizard`, a
   client component because forty-four fields, a graph that repaints on
   every keystroke and a zip built in the tab are all things a server
   cannot do. What it imports is isomorphic: `lib/core` for the
   vocabulary and the validator, and three local modules that are pure
   functions over the typed values.

   Nothing is uploaded, and that is checkable: there is no route behind
   this page. The folder is assembled, archived and checked in the
   browser, and the one link that leaves is to `/capabilities#cli`.
   ============================================================ */

export const metadata: Metadata = {
  title: "Write your first blueprint",
  description:
    "Write a four-node blueprint by filling in its keywords: a crawler, an extractor, a checker with a capped loop and a writer, then a rubric to measure it by. Built and checked in your browser, downloaded from there. Nothing is uploaded.",
};

/** The last stop of the Learn sequence; the pager at the foot reads the list. */
const HERE = "/tutorial";

export default function TutorialPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Tutorial"
        title="Write your first blueprint"
        lead="A small pipeline that reads a set of websites and turns them into cited notes: four nodes, one loop, then a rubric to measure it by. Type over the highlighted keywords."
      />
      <TutorialWizard />
      <div className="mt-16">
        <SpecPager href={HERE} />
      </div>
    </div>
  );
}
