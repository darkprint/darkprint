import { bundleSource } from "@/lib/content";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { BeatCaption } from "./BeatCaption";
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

/** What the file is called in the folder that downloads, and in the panel's own rail. */
const FILE = `${STARTER}/blueprint.dot`;

/**
 * The DOT with its comment lines taken out.
 *
 * The author: "remove all the comments in the .dot as I want to just give the user the
 * intuition of what's behind the graphics."
 *
 * The archive's file carries six comment lines arguing doc 2 §5.2, §5.4 and §5.5 — why the
 * planner does not reach the builder, what `criteria-leak` would cost, why the loop never
 * returns to the builder. That is the right place for them and they stay there: `/spec/topology`
 * shows the same file WITH them, because that page is where a reader is studying the notation.
 * This beat is not. It is showing what is behind a picture, and twelve lines of prose in a
 * twenty-seven line file is the argument arriving before the shape.
 *
 * Only whole comment lines go. A trailing comment after a statement would take the statement
 * with it, and nothing in this archive writes one — but the regex is anchored so that if one
 * ever appears it is left alone rather than silently truncating a node.
 *
 * Blank runs collapse to one so the file does not open with the holes the comments left.
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
        {/* The eyebrow was "The drawing" and the author asked it out (2026-08-08). It was
            naming the medium of the thing directly under it, which the thing under it does
            better by being a drawing — and it was the first of two lines that both had to
            be read before the picture, on the beat that opens the argument.

            `.eyebrow` is rationed to one per page or per full-bleed band; this frees one
            rather than spending it, and the coloured title below now does the work of
            saying which register a reader is in. */}
        {/* The heading is passed INTO the walk and rendered inside its pinned box rather
            than drawn here.

            It was a sticky SIBLING of the figure, which is the bug the author caught: two
            sticky boxes in one scroll container each take their own offset, so the distance
            between them depended on which of the two had pinned yet — 40px in flow, and
            something else once both were stuck. One box cannot come apart from itself. */}

        <BlueprintWalk
          dot={withoutComments(dot)}
          file={FILE}
          heading={
            <SectionHeading
              /* Cyanotype blue, the pole this whole beat is drawn in — the graticule ground,
                 the frame, the node labels and the edges are all `--color-blueprint-*`, and the
                 title now names its own register instead of standing outside it in `text-fg`.

                 `blueprint-line` and not `cyan`: `app/globals.css` spends cyan on "you can act
                 on this", and a 32px headline in the interactive colour reads as a link that
                 does nothing. It pairs with the copper title one beat down, which is the same
                 wheel from the other side — see `SectionNodeIsCard`.

                 A `<span>` inside `title` rather than a class on the heading, because the
                 heading declares `text-fg` and `cx` is not `tailwind-merge`: both classes would
                 be emitted and CSS source order would decide the colour. A child's own colour
                 always wins. */
              title={<span className="text-blueprint-line">This is a blueprint</span>}
              /* The lead said "Keep scrolling and the drawing becomes the file it is drawn
                 from." until 2026-08-08, when the author asked it out of the deck and into the
                 scroll: the hint appears as a reader starts moving rather than sitting under
                 the heading before there is anything to hint at. `SourceSwap` draws it. */
              lead="Which agents run, what each one hands to the next, and it is already yours to run."
              align="center"
              className="mx-auto"
            />
          }
        />

        <BeatCaption href={`/blueprints/${STARTER}`} cta="Inspect a blueprint">
          A blueprint pins the handoffs, loops, checkpoints, and deliberate absences that
          make a workflow reusable. The files stay plain enough to inspect before your
          harness runs them.
        </BeatCaption>
      </div>
    </section>
  );
}
