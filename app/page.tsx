/* ============================================================
   The landing: seven beats, and nothing else.

   The hero is the claim, and the example under it shows an agent
   using the registry over MCP on a real task, so the first thing a
   reader sees the product do is its job. The reproducibility beat
   then argues the blueprint against the prompt, because "why not
   just a prompt?" is the objection that example raises. The graph
   beat and the card beat show one concept apiece off the real
   starter files. The registry beat says the registry is open to read
   and what an account is for. The last beat ends the page on one
   door: write your first blueprint.

   Everything technical the landing once carried lives on the page
   whose subject it is: the ladder on `/towards-a-dark-factory`, the
   annotated card on `/spec/card`, the roles and the absent edge on
   `/spec/topology`. The example is the exception because it shows a
   use rather than a part. `components/home/beats.test.ts` renders the
   beats the way the server does and holds their copy.
   ============================================================ */

import type { Metadata } from "next";

import { Hero } from "@/components/hero/Hero";
import {
  SectionMcpExample,
  SectionSameRun,
  SectionBlueprint,
  SectionNodeIsCard,
  SectionRegistry,
  SectionFirstBlueprint,
} from "@/components/home";

/**
 * The title stays the layout's default. The description is the landing's own because the
 * layout's leads with three verbs a search snippet truncates before it says what the site
 * holds.
 */
export const metadata: Metadata = {
  description:
    "A registry of reusable blueprints for agent workflows. Each blueprint is a graph plus one version-pinned card per node, checked before it is published. Search it, download a folder, and run it.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <SectionMcpExample />
      <SectionSameRun />
      <SectionBlueprint />
      <SectionNodeIsCard />
      <SectionRegistry />
      <SectionFirstBlueprint />
    </>
  );
}
