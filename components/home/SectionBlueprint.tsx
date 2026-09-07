import { bundleSource } from "@/lib/content";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { BeatCaption } from "./BeatCaption";
import { BlueprintWalk } from "./blueprint/BlueprintWalk";
import { ARCHIVE_OWNER, blueprintHref } from "@/lib/href";

/* ============================================================
   The landing's graph beat, server half: it reads `topology.dot` off
   the archive and hands it to `./blueprint/BlueprintWalk.tsx`, the
   client half that draws and animates.

   The source has to be the real file, because a hand-typed
   approximation of a DOT file on the page that introduces DOT files
   is the one thing this beat cannot afford, and reading it means
   `node:fs`, which a client module cannot do. `bundleSource` rather
   than a path so the bytes here are the bytes the rest of the site
   resolved and publishes.
   ============================================================ */

/** The blueprint every worked example on this site opens with. */
const STARTER = "starter-software-factory";

/** What the file is called in the folder that downloads, and in the panel's own rail. */
const FILE = `${STARTER}/topology.dot`;

/**
 * The DOT with its comment lines taken out.
 *
 * The archive's file carries a dozen comment lines arguing why the planner never reaches
 * the builder and why the loop terminates. `/spec/topology` shows the file with them,
 * because that page is where a reader studies the notation; this beat shows what is behind
 * a picture, and twelve lines of prose in a short file is the argument arriving before the
 * shape.
 *
 * Only whole comment lines go, so a trailing comment after a statement can never take the
 * statement with it. Blank runs collapse to one so the file does not open with the holes
 * the comments left.
 */
function withoutComments(dot: string): string {
  return dot
    .split("\n")
    .filter((line) => !/^\s*(\/\/|#)/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function SectionBlueprint() {
  const { dot } = bundleSource(STARTER);

  return (
    <section id="blueprint" className="scroll-mt-24 bg-void py-20 sm:py-28">
      <div className="container-page">
        {/* The heading is rendered inside the walk's pinned box rather than beside it: two
            sticky boxes in one scroll container each take their own offset, so the distance
            between them changed as each one pinned. One box cannot come apart from itself.
            No eyebrow, because `.eyebrow` is rationed to one per page and the hero spends it. */}
        <BlueprintWalk
          dot={withoutComments(dot)}
          file={FILE}
          heading={
            <SectionHeading
              /* The register's own blue rather than cyan: `app/globals.css` spends cyan on
                 "you can act on this", and a 32px headline in the interactive colour reads as
                 a link that does nothing. A `<span>` inside `title` because the heading
                 declares `text-fg` and `cx` is not `tailwind-merge`; a child's own colour
                 always wins. */
              title={<span className="text-blueprint-line">This is a blueprint</span>}
              lead="Which agents run and what each hands to the next. Download the folder and run it with your own harness."
              align="center"
              className="mx-auto"
            />
          }
        />

        <BeatCaption href={blueprintHref(ARCHIVE_OWNER, STARTER)} cta="Inspect a blueprint">
          A blueprint pins the handoffs, loops, checkpoints, and deliberate absences that
          make a workflow reusable. The files stay plain enough to inspect before your
          harness runs them.
        </BeatCaption>
      </div>
    </section>
  );
}
