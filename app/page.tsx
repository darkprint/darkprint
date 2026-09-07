/* ============================================================
   The landing: five beats, and nothing else.

   The hero is the claim. The reproducibility beat argues the
   blueprint against the prompt before either artefact appears,
   because "why not just a prompt?" is the objection a reader forms in
   the second after the hero. The graph beat and the card beat show
   one concept apiece off the real starter files, and the lifecycle
   beat ends the page with five ways in, so no second set of doors is
   needed under it.

   Everything technical the landing once carried lives on the page
   whose subject it is: the ladder on `/towards-a-dark-factory`, the
   annotated card on `/spec/card`, the roles and the absent edge on
   `/spec/topology`. Putting a row of it back here puts the flat
   landing back. `components/home/beats.test.ts` renders the beats the
   way the server does and holds their copy.
   ============================================================ */

import type { Metadata } from "next";

import { Hero } from "@/components/hero/Hero";
import {
  SectionSameRun,
  SectionBlueprint,
  SectionNodeIsCard,
  SectionLifecycle,
} from "@/components/home";

/**
 * The title stays the layout's default. The description is the landing's own because the
 * layout's leads with three verbs a search snippet truncates before it says what the site
 * holds.
 */
export const metadata: Metadata = {
  description:
    "A registry of reusable blueprints for agent workflows. Each blueprint is a graph plus one version-pinned card per node, checked before it is published. Search it, download a folder, and run it with your own harness.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <SectionSameRun />
      <SectionBlueprint />
      <SectionNodeIsCard />
      <SectionLifecycle />
    </>
  );
}
