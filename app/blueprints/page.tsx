import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { allBlueprints, getRegistry } from "@/lib/content";

export const metadata: Metadata = {
  title: "Blueprints",
  description:
    "Browse the DarkPrint registry of autonomous AI factory blueprints — filter by tag, category and autonomy level, and read each pipeline as a graph.",
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
    <div className="container-page py-12 sm:py-16">
      <SectionHeading
        eyebrow="Registry"
        title="Blueprints"
        lead={`Every dark factory in the registry — ${blueprints.length} complete pipelines you can read as a graph. Narrow the grid by tag, category, the phases a factory covers or the autonomy band it sits in; order it by what is recent, downloaded or upvoted.`}
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
