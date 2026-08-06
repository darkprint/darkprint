/* ============================================================
   The landing: five beats, and nothing else.

   ── Why doc 2 §2.1's six rungs are no longer here ──
   They were, all six of them on one scroll, and the author read the
   result and rejected it:

     "the landing page should be fancy with the text DarkPrint like
      previous and now it is a flat landing page with a lot of
      content. The landing should have concepts and suggestive
      illustration not technical ones. The content of the landing
      should be rearranged in other pages as it is useful."

   The six rungs are still the site's sequence. What changed is
   where a cold visitor walks them: across the pages whose subject
   each rung already was, instead of down one page that had to be
   about everything. The ladder was distributed rather than
   dropped, and the table below is the record of where each rung
   went, so that the next person reads it as a move and not as a
   loss. Restoring any row of it to this file puts the flat landing
   back.

     rung 1  claim              Hero              beat 1, kept here
     rung 2  anchoring          SectionAnchor     /what-it-isnt, rewritten
                                                  as components/explain/
                                                  SectionWhatItIs
     rung 3  self-localisation  SectionLevels     /towards-a-dark-factory
     rung 4  one example        SectionExample    /spec, then
                                                  /what-a-blueprint-is when
                                                  the IA pass deleted /spec
     rung 5  what it isn't      SectionNotSkill   /what-it-isnt, folded into
                                                  SectionSkillVsFactory and
                                                  SectionIsolationRule
     rung 6  two doors          SectionDoors      beat 5, kept here

   Redesign spec §3 sent three more sections the same way: the
   annotated node card to `/spec/card`, the five roles and the
   absent edge to `/spec/topology`, and download / fork / update to
   `/blueprints`. The first two are untouched at their old paths
   under `components/home/` and their new pages import them
   directly, which is why `components/home/index.ts` is shorter than
   the directory it names.

   The third one came back. The lifecycle-scoring pass's own §2
   rewrote download / fork / update as download / compose / upload —
   fork moved again, to a disclosure on the blueprint detail page
   itself (`ForkAction`), and update moved out for good, since
   `components/nodes/VersionHistory.tsx` already tells that story off
   real published cards — and reinserted the result here as beat 4,
   between the card beat and the doors. `/blueprints` no longer
   renders it at all. Doc 2 §0.4 and this pass's own §1 govern what
   the new beat may say about forking and uploading; `SectionLifecycle`
   carries the reasoning, not this table.

   Two rungs never left. Rung 1 is the site's claim and rung 6 is the
   two doors, and those are the only two whose subject is the site
   itself; every other rung is about a blueprint, a card or a
   ladder, and each of those still has its own page.

   ── What the five beats are ──
   One illustration and roughly one sentence each, mostly. Beat 1 is
   the wordmark and takes the animation budget, because it is the
   thing the author missed and the first thing anyone sees. Beats 2
   and 3 carry one concept apiece in the luminous-flow register of
   spec §1. Beat 4 is three short panels, each its own sentence and
   its own figure, of what a reader can do with the folder beat 2
   just drew: download it, compose it into something bigger, or
   upload it for the analyzer to read. Beat 5 is the two doors.

   Beat 5 used to be a fifth beat on its own count, the lights going
   out across the starter graph (`SectionLightsOut`), cut from the
   landing at the author's request. Doc 2 §1.1's constraint that beat
   existed to guard — a graph with a person in it is a first-class
   blueprint, never a shortfall — still binds every autonomy reading
   on the site; it is simply no longer illustrated on this page.

   No YAML, no scorecard, no term table and no code listing survive
   on this page. Spec §6 greps the built HTML for all of that;
   `components/home/beats.test.ts` renders the beats the way the
   server does and fails a minute earlier.
   ============================================================ */

import { Hero } from "@/components/hero/Hero";
import {
  SectionBlueprint,
  SectionNodeIsCard,
  SectionLifecycle,
  SectionDoors,
} from "@/components/home";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SectionBlueprint />
      <SectionNodeIsCard />
      <SectionLifecycle />
      <SectionDoors />
    </>
  );
}
