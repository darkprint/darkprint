import { VocabularyPane } from "darkprint";
import type { NodeCard, OntologyTerm, OntologyView } from "@/lib/core";

/* Only the fields this pane reads are load-bearing (phases, type, ports, cannot); the rest
   is filled with the starter cards' own real values (`content/cards/`) so a full NodeCard
   type-checks rather than a partial stand-in. */
function card(partial: {
  id: string;
  name: string;
  type: string;
  phase: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  cannot: string[];
}): NodeCard {
  return {
    id: partial.id,
    name: partial.name,
    type: partial.type,
    phases: [partial.phase],
    action: "",
    spec: "",
    tools: [],
    mcp: [],
    params: {},
    inputs: partial.inputs,
    outputs: partial.outputs,
    dependencies: [],
    cannot: partial.cannot,
    requiresHuman: false,
    riskMarkers: [],
    version: "1.0.0",
    author: "orin",
    ontologyVersion: "0.1.0",
  };
}

const nodes: readonly { nodeId: string; card: NodeCard }[] = [
  {
    nodeId: "planner",
    card: card({
      id: "spec-planner",
      name: "Spec Planner",
      type: "agent",
      phase: "planning",
      inputs: [{ name: "request", type: "text" }],
      outputs: [
        { name: "plan", type: "plan" },
        { name: "criteria", type: "acceptance-criteria" },
      ],
      cannot: ["write any of the code it plans", "weaken a criterion to make it easier to meet"],
    }),
  },
  {
    nodeId: "builder",
    card: card({
      id: "code-builder",
      name: "Code Builder",
      type: "agent",
      phase: "implementation",
      inputs: [{ name: "brief", type: "plan" }],
      outputs: [{ name: "build", type: "code" }],
      cannot: ["acceptance-criteria", "read the checks the work will be run against"],
    }),
  },
  {
    nodeId: "tester",
    card: card({
      id: "acceptance-tester",
      name: "Acceptance Tester",
      type: "validation",
      phase: "testing",
      inputs: [
        { name: "criteria", type: "acceptance-criteria" },
        { name: "build", type: "code" },
      ],
      outputs: [
        { name: "evidence", type: "report" },
        { name: "approved", type: "artifact" },
      ],
      cannot: ["quote a criterion in the evidence it emits"],
    }),
  },
  {
    nodeId: "debugger",
    card: card({
      id: "targeted-debugger",
      name: "Targeted Debugger",
      type: "agent",
      phase: "debugging",
      inputs: [{ name: "evidence", type: "report" }],
      outputs: [{ name: "patch", type: "code" }],
      cannot: ["acceptance-criteria", "special-case the literal values in a trace"],
    }),
  },
  {
    nodeId: "deployer",
    card: card({
      id: "release-gate",
      name: "Release Gate",
      type: "tool",
      phase: "deployment",
      inputs: [{ name: "release", type: "artifact" }],
      outputs: [],
      cannot: ["alter the artefact on the way through", "release work the tester did not sign off"],
    }),
  },
];

/* The terms the starter blueprint actually spends, off `lib/core/ontology/core.ts`. `byKind`
   still has to answer for every kind this pane asks about, so the four totals below are the
   real v0.1 core counts (5 phases, 8 node types, 15 data types, 9 risk markers) — the pane's
   own "n of total" line is only honest if the denominator is the vocabulary's real size. */
const SPENT: readonly OntologyTerm[] = [
  { id: "planning", kind: "phase", label: "Planning", description: "From the request to a plan and the acceptance criteria.", since: "0.1.0" },
  { id: "implementation", kind: "phase", label: "Implementation", description: "From the plan to the artefact.", since: "0.1.0" },
  { id: "testing", kind: "phase", label: "Testing", description: "Running the criteria against the artefact.", since: "0.1.0" },
  { id: "debugging", kind: "phase", label: "Debugging", description: "Turning failure evidence into a patch.", since: "0.1.0" },
  { id: "deployment", kind: "phase", label: "Deployment", description: "Admitting a signed-off build to its release target.", since: "0.1.0" },
  { id: "agent", kind: "node-type", label: "Agent", description: "A node an LLM instantiates from a spec.", since: "0.1.0" },
  { id: "validation", kind: "node-type", label: "Validation", description: "A node that judges another node's output.", since: "0.1.0" },
  { id: "tool", kind: "node-type", label: "Tool", description: "A node with no model behind it, deterministic by construction.", since: "0.1.0" },
  { id: "text", kind: "data-type", label: "Text", description: "Unstructured natural language.", since: "0.1.0" },
  { id: "plan", kind: "data-type", label: "Plan", description: "An ordered list of build steps.", since: "0.1.0" },
  { id: "acceptance-criteria", kind: "data-type", label: "Acceptance criteria", description: "Machine-decidable conditions a build must satisfy.", since: "0.1.0" },
  { id: "code", kind: "data-type", label: "Code", description: "A compiling source change.", since: "0.1.0" },
  { id: "report", kind: "data-type", label: "Report", description: "Raw failure output: assertions, traces, expected beside obtained.", since: "0.1.0" },
  { id: "artifact", kind: "data-type", label: "Artifact", description: "A signed-off build, ready to release.", since: "0.1.0" },
];
const TOTAL_OF_KIND: Record<string, number> = { phase: 5, "node-type": 8, "data-type": 15, "risk-marker": 9 };

function padded(kind: string): OntologyTerm[] {
  const real = SPENT.filter((t) => t.kind === kind);
  const filler: OntologyTerm[] = Array.from(
    { length: Math.max(0, (TOTAL_OF_KIND[kind] ?? 0) - real.length) },
    (_, i): OntologyTerm => ({
      id: `${kind}-${i}`,
      kind: kind as OntologyTerm["kind"],
      label: "",
      description: "",
      since: "0.1.0",
    }),
  );
  return [...real, ...filler];
}

const view: OntologyView = {
  ontology: { version: "0.1.0", title: "DarkPrint core vocabulary", terms: SPENT },
  get: (id) => SPENT.find((t) => t.id === id),
  resolve: (id) => {
    const term = SPENT.find((t) => t.id === id);
    return term === undefined ? undefined : { term, requestedId: id, redirected: false };
  },
  isA: (id, ancestorId) => id === ancestorId,
  ancestors: (id) => {
    const term = SPENT.find((t) => t.id === id);
    return term === undefined ? [] : [term];
  },
  children: () => [],
  byKind: (kind) => padded(kind),
  validate: () => [],
};

/** `/build`'s third pane: every term this blueprint's choices have committed to so far,
    including the honest empty state — no risk marker declared, so none used. */
export const Default = () => <VocabularyPane nodes={nodes} view={view} version="0.1.0" />;

/** The same pane with `tester` selected: the terms it spends light up cyan among the rest. */
export const NodeSelected = () => (
  <VocabularyPane nodes={nodes} view={view} version="0.1.0" selectedNodeId="tester" />
);
