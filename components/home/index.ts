/* The landing's beats, in the order `app/page.tsx` renders them. Beat 1 is the hero and
   lives in `components/hero/`, so this barrel starts at beat 2.

   The directory holds more than this. `SectionLevels`, `SectionNodeCard`, `SectionRoles`,
   `SectionExample` and `SectionLifecycle` are the rungs redesign spec §3 relocated, and
   they are still here at their own paths because moving the files would have rewritten
   five components on the same day their register changed. Their new pages
   (`/towards-a-dark-factory`, `/spec/card`, `/spec/topology`, `/spec`, `/blueprints`)
   import them by path rather than through this barrel, which is the reason this list is
   allowed to be the landing's list and nothing else: a page that reads its section out of
   the landing's index would make the index a shared surface, and then no one could tell
   from it what the landing renders.

   `app/page.tsx` carries the table of where every rung went. */
export { SectionBlueprint } from "./SectionBlueprint";
export { SectionNodeIsCard } from "./SectionNodeIsCard";
export { SectionDoors } from "./SectionDoors";
