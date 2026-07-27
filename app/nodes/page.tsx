import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { NodeBrowser } from "@/components/nodes/NodeBrowser";
import type { NodeSummary } from "@/components/nodes/NodeCardSummary";
import { allNodeCards, getOntologyView, getRegistry } from "@/lib/content";

export const metadata: Metadata = {
  title: "Nodes",
  description:
    "The DarkPrint node-card library — every reusable node in the registry, with its ontology type, its lifecycle phase, declared interface, tools and risk markers. Filter by type, by phase, by human involvement or by risk.",
};

export default function NodesPage() {
  const ontology = getOntologyView();
  const registry = getRegistry();

  const nodes: NodeSummary[] = allNodeCards().map((record) => ({
    id: record.id,
    version: record.version,
    ref: record.ref,
    name: record.card.name,
    action: record.card.action,
    type: record.card.type,
    typeLabel:
      ontology.resolve(record.card.type, "node-type")?.term.label ?? record.card.type,
    phase: record.card.phase,
    phaseLabel:
      ontology.resolve(record.card.phase, "phase")?.term.label ?? record.card.phase,
    tools: [...record.card.tools],
    requiresHuman: record.card.requiresHuman,
    riskMarkers: record.card.riskMarkers.map(
      (marker) => ontology.resolve(marker, "risk-marker")?.term.label ?? marker,
    ),
    usedIn: registry.usersOf(record.id).length,
  }));

  const blueprints = registry.blueprints().length;

  return (
    <div className="container-page py-12 sm:py-16">
      <SectionHeading
        as="h1"
        eyebrow="Registry"
        title="Node cards"
        lead={`The reusable unit is not a sub-graph, it is a node. One card says what a node does, what it takes in, what it hands on and what it puts at risk — and the ${blueprints} blueprints in the registry are assembled out of these ${nodes.length}. Every card is versioned, content-addressed, and pinned by exact reference.`}
        className="mb-10"
      />
      <NodeBrowser nodes={nodes} />
    </div>
  );
}
