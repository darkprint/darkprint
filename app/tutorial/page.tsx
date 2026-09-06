import type { Metadata } from "next";

import { TutorialWizard } from "@/components/tutorial/TutorialWizard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /tutorial — write one blueprint, one keyword at a time

   The page is a shell. Everything that moves is `TutorialWizard`,
   which is a client component because forty-four fields, a graph
   that repaints on every keystroke and a zip built in the tab are
   all things a server cannot do. What it imports is isomorphic:
   `lib/core` for the vocabulary and for the validator, and three
   local modules that are pure functions over the typed values.

   ── nothing is uploaded, and it is checkable ──
   There is no route behind this page and no seam owed for it. The
   folder is assembled, archived and validated in the browser, and
   the one link that leaves is to `/capabilities#cli` for the two
   commands the reader runs afterwards.
   ============================================================ */

export const metadata: Metadata = {
  title: "Write your first blueprint",
  /* The subject and the fact that decides whether a reader has time for it: this is a real
     bundle they finish holding, not a walkthrough of somebody else's. The refusal is the
     third clause because a page that takes a reader's typing owes them the same sentence
     `/upload` prints above its dropzone. */
  description:
    "Fill in the keywords of a real blueprint: four nodes, one loop and a rubric to measure it by. The folder is assembled and checked in your own browser and downloaded from there. Nothing is uploaded.",
};

export default function TutorialPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Tutorial"
        title="Write your first blueprint"
        lead="A desk that reads a set of websites and turns them into cited knowledge. Four nodes, one loop, then a rubric to measure it by. Type over the highlighted keywords."
      />
      <TutorialWizard />
    </div>
  );
}
