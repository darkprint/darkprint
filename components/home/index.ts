/* The landing's beats, in the order `app/page.tsx` renders them. Beat 1 is the hero and
   lives in `components/hero/`, so this barrel starts at beat 2.

   The directory holds more than this. `SectionLevels`, `SectionNodeCard`, `SectionRoles`
   and `SectionExample` are the rungs redesign spec §3 relocated, and they are still here
   at their own paths because moving the files would have rewritten four components on the
   same day their register changed. Their new pages (`/towards-a-dark-factory`,
   `/spec/card`, `/what-a-blueprint-is`) import them by path rather than through this
   barrel, which is the reason this list is allowed to be the landing's list and nothing
   else: a page that reads its section out of the landing's index would make the index a
   shared surface, and then no one could tell from it what the landing renders.

   `SectionRoles` is the one with no mount at all now. `/spec/topology` was its only one
   and the trim pass cut that band; the file and its two guards stay, so the drawing can
   be re-mounted without being re-derived. It is deliberately still absent from the
   exports below — the landing does not render it, and this barrel says only that.

   `SectionLifecycle` used to be on that list too, relocated to `/blueprints` by redesign
   spec §3. The lifecycle-scoring pass's own §2 brought a rewritten version of it back to
   the landing as a fifth beat, which is why it is exported here again rather than imported
   by path from `app/blueprints/page.tsx` the way it briefly was.

   `app/page.tsx` carries the table of where every rung went. */
export { SectionBlueprint } from "./SectionBlueprint";
export { SectionNodeIsCard } from "./SectionNodeIsCard";
export { SectionLifecycle } from "./SectionLifecycle";
export { SectionDoors } from "./SectionDoors";
