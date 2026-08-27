import { EvidenceLayers } from "darkprint";
import { CORE_ONTOLOGY, analyzeBlueprint, ontologyView, resolveBundle } from "@/lib/core";
import { graphForBlueprint } from "@/lib/graph-seed";
import { bundleSource } from "@/lib/content";
import type { Blueprint, Metric } from "@/lib/types";

/**
 * The same real starter-software-factory bundle `BlueprintCanvas`'s preview resolves,
 * built into a full `Blueprint` so `EvidenceLayers` can read `blueprint.analysis` and
 * `blueprint.autonomy` off it exactly as the blueprint detail page does.
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

const metrics: Metric[] = [
  {
    key: "autonomy",
    label: "Autonomy",
    value: Math.round(analysis.autonomy.fraction * 100),
    source: "auto",
    detail: analysis.autonomy.rationale,
  },
  {
    key: "security",
    label: "Security",
    value: Math.round((analysis.security.level / 4) * 100),
    source: "auto",
    detail: analysis.security.rationale,
  },
  { key: "efficacy", label: "Efficacy", value: undefined, source: "community", detail: "No eligible ballot yet." },
  {
    key: "reliability",
    label: "Reliability",
    value: undefined,
    source: "community",
    detail: "No eligible ballot yet.",
  },
  {
    key: "transparency",
    label: "Transparency",
    value: undefined,
    source: "community",
    detail: "No eligible ballot yet.",
  },
  { key: "cost", label: "Cost", value: undefined, source: "reported", detail: "No accepted run report yet." },
];

const blueprint: Blueprint = {
  kind: "blueprint",
  slug: "starter-software-factory",
  ownerHandle: "orin",
  title: "Starter Software Factory",
  summary:
    "The canonical five-node factory, plan, build, test, debug, release, and the one edge it deliberately does not have: nothing carries the acceptance criteria to the builder.",
  description:
    "This is the blueprint the guided path is built on, and the smallest complete dark factory in the gallery: one node per phase, no human gates, no external access, five files you can read in a sitting.",
  tags: ["starter", "tutorial", "isolation", "software"],
  category: "Software",
  author: { username: "orin", displayName: "orin", avatarHue: 210, validator: true },
  autonomy: {
    autonomyClass: analysis.autonomy.autonomyClass,
    label: analysis.autonomy.label,
    isDarkFactory: analysis.autonomy.isDarkFactory,
    level: analysis.autonomy.level,
    blurb: "Every node in this graph runs unattended; nobody waits on a person to advance it.",
  },
  metrics,
  graph,
  requiredAgents: ["Planner", "Builder", "Debugger"],
  requiredTools: ["filesystem"],
  createdAt: "2026-07-28",
  updatedAt: "2026-07-28",
  downloads: 214,
  votes: 38,
  comments: [],
  featured: true,
  seed: true,
  analysis,
  digest: bp.digest,
  cardRefs: bp.nodes.map((node) => node.ref),
};

/** The archive-fresh state: no ballot and no run report, which is most blueprints. */
export const NoCommunitySignal = () => <EvidenceLayers blueprint={blueprint} />;

/** T280's live sufficiency panels, once accounts have voted and run reports have landed. */
export const WithLiveSignal = () => (
  <EvidenceLayers blueprint={blueprint} live={{ sampleSize: 14, minSample: 20, runs: 6 }} />
);
