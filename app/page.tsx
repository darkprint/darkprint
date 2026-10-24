import type { Metadata } from "next";

import { SectionBlueprintFiles } from "@/components/home/SectionBlueprintFiles";
import { Hero } from "@/components/hero/Hero";
import { SectionMcpExample } from "@/components/home/SectionMcpExample";
import { SectionFirstBlueprint } from "@/components/home/SectionFirstBlueprint";

/**
 * The title stays the layout's default. The description is the landing's own because the
 * layout's leads with three verbs a search snippet truncates before it says what the site
 * holds.
 */
export const metadata: Metadata = {
  description:
    "Reusable blueprints for agent workflows. Find a graph and its versioned node cards, then adapt the files with your own coding agent. DarkPrint does not run blueprints.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <SectionMcpExample />
      <SectionBlueprintFiles />
      <SectionFirstBlueprint />
    </>
  );
}
