import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { allBlueprints, getRegistry } from "@/lib/content";

export const metadata: Metadata = {
  title: "Blueprints",
  description:
    "Browse the DarkPrint registry of AI factory blueprints. Filter by tag, category and autonomy class, read each pipeline as a graph, and take the folder away.",
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
  const tags = registry.tags();
  const categories = registry.categories();

  return (
    <>
      <div className="container-page pt-12 sm:pt-16">
        {/* `h1`, which every other index on the site passes and this one did not. It
            mattered less while this page was one heading; the sr-only "The shelf" `h2`
            under it means a page whose outline starts at level two gives a screen reader
            a sibling `h2` and no title. */}
        <SectionHeading
          as="h1"
          eyebrow="Registry"
          title="Blueprints"
          lead="A blueprint is an agent pipeline written down as a graph: every node pinned to a card that says what it runs, what it takes in, what it hands on and what it must never receive. It is a folder of text you can read here and take away."
        />
      </div>

      <div className="container-page py-16 sm:py-20">
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
        <GalleryBrowser blueprints={blueprints} tags={tags} categories={categories} />
      </div>
    </>
  );
}
