import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
// Imported by path rather than through a barrel: `components/explain/` is shared with
// `/which-tasks`, and an `index.ts` that covered only half of it would read as the
// directory's inventory while being one.
import { isolationDemo } from "@/components/explain/starter-isolation";
import { SectionSkillVsFactory } from "@/components/explain/SectionSkillVsFactory";
import { SectionIsolationRule } from "@/components/explain/SectionIsolationRule";
import { SectionAbsentEdge } from "@/components/explain/SectionAbsentEdge";
import { SectionComponentRecap } from "@/components/explain/SectionComponentRecap";

/* ============================================================
   Doc 2 §3 — "cosa non è", the comparison with Skills.

   The document gives two reasons this page matters more than it
   looks, and the running order below is built around keeping
   both: it explains the concept better than any definition, and
   it justifies the entire premise of the registry. So the
   sections run definition → rule → demonstration → vocabulary,
   and the premise argument sits inside the rule section rather
   than at the end, where it would read as a footnote.

   Static: everything the page shows is read off the archive at
   build time, including the leaked variant of the starter bundle,
   which is assembled and scored during the build and never
   written anywhere. See components/explain/starter-isolation.ts.
   ============================================================ */

export const metadata: Metadata = {
  title: "What it isn't",
  description:
    "A Skill gives one agent a capability. A dark factory is the architecture of several agents and the isolation rules between them. Shown on a real bundle: the edge the starter blueprint deliberately does not have, and what the analyzer says when you add it.",
};

export default function WhatItIsntPage() {
  const demo = isolationDemo();

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="What it isn't"
            title="A Skill gives one agent a capability"
            lead="A dark factory is the architecture of several agents, and above all it is the set of isolation rules between them. Which of those two you are storing decides what a registry can be, so this page works the difference out on the one example that settles it."
          />
        </div>
      </header>

      <SectionSkillVsFactory />
      <SectionIsolationRule />
      {demo !== undefined && <SectionAbsentEdge demo={demo} />}
      <SectionComponentRecap />

      <section className="border-t border-line bg-surface py-16">
        <div className="container-page flex flex-col gap-5">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">
            Read one, or check your own
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/blueprints" variant="primary">
              Browse the blueprints
            </ButtonLink>
            <ButtonLink href="/upload" variant="outline">
              Validate a bundle
            </ButtonLink>
          </div>
          {/* The parity claim this paragraph used to make was false, and in the
              direction that flatters the site: the wizard builds its vocabulary from
              `CORE_ONTOLOGY` alone (components/upload/UploadFlow.tsx), while the archive
              is resolved against the core plus content/ontology/extensions.yaml. Dropping
              this release's own `frontline-triage` bundle into the wizard reports two
              unknown terms and scores it 4 where its page shows 2. Stated rather than
              quietly dropped, because a reader who tries it deserves to know first. */}
          <p className="max-w-2xl text-sm leading-relaxed text-dim">
            The upload wizard runs the real validator and the real analyzers in your
            browser, on files that never leave the tab. It resolves them against the
            curated core vocabulary only. Bundles in the archive are resolved against the
            core plus the terms this release adds in its own namespace, so a graph using
            one of those comes back with the term unknown and a security score computed
            without it. Publishing to the registry is not wired up either.
          </p>
        </div>
      </section>
    </>
  );
}
