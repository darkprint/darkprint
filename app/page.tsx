/* ============================================================
   The landing. Doc 2 §2.1's six rungs are the spine, and spec §3's
   table inserts three new sections between them.

   §0 diagnosed the old one: "il sito definisce il concetto prima di
   far localizzare il lettore". The fix is the sequence, so the order
   below is the deliverable and not an arrangement of what happened to
   exist. The rungs still run 1 to 6 in the same order they did; every
   new section sits between two of them and displaces none.

   1. claim              → Hero
      anchoring          → SectionAnchor            (rung 2)
      self-localisation  → SectionLevels            (rung 3)
                         → SectionNodeCard          spec §3.2
                         → SectionRoles             spec §3.3
      one example        → SectionExample           (rung 4)
                         → SectionLifecycle         spec §3.5
      what it isn't      → SectionNotSkill          (rung 5)
      two doors          → SectionDoors             (rung 6)

   Where the three go, and why there:

   - `SectionNodeCard` follows self-localisation because a reader who
     has just placed themselves on the five levels is the one for whom
     "a node is a card, and here is the card" is an answer rather than
     a detail. It is also the heaviest scroll on the page, so it wants
     a reader who has decided to stay.
   - `SectionRoles` follows the card for scale: the card lands inside
     one node of the starter graph at the end of §3.2's dezoom, and
     §3.3 is that same graph read as a division of labour. Two
     sections, one figure, seen twice at different magnifications.
   - `SectionLifecycle` follows the example because "what you can do
     with a blueprint" needs a blueprint the reader has already been
     shown. Placed before the example it would be instructions for
     handling an object nobody has seen.

   This is the *conceptual* onboarding of §0's table: a cold visitor,
   thirty seconds, what is this and why does it concern me. The
   practical one ("how do I build one", about an hour) is the guided
   path and stays physically separate.
   ============================================================ */

import { Hero } from "@/components/hero/Hero";
import {
  SectionAnchor,
  SectionLevels,
  SectionNodeCard,
  SectionRoles,
  SectionExample,
  SectionLifecycle,
  SectionNotSkill,
  SectionDoors,
} from "@/components/home";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SectionAnchor />
      <SectionLevels />
      <SectionNodeCard />
      <SectionRoles />
      <SectionExample />
      <SectionLifecycle />
      <SectionNotSkill />
      <SectionDoors />
    </>
  );
}
