import { BlueprintCanvas } from "darkprint";
import { CORE_ONTOLOGY, analyzeBlueprint, ontologyView, resolveBundle } from "@/lib/core";
import { graphForBlueprint } from "@/lib/graph-seed";
import { bundleSource } from "@/lib/content";

/**
 * The real starter-software-factory bundle, resolved and scored through the actual
 * engine rather than a hand-typed analysis object — every reading Explainability shows
 * (the autonomy class, the security penalties, the phase coverage) is what `lib/core`
 * computes for this bundle.
 */
const raw = bundleSource("starter-software-factory");
const resolved = resolveBundle(
  {
    manifest: {
      slug: "starter-software-factory",
      title: "Starter Software Factory",
      summary:
        "The canonical five-node factory, plan, build, test, debug, release, and the one edge it deliberately does not have: nothing carries the acceptance criteria to the builder.",
      category: "Software",
      tags: ["starter", "tutorial", "isolation", "software"],
      author: "orin",
      ontologyVersion: "0.1.0",
      createdAt: "2026-07-28",
      updatedAt: "2026-07-28",
    },
    dot: raw.dot,
    cardFiles: Object.fromEntries(raw.cards.map((c) => [c.file, c.text])),
  },
  ontologyView(CORE_ONTOLOGY),
);
const bp = resolved.blueprint;
if (bp === undefined) throw new Error("starter-software-factory fixture failed to resolve");

const analysis = analyzeBlueprint(bp);
const graph = graphForBlueprint(bp);

/** The blueprint detail page's own mount: the graph and the score, both real. */
export const StarterFactory = () => <BlueprintCanvas graph={graph} analysis={analysis} />;
