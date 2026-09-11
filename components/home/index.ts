/* The landing's beats, in the order `app/page.tsx` renders them. Beat 1 is the hero and
   lives in `components/hero/`, so this barrel starts at beat 2.

   The directory holds more than this: `SectionLevels`, `SectionNodeCard` and
   `SectionRoles` are sections other pages mount by path. They are deliberately absent
   from the exports below so this list says exactly what the landing renders. */
export { SectionSameRun } from "./SectionSameRun";
export { SectionBlueprint } from "./SectionBlueprint";
export { SectionNodeIsCard } from "./SectionNodeIsCard";
export { SectionFirstBlueprint } from "./SectionFirstBlueprint";
