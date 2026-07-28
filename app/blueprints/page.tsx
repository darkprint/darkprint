import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { allBlueprints, getRegistry } from "@/lib/content";

export const metadata: Metadata = {
  title: "Blueprints",
  description:
    "Browse the DarkPrint registry of AI factory blueprints. Filter by tag, category and autonomy class, and read each pipeline as a graph.",
};

/**
 * The index of the Blueprints surface — doc 1 §0 names the section **Blueprints**
 * and gives "Gallery" only as its former name.
 *
 * The lead names what the controls do, and it has to keep naming it correctly. Doc 2
 * §1.1: "Nella galleria l'autonomia è un **filtro**, non un ordinamento di merito."
 * Autonomy and phase coverage are ways *in* — they narrow the grid the way a category
 * does — and neither is a key the grid can be ordered by. The sentence used to offer
 * "sort by autonomy", which advertised the league table the principle rules out and
 * had also outlived the control: `SortKey` in `GalleryBrowser` is recency, downloads
 * and votes, and autonomy was deliberately dropped from it.
 *
 * The two remaining orderings are named with what stands behind them, because nothing
 * does. Doc 2 §0.4 and the honesty rule: there is no ballot and no download counter, and
 * a lead offering to order the shelf "by what is downloaded or upvoted" described two
 * counters the site does not have, one click from a page saying so outright.
 *
 * The lead also has to keep describing the shelf correctly. It used to open "Every dark
 * factory in the registry", which made a classification into a condition of entry and was
 * false about three of the nine besides. Doc 2 §1.1 names that exact reading as the
 * barrier the principle exists to remove — somebody looks at their own pipeline, sees a
 * manual step, and concludes they are not far enough along to publish. So the count of
 * graphs with nobody in them is stated as a count, the rest are described by what they do
 * say, and neither sentence is phrased as a rank.
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
  // Counted off the archive rather than asserted, so the sentence cannot outlive the shelf
  // it describes. It is a count of a shape, and the clause beside it says what the others
  // carry instead: doc 2 §1.1 rules out phrasing either group as short of the other.
  const darkFactories = blueprints.filter((b) => b.autonomy.isDarkFactory).length;

  return (
    <div className="container-page py-12 sm:py-16">
      <SectionHeading
        eyebrow="Registry"
        title="Blueprints"
        lead={`${blueprints.length} complete pipelines you can read as a graph. ${darkFactories} of them carry no human node and are classed dark factories; the rest name the node where a person acts. Narrow the grid by tag, category, the phases a factory covers or its autonomy class. It also orders by downloads and by votes, and both of those are seeded rows in the index rather than anything this site counted.`}
        className="mb-10"
      />
      <GalleryBrowser
        blueprints={blueprints}
        tags={tags}
        categories={categories}
      />
    </div>
  );
}
