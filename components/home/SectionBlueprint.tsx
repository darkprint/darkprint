import { bundleSource } from "@/lib/content";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { BlueprintWalk } from "./blueprint/BlueprintWalk";

/* ============================================================
   Beat 2: a graph, and then the file the graph is a picture of.

   The drawing and everything about how it is placed are unchanged and now live in
   `./blueprint/BlueprintWalk.tsx`, which is the client half. This file is the server half
   and it exists for one reason: to read `blueprint.dot` off the archive at build time.

   ── Why the split ──
   The author asked the drawing to be replaced by its own source as a reader scrolls
   ("to give to the user the intuition how it is defined"). The source has to be the REAL
   file — a hand-typed approximation of a DOT file on the page that introduces DOT files
   would be the one thing this beat cannot afford — and reading it means `node:fs`, which a
   `"use client"` module cannot do.

   `SectionNodeIsCard` and `CardWalk` are the same pair for the same reason one beat down,
   and this follows them rather than inventing a second arrangement.

   ── Why `bundleSource` and not a path ──
   `lib/content` already reads every bundle once and caches it; `components/home/roles.ts`
   names the same blueprint by path for its own test to check the drawing against. Going
   through the reader means the bytes on this page are the bytes the rest of the site
   resolved, scored and publishes, rather than a second read of the same file that could
   drift from it.
   ============================================================ */

/** The blueprint every worked example on this site opens with. */
const STARTER = "starter-software-factory";

/** What the file is called in the folder that downloads, and in the sheet's own rail. */
const FILE = "blueprint.dot";

export function SectionBlueprint() {
  const { dot } = bundleSource(STARTER);

  return (
    <section id="blueprint" className="scroll-mt-24 bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The drawing"
          title="This is a blueprint"
          /* The lead names the swap now. A reader who scrolls into a drawing that dissolves
             into a file with no warning has been shown a trick; one who has been told the
             drawing is a picture of a file watches it become one. */
          lead="Which agents run, what each one hands to the next, and it is already yours to run. Keep scrolling and the drawing becomes the file it is drawn from."
          align="center"
          className="mx-auto"
        />

        <BlueprintWalk dot={dot.trimEnd()} file={FILE} />
      </div>
    </section>
  );
}
