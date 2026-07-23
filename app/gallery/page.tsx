import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { BLUEPRINTS, BLUEPRINT_TAGS, BLUEPRINT_CATEGORIES } from "@/lib/data";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Browse the DarkPrint registry of autonomous AI factory blueprints — filter by tag, category and autonomy level, and read each pipeline as a graph.",
};

export default async function GalleryPage({
  searchParams,
}: PageProps<"/gallery">) {
  const sp = await searchParams;
  const raw = typeof sp.tag === "string" ? sp.tag : null;
  const initialTag = raw && BLUEPRINT_TAGS.includes(raw) ? raw : null;

  return (
    <div className="container-page py-12 sm:py-16">
      <SectionHeading
        eyebrow="Registry"
        title="Blueprint gallery"
        lead={`Every dark factory in the registry — ${BLUEPRINTS.length} complete pipelines you can read as a graph. Filter by tag or category, and sort by autonomy, downloads or votes.`}
        className="mb-10"
      />
      <GalleryBrowser
        blueprints={BLUEPRINTS}
        tags={BLUEPRINT_TAGS}
        categories={BLUEPRINT_CATEGORIES}
        initialTag={initialTag}
      />
    </div>
  );
}
