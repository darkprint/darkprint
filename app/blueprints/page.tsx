import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
// Imported by path rather than through `components/home`'s barrel. That barrel is the
// landing's running order and this page is not on the landing; reaching through it would
// make the index depend on a list whose whole job is to describe a different route.
import { SectionLifecycle } from "@/components/home/SectionLifecycle";
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
 * Redesign spec §3 moves the landing's download / fork / update rung onto this page: it
 * answers what a reader can do with one of these things at the moment they are looking at
 * nine of them, and it was the last technical block standing between the landing's
 * wordmark and its doors. §3 said "above the grid" and it is below it; the note on the
 * component's own placement below carries the measurement that decided that. `SectionLifecycle` is rendered unchanged, and its
 * honesty is the reason it is rendered unchanged rather than summarised here: the three
 * panels each end on the same two rows, and the middle one says "Built: Nothing" because
 * forking is a property of the format and nothing this site runs. A shorter retelling of
 * that section is how that row goes missing.
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
            mattered less when the page was one heading; with the lifecycle section and
            the grid's own heading under it, a page whose outline starts at level two
            gives a screen reader three sibling `h2`s and no title. */}
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

      {/* Below the shelf, and that is a deliberate departure from redesign spec §3, which
          put it "above the grid".

          Measured on a phone, above the grid it pushed the first blueprint tile from 1.9
          screens down to 7.0 and took the page from 5908px to 9789px. This index exists to
          be browsed, and five screens of preamble in front of nine tiles is the boredom the
          author named as the whole problem with the old pages. The material stays on the
          page, in full, where a reader who has just looked at the shelf arrives at it
          asking the question it answers: what can I do with one of these. */}
      <SectionLifecycle />
    </>
  );
}
