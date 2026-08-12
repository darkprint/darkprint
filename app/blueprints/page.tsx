import type { Metadata } from "next";
import Link from "next/link";

import { GridBand } from "@/components/ui/GridBand";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { allBlueprints, getRegistry } from "@/lib/content";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-01) (cited at line 58): GET /api/blueprints

export const metadata: Metadata = {
  title: "Blueprints",
  description:
    "Browse the DarkPrint registry of AI blueprints. Filter by tag, category and autonomy class, read each pipeline as a graph, and take the folder away.",
};

/**
 * The index of the Blueprints surface — doc 1 §0 names the section **Blueprints**
 * and gives "Gallery" only as its former name.
 *
 * Redesign spec §3 moved the landing's download / fork / update rung onto this page,
 * below the grid. The lifecycle-scoring pass's own §2 moved it again, rewritten as
 * download / compose / upload, back onto the landing itself as a fifth beat — the author
 * asked for those three panels off this page entirely, and this index is back to being
 * what it was before spec §3 touched it: the shelf, and nothing under it.
 *
 * The lead says what a blueprint *is*, at the author's request (2026-07-29), and that is
 * the one job it has now. It used to count the shelf and split it by whether a graph had
 * a person in it, which put a classification in front of a reader before the thing being
 * classified had been described.
 *
 * Two earlier drafts of this lead are worth not rediscovering. It once opened "Every dark
 * factory in the registry", which made a classification into a condition of entry and was
 * false about three of the nine besides; doc 2 §1.1 names that exact reading as the
 * barrier the principle exists to remove, where somebody looks at their own pipeline,
 * sees a manual step, and concludes they are not far enough along to publish. It later
 * offered to order the shelf "by what is downloaded or upvoted", which advertised two
 * counters this site does not have. Neither idea belongs in a sentence that only has to
 * define the noun.
 *
 * Doc 2 §1.1 still governs the controls under it: "Nella galleria l'autonomia è un
 * **filtro**, non un ordinamento di merito." Autonomy and phase coverage narrow the grid
 * the way a category does, and neither is a key it can be ordered by — `SortKey` in
 * `GalleryBrowser` is recency, downloads and votes, and autonomy was deliberately
 * dropped from it.
 *
 * It lives at `app/blueprints/page.tsx`, the sibling of
 * `app/blueprints/[slug]/page.tsx`: a route segment folder holds both its own
 * `page` and any nested segments, so the index and the detail pages are one route
 * tree rather than two parallel ones. The old `/gallery` path is a permanent (308)
 * redirect in `next.config.ts`, and Next carries the query string across a redirect,
 * so `/gallery?tag=…` links that were already shared still land on a filtered index.
 *
 * Fully prerendered. The `?tag=` deep link from a blueprint page is read on the
 * client instead of via the `searchParams` prop: touching `searchParams` here would
 * opt the whole route into on-demand rendering, and the registry index is the one
 * page whose card grid most wants to exist in the static HTML.
 */
export default function BlueprintsPage() {
  const blueprints = allBlueprints();
  const registry = getRegistry();
  const categories = registry.categories();

  return (
    /* One container, not two.
       ------------------------------------------------------------
       The heading block and the shelf used to sit in separate `container-page` wrappers,
       the second carrying its own `py-16 sm:py-20` — so the gap between the lead and the
       first control was the second wrapper's top padding, 80px, and this page opened with
       a different amount of air from the two registry indexes built out of the same
       `SectionHeading`. Measured at 1440 with the lead bottom at y=252 on all three:
       `/blueprints` 80px, `/nodes` 40px, `/ontology` 40px.

       40px is the canonical `block` tier, which the vertical scale names for exactly this
       step (SectionHeading → content), and it is what both siblings already spend. So
       `mb-10` here rather than the `mb-16` the brief reached for: 64px is the `section`
       tier — section↔section — and taking it would have unified nothing, it would have
       made this page the odd one out in the other direction.

       Still one container. What is new outside it is a full-bleed host for the hero's graph
       paper, on the author's instruction that both registry galleries carry it — a decorative
       layer and nothing else, with no padding of its own, so the measurement above is
       untouched. `inset-x-0` inside `container-page` would have stopped at the 1200px gutters
       and shown two vertical edges the mask never fades. See `GridBand`. */
    <div className="relative">
      <GridBand />
      <div className="container-page relative py-12 sm:py-16">
      {/* `h1`, which every other index on the site passes and this one did not. It
          mattered less while this page was one heading; the sr-only "The shelf" `h2`
          under it means a page whose outline starts at level two gives a screen reader
          a sibling `h2` and no title. */}
      {/* The lead was 49 words defining the noun, on the surface a reader reaches
          after deciding they want one. `/what-a-blueprint-is` is a nav item one click
          away whose entire job is that definition, and the landing spends five beats on
          it before anybody arrives here. What this page owes a visitor is what is on
          the shelf and what to do with it. */}
      <SectionHeading
        as="h1"
        className="mb-10"
        eyebrow="Registry"
        title="Blueprints"
        lead={
          <>
            Every one is a folder of text: read the graph here, take it away, run it
            with your own tools.{" "}
            <Link
              href="/what-a-blueprint-is"
              className="text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-amber-bright"
            >
              What a blueprint is <span aria-hidden>&rarr;</span>
            </Link>
          </>
        }
      />

      {/* Visually gone at the author's request, and still in the outline. The browser
          below labels each of its controls and carries no heading of its own, so
          deleting this outright would leave the grid as the one region on the page a
          screen reader reaches with no name, under an `h1` that names the whole route.
          `sr-only` is the version of this heading that costs a sighted reader nothing.

          The sentence that stood here described the two orderings and said both are
          seeded. Doc 2 §0.4 wants that marker at the point of offer, and it is still
          made three times where the offer actually is: both options say `seeded` in
          the option text, the control bar repeats it beside the select, and every
          tile's two counts carry it in `ContentCard`. */}
      <h2 className="sr-only">The shelf</h2>
      <GalleryBrowser blueprints={blueprints} categories={categories} />
      </div>
    </div>
  );
}
