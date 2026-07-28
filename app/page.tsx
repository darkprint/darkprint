/* ============================================================
   The landing — doc 2 §2.1, six rungs, in order.

   §0 diagnosed the old one: "il sito definisce il concetto prima di
   far localizzare il lettore". The fix is the sequence, so the order
   below is the deliverable and not an arrangement of what happened to
   exist.

   1. claim              → the hero's own words
   2. anchoring          → SectionAnchor
   3. self-localisation  → SectionLevels
   4. one example        → SectionExample
   5. what it isn't      → SectionNotSkill
   6. two doors          → SectionDoors

   This is the *conceptual* onboarding of §0's table: a cold visitor,
   thirty seconds, what is this and why does it concern me. The
   practical one ("how do I build one", about an hour) is the guided
   path and stays physically separate.
   ============================================================ */

import { Hero } from "@/components/hero/Hero";
import {
  SectionAnchor,
  SectionLevels,
  SectionExample,
  SectionNotSkill,
  SectionDoors,
} from "@/components/home";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SectionAnchor />
      <SectionLevels />
      <SectionExample />
      <SectionNotSkill />
      <SectionDoors />
    </>
  );
}
