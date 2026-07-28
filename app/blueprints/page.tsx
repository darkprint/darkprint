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
 * counters the site does not have, one click from a page saying so outright. That
 * sentence is one of four places the seeded figures are marked on this route, with the
 * two sort options that say `seeded` in the option itself, the `◐ seeded` note in the
 * control bar, and the tooltip on every tile's two counts in `ContentCard`.
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
          lead={`${blueprints.length} complete pipelines you can read as a graph and take away as a folder. ${darkFactories} of them carry no human node and are classed dark factories; the rest name the node where a person acts.`}
        />
      </div>

      {/* The grid's own controls, introduced where they are rather than in the lead a
          section above them. The seeded sentence stays with the two orderings it is
          about: doc 2 §0.4 wants the marker at the point of offer, and the control bar
          repeats it beside the select. */}
      <div className="container-page py-16 sm:py-20">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">
          The shelf
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted">
          Narrow the grid by tag, category, the phases a factory covers or its autonomy
          class. It also orders by downloads and by votes, and both of those are seeded
          rows in the index rather than anything this site counted.
        </p>
        <div className="mt-8">
          <GalleryBrowser
            blueprints={blueprints}
            tags={tags}
            categories={categories}
          />
        </div>
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
