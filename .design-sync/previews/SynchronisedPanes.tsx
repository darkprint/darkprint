import { loadBundle } from "@/lib/core";
import { graphForBlueprint } from "@/lib/graph-seed";
import { buildPaneModel, type PaneNodeInput } from "@/components/panes/build";
import { SynchronisedPanes } from "darkprint";

/* `model` and `graph` both come out of a real resolved bundle in the live app
   (`app/blueprints/[owner]/[slug]/page.tsx`), so this runs the actual
   starter-software-factory content — the same DOT and cards
   `content/blueprints/starter-software-factory` ships — through `loadBundle`,
   then through the same `graphForBlueprint`/`buildPaneModel` calls the page makes,
   rather than hand-typing a `PaneModel` whose shape might drift from what those
   functions actually produce. */

const DOT = `digraph starter_software_factory {
  rankdir=LR;
  node [shape=box, style=rounded];

  planner  [card="spec-planner@1.0.0"];
  builder  [card="code-builder@1.0.0"];
  tester   [card="acceptance-tester@1.0.0"];
  debugger [card="targeted-debugger@1.0.0"];
  deployer [card="release-gate@1.0.0"];

  planner  -> tester   [label="acceptance criteria"];
  builder  -> tester   [label="build"];
  tester   -> debugger [label="failure evidence", style=dashed];
  debugger -> tester   [label="patch"];
  tester   -> deployer [label="approved build"];
}
`;

const MANIFEST = {
  slug: "starter-software-factory",
  title: "Starter Software Factory",
  summary: "The canonical five-node factory: plan, build, test, debug, release.",
  tags: ["starter", "tutorial", "isolation", "software"],
  author: "orin",
  ontologyVersion: "0.1.0",
  createdAt: "2026-07-28",
  updatedAt: "2026-07-28",
};

const SPEC_PLANNER = `id: spec-planner
name: Spec Planner
type: agent
phase: planning
action: >-
  Turn the incoming request into two separate artefacts, an ordered build brief, and the
  acceptance criteria the finished work will be judged against.
spec: >-
  Read the feature request you are handed and turn it into two separate artefacts, written
  independently of one another. Write no code yourself, and never weaken a criterion.
model: claude-opus-5
agent: Planner
tools: []
mcp: []
inputs:
  - name: request
    type: text
    description: The feature request the run was started with.
outputs:
  - name: plan
    type: plan
    description: The ordered build steps.
  - name: criteria
    type: acceptance-criteria
    description: The conditions the finished work must satisfy.
dependencies: []
cannot:
  - write any of the code it plans
requires_human: false
risk_markers: []
version: 1.0.0
author: orin
ontology_version: 0.1.0
`;

const CODE_BUILDER = `id: code-builder
name: Code Builder
type: agent
phase: implementation
action: >-
  Work through the build brief and emit the source it describes, adding nothing the brief does
  not ask for.
spec: >-
  A build brief arrives with the run. Emit the finished source on \`build\` as one complete,
  compiling change, with no commentary.
model: claude-sonnet-5
agent: Builder
tools: []
mcp:
  - filesystem
inputs:
  - name: brief
    type: plan
    description: The ordered build steps.
outputs:
  - name: build
    type: code
    description: One complete, compiling change.
dependencies: []
cannot:
  - acceptance-criteria
requires_human: false
risk_markers: []
version: 1.0.0
author: orin
ontology_version: 0.1.0
`;

const ACCEPTANCE_TESTER = `id: acceptance-tester
name: Acceptance Tester
type: validation
phase: testing
action: >-
  Run every criterion against the submitted build and split the outcome.
spec: >-
  You are handed a set of criteria and a build. Run each criterion against that build in turn.
model: claude-sonnet-5
agent: Acceptance tester
tools: []
mcp: []
inputs:
  - name: criteria
    type: acceptance-criteria
    description: The conditions the build is judged against.
  - name: build
    type: code
    description: The submitted change.
outputs:
  - name: evidence
    type: report
    description: Raw failure output only.
  - name: approved
    type: artifact
    description: The build unchanged, once every criterion has held.
dependencies:
  - spec-planner
  - code-builder
  - targeted-debugger
cannot:
  - quote a criterion in the evidence it emits
requires_human: false
risk_markers: []
version: 1.0.0
author: orin
ontology_version: 0.1.0
`;

const TARGETED_DEBUGGER = `id: targeted-debugger
name: Targeted Debugger
type: agent
phase: debugging
action: >-
  Turn one run's failure evidence into the narrowest patch that addresses it.
spec: >-
  You are given the evidence from a run that failed. Find the smallest change to the existing
  source that accounts for those failures. Stop after three attempts.
model: claude-opus-5
agent: Debugger
tools: []
mcp:
  - filesystem
params:
  max_iterations: 3
inputs:
  - name: evidence
    type: report
    description: One run's failure output.
outputs:
  - name: patch
    type: code
    description: The narrowest change that accounts for the evidence.
dependencies:
  - acceptance-tester
cannot:
  - acceptance-criteria
requires_human: false
risk_markers: []
version: 1.0.0
author: orin
ontology_version: 0.1.0
`;

const RELEASE_GATE = `id: release-gate
name: Release Gate
type: tool
phase: deployment
action: >-
  Admit only a signed-off build, write it to the run's release target, and close the run.
spec: >-
  A build reaches you only once it has been signed off. Write the artefact byte-for-byte to
  the release target, under a tag made from the run id, and record its digest.
tools: []
mcp:
  - filesystem
params:
  target: run-releases
  tag_from: run_id
  record_digest: true
inputs:
  - name: release
    type: artifact
    description: The signed-off build.
outputs: []
dependencies:
  - acceptance-tester
cannot:
  - alter the artefact on the way through
requires_human: false
risk_markers: []
version: 1.0.0
author: orin
ontology_version: 0.1.0
`;

const result = loadBundle({
  manifest: MANIFEST,
  dot: DOT,
  cardFiles: {
    "cards/spec-planner@1.0.0.yaml": SPEC_PLANNER,
    "cards/code-builder@1.0.0.yaml": CODE_BUILDER,
    "cards/acceptance-tester@1.0.0.yaml": ACCEPTANCE_TESTER,
    "cards/targeted-debugger@1.0.0.yaml": TARGETED_DEBUGGER,
    "cards/release-gate@1.0.0.yaml": RELEASE_GATE,
  },
});

const blueprint = result.blueprint!;
const graph = graphForBlueprint(blueprint);
const paneNodes: PaneNodeInput[] = blueprint.nodes.map((node) => ({
  nodeId: node.nodeId,
  label: node.card.name,
  ref: node.ref,
  card: node.card,
}));
const model = buildPaneModel({
  slug: blueprint.manifest.slug,
  title: blueprint.manifest.title,
  dot: blueprint.dot,
  dotFile: "topology.dot",
  nodes: paneNodes,
});

/** The drawing and the card skeleton, joined — the same pair the detail page mounts. */
export const Canonical = () => <SynchronisedPanes model={model} graph={graph} />;

/** With `aside` filled: the graph keeps two-thirds and a sticky column opens beside it. */
export const WithAside = () => (
  <SynchronisedPanes
    model={model}
    graph={graph}
    aside={
      <div className="panel flex flex-col gap-2 p-4">
        <span className="label">Score</span>
        <p className="text-sm text-muted">
          Autonomy 4/4, closed-loop. Security 4/4, no leaked criteria.
        </p>
      </div>
    }
  />
);
