import { OntologyCatalog } from "darkprint";
import { CORE_ONTOLOGY, ontologyView, resolveBundle } from "@/lib/core";
import { bundleSource } from "@/lib/content";
import { termUsageOver, type UsageSource } from "@/components/ontology/TermTable";

/**
 * The real shipped vocabulary (`CORE_ONTOLOGY`, doc 3) and real usage counts off the one
 * archive bundle the content shim carries, through the same `termUsageOver` the registry
 * reader calls — not an invented term list or a hand-typed usage map.
 */
const view = ontologyView(CORE_ONTOLOGY);

const raw = bundleSource("starter-software-factory");
const resolved = resolveBundle(
  {
    manifest: {
      slug: "starter-software-factory",
      title: "Starter Software Factory",
      summary: "The canonical five-node factory, plan, build, test, debug, release.",
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
  view,
);
const bp = resolved.blueprint;
if (bp === undefined) throw new Error("starter-software-factory fixture failed to resolve");

const usageSources: UsageSource[] = bp.nodes.map((node) => ({
  id: node.ref,
  card: node.card,
  usedIn: ["starter-software-factory"],
}));
const usage = termUsageOver(usageSources);

/**
 * Renders full-page height (the five kind sections plus governance), so this is a
 * `cardMode: column` component in the grid — recorded in the batch-6 learnings.
 */
export const FullVocabulary = () => <OntologyCatalog view={view} usage={usage} />;
