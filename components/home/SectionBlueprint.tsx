import { SectionHeading } from "@/components/ui/SectionHeading";

import { BeatCaption } from "./BeatCaption";
import { BlueprintWalk } from "./blueprint/BlueprintWalk";

/* ============================================================
   The landing's graph beat: one heading, the starter blueprint drawn
   on a sheet, and a caption that hands the reader to the page that
   explains what they just saw.

   The drawing is `./blueprint/BlueprintWalk.tsx`, a client component
   because the scene animates. Nothing here reads the archive: the
   placement is derived from `roles.ts`, which `roles.test.ts` holds
   to the starter bundle on disk.
   ============================================================ */

export function SectionBlueprint() {
  return (
    <section id="blueprint" className="scroll-mt-24 bg-void py-20 sm:py-28">
      <div className="container-page">
        {/* No eyebrow, because `.eyebrow` is rationed to one per page and the hero spends
            it. The register's own blue rather than cyan: `app/globals.css` spends cyan on
            "you can act on this", and a 32px headline in the interactive colour reads as a
            link that does nothing. A `<span>` inside `title` because the heading declares
            `text-fg` and `cx` is not `tailwind-merge`; a child's own colour always wins. */}
        <SectionHeading
          title={<span className="text-blueprint-line">This is a blueprint</span>}
          lead="Which agents run and what each hands to the next. Download the folder and run it."
          align="center"
          className="mx-auto"
        />

        <BlueprintWalk />

        <BeatCaption href="/what-a-blueprint-is" cta="What a blueprint is">
          A blueprint pins the handoffs, loops, checkpoints, and deliberate absences that
          make a workflow reusable. The files stay plain enough to inspect before your
          harness runs them.
        </BeatCaption>
      </div>
    </section>
  );
}
