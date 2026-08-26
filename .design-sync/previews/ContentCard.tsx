import { ContentCard } from "darkprint";

/**
 * `ContentCard`'s `item` is a full resolved `Blueprint` (title, graph, autonomy reading,
 * the works). No live call site builds this by hand any more — `GalleryBrowser` moved to
 * `ContentRow` and left this tile mounted nowhere in the app, but it is still exported and
 * still the gallery-tile shape `/u/<owner>` and the upload preview describe, so the fixture
 * below is assembled from the archive's own reference bundle
 * (`content/blueprints/starter-software-factory`) rather than invented from nothing: the
 * five node ids, kinds and card refs are the real topology, and the edges carry the real
 * labels off `topology.dot`.
 */
const starterGraph = {
  nodes: [
    { id: "planner", kind: "planner", label: "Spec Planner", cardId: "spec-planner", position: { x: 0, y: 0 } },
    { id: "builder", kind: "executor", label: "Code Builder", cardId: "code-builder", position: { x: 0, y: 180 } },
    { id: "tester", kind: "verifier", label: "Acceptance Tester", cardId: "acceptance-tester", position: { x: 200, y: 90 } },
    { id: "debugger", kind: "retry", label: "Targeted Debugger", cardId: "targeted-debugger", position: { x: 400, y: 180 } },
    { id: "deployer", kind: "ship", label: "Release Gate", cardId: "release-gate", position: { x: 400, y: 0 } },
  ],
  edges: [
    { id: "e1", source: "planner", target: "tester", label: "acceptance criteria", variant: "flow" },
    { id: "e2", source: "builder", target: "tester", label: "build", variant: "flow" },
    { id: "e3", source: "tester", target: "debugger", label: "failure evidence", variant: "fallback" },
    { id: "e4", source: "debugger", target: "tester", label: "patch", variant: "flow" },
    { id: "e5", source: "tester", target: "deployer", label: "approved build", variant: "flow" },
  ],
};

/** One row per node: no card resolves without a contribution, which is what `AutonomyMeter` partitions on. */
const contributions = starterGraph.nodes.map((n) => ({
  nodeId: n.id,
  ref: `${n.cardId}@1.0.0`,
  name: n.label,
  requiresHuman: false,
  resolved: true,
}));

const orin = { username: "orin", displayName: "Orin", avatarHue: 192, validator: true };

function blueprint(overrides: Record<string, unknown> = {}) {
  return {
    kind: "blueprint",
    ownerHandle: "orin",
    slug: "starter-software-factory",
    title: "Starter Software Factory",
    summary:
      "The canonical five-node factory: plan, build, test, debug, release, and the one edge it deliberately does not have.",
    tags: ["starter", "tutorial", "isolation", "software"],
    author: orin,
    autonomy: {
      autonomyClass: "closed-loop",
      label: "Closed-loop",
      isDarkFactory: true,
      level: 4,
      blurb: "No node in this graph waits for a person, and it covers all five lifecycle phases.",
    },
    graph: starterGraph,
    requiredTools: [],
    updatedAt: "2026-07-28",
    analysis: { autonomy: { contributions } },
    ...overrides,
  };
}

/** The gallery tile as it drew on `/u/orin` before the shelf moved to `ContentRow`: name, drawing, kind, autonomy, tags, forks. */
export const Canonical = () => <ContentCard item={blueprint() as never} forks={2} />;

/** The lineage line and the "forked" pill, the two things `forks`/`lineage` add over the plain tile. */
export const ForkedTile = () => (
  <ContentCard
    item={
      blueprint({
        slug: "starter-software-factory-hardened",
        title: "Starter Software Factory, hardened",
        summary:
          "The starter graph with a human gate in front of the deploy step, for a team that wants a person on the release button.",
        tags: ["starter", "hardened", "human-gate"],
      }) as never
    }
    forks={0}
    lineage={{ owner: "orin", slug: "starter-software-factory" }}
  />
);
