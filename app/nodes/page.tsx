import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { NodeBrowser } from "@/components/nodes/NodeBrowser";
import type { NodeSummary } from "@/components/nodes/NodeCardSummary";
import { allNodeCards, getOntologyView, getRegistry } from "@/lib/content";
import { getAuthor } from "@/lib/data/users";

export const metadata: Metadata = {
  title: "Nodes",
  description:
    "The DarkPrint node-card library, every reusable node in the registry, with its ontology type, the lifecycle phases it stands in, declared interface, tools and risk markers. Filter by type, by phase, by human involvement or by risk.",
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
    /* Zero, one or several — the card decides. Resolved here on the server, in the
       order the card wrote them, so the browser filters plain data and never has to
       ask the ontology anything. An id the vocabulary does not know is shown as
       written rather than guessed at. */
    phases: record.card.phases.map((id) => ({
      id,
      label: ontology.resolve(id, "phase")?.term.label ?? id,
    })),
    tools: [...record.card.tools],
    requiresHuman: record.card.requiresHuman,
    riskMarkers: record.card.riskMarkers.map(
      (marker) => ontology.resolve(marker, "risk-marker")?.term.label ?? marker,
    ),
    usedIn: registry.usersOf(record.id).length,
    /* Resolved here rather than in the tile, and left `undefined` when the table does
       not hold the name. The tile turns this into a link to `/u/<username>`, and that
       route is `dynamicParams = false`, so an unresolved author has to fall out before
       it reaches the markup. Same lookup the card's own page does. */
    author: record.card.author === undefined ? undefined : getAuthor(record.card.author),
  }));

  const blueprints = registry.blueprints().length;

  return (
    <div className="container-page py-12 sm:py-16">
      <SectionHeading
        as="h1"
        eyebrow="Registry"
        title="Node cards"
        lead={`One card says what a node does, what it takes in, what it hands on and what it puts at risk, and the ${blueprints} blueprints in the registry are assembled out of these ${nodes.length}. Every card is versioned, content-addressed, and pinned by exact reference.`}
        className="mb-10"
      />
      <NodeBrowser nodes={nodes} />
    </div>
  );
}
