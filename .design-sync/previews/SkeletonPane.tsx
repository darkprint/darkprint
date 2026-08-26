import { SkeletonPane } from "darkprint";
import type { PaneAbsence, PaneCard, PaneField, PaneFocus, PaneModel, PaneNode } from "@/components/panes/model";

/* content/cards/code-builder@1.0.0.yaml, verbatim, with the 1-based line range each field
   actually occupies in that document — the same lines pane 4 would point a reader at. */
const CODE_BUILDER_YAML = `id: code-builder
name: Code Builder
type: agent
phase: implementation

action: >-
  Work through the build brief and emit the source it describes, adding nothing the brief does
  not ask for.
spec: >-
  A build brief arrives with the run: an ordered list of steps, each naming the file or module
  it touches and what should exist once it is done. Work through the steps in order and write
  the source they describe, staying inside the files each step names and adding no behaviour
  nobody asked for. Emit the finished source on \`build\` as one complete, compiling change, with
  no commentary and no summary of what you did. The brief is all you get, and that is the point
  do not go looking for a test suite, do not reason about how the result will be checked, and
  do not tune anything toward a check you imagine exists.
model: claude-sonnet-5
agent: Builder
tools: []
mcp:
  - filesystem
skill: skills/code-builder.md

inputs:
  - name: brief
    type: plan
    description: The ordered build steps the run was instantiated with, the only thing this node sees.
outputs:
  - name: build
    type: code
    description: One complete, compiling change implementing the brief, with no commentary attached.
dependencies: []
cannot:
  - acceptance-criteria
  - read the checks the work will be run against

requires_human: false
risk_markers: []
notes: >-
  Doc 1 §3.2: isolation is not only an absent edge, it is the absence of the content from the
  spec. This card is the reference for what that looks like, the spec above names no criterion,
  quotes no threshold and paraphrases nothing the planner wrote, so the similarity half of the
  \`criteria-leak\` check stays quiet on it as well as the topological half. Measured against
  \`spec-planner@1.0.0\`, the 3-gram Jaccard similarity is 0.0356, against a configured threshold
  of 0.35. \`acceptance-criteria\` in \`cannot\` names a data type in the ontology, so the resolver
  enforces it: draw an edge that carries the criteria into this node and the bundle fails with
  \`bundle/prohibition-violated\`. The absent edge is a rule the engine holds the graph to rather
  than a convention the author remembered.

version: 1.0.0
author: orin
ontology_version: 0.1.0
`;

const CODE_BUILDER_FIELDS: PaneField[] = [
  { key: "id", group: "identity", filled: true, value: "code-builder", lines: { start: 1, end: 1 } },
  { key: "name", group: "identity", filled: true, value: "Code Builder", lines: { start: 2, end: 2 } },
  { key: "type", group: "identity", filled: true, value: "agent", lines: { start: 3, end: 3 } },
  { key: "phase", group: "identity", filled: true, value: "implementation", lines: { start: 4, end: 4 } },
  {
    key: "action",
    group: "behaviour",
    filled: true,
    value: "Work through the build brief and emit the source it describes, adding nothing the brief does not ask for.",
    lines: { start: 6, end: 8 },
  },
  {
    key: "spec",
    group: "behaviour",
    filled: true,
    value:
      "A build brief arrives with the run: an ordered list of steps, each naming the file or module it touches and what should exist once it is done. Work through the steps in order and write the source they describe, staying inside the files each step names and adding no behaviour nobody asked for. Emit the finished source on `build` as one complete, compiling change, with no commentary and no summary of what you did. The brief is all you get, and that is the point do not go looking for a test suite, do not reason about how the result will be checked, and do not tune anything toward a check you imagine exists.",
    measure: "115 words",
    lines: { start: 9, end: 16 },
  },
  { key: "model", group: "behaviour", filled: true, value: "claude-sonnet-5", lines: { start: 17, end: 17 } },
  { key: "agent", group: "behaviour", filled: true, value: "Builder", lines: { start: 18, end: 18 } },
  { key: "skill", group: "behaviour", filled: true, value: "skills/code-builder.md", lines: { start: 22, end: 22 } },
  { key: "tools", group: "behaviour", filled: false, value: "none required", lines: { start: 19, end: 19 } },
  { key: "mcp", group: "behaviour", filled: true, value: "filesystem", lines: { start: 20, end: 21 } },
  { key: "params", group: "behaviour", filled: false, value: "none set" },
  {
    key: "inputs",
    group: "interfaces",
    filled: true,
    value: "brief: plan",
    detail: "brief: plan — The ordered build steps the run was instantiated with, the only thing this node sees.",
    lines: { start: 24, end: 27 },
  },
  {
    key: "outputs",
    group: "interfaces",
    filled: true,
    value: "build: code",
    detail: "build: code — One complete, compiling change implementing the brief, with no commentary attached.",
    lines: { start: 28, end: 31 },
  },
  { key: "dependencies", group: "interfaces", filled: false, value: "no upstream node is named", lines: { start: 32, end: 32 } },
  {
    key: "cannot",
    group: "interfaces",
    filled: true,
    value: "acceptance-criteria, read the checks the work will be run against",
    lines: { start: 33, end: 35 },
  },
  {
    key: "requires_human",
    group: "evaluation",
    filled: true,
    value: "false. A run passes through without stopping.",
    lines: { start: 37, end: 37 },
  },
  { key: "risk_markers", group: "evaluation", filled: false, value: "none declared", lines: { start: 38, end: 38 } },
  {
    key: "notes",
    group: "evaluation",
    filled: true,
    value:
      "Doc 1 §3.2: isolation is not only an absent edge, it is the absence of the content from the spec. This card is the reference for what that looks like, the spec above names no criterion, quotes no threshold and paraphrases nothing the planner wrote, so the similarity half of the `criteria-leak` check stays quiet on it as well as the topological half. Measured against `spec-planner@1.0.0`, the 3-gram Jaccard similarity is 0.0356, against a configured threshold of 0.35. `acceptance-criteria` in `cannot` names a data type in the ontology, so the resolver enforces it: draw an edge that carries the criteria into this node and the bundle fails with `bundle/prohibition-violated`. The absent edge is a rule the engine holds the graph to rather than a convention the author remembered.",
    measure: "128 words",
    lines: { start: 39, end: 48 },
  },
  { key: "version", group: "service", filled: true, value: "1.0.0", lines: { start: 50, end: 50 } },
  { key: "author", group: "service", filled: true, value: "orin", lines: { start: 51, end: 51 } },
  { key: "provenance", group: "service", filled: false, value: "not stated" },
  { key: "ontology_version", group: "service", filled: true, value: "0.1.0", lines: { start: 52, end: 52 } },
];

const CODE_BUILDER_CARD: PaneCard = {
  ref: "code-builder@1.0.0",
  id: "code-builder",
  name: "Code Builder",
  yaml: CODE_BUILDER_YAML,
  fields: CODE_BUILDER_FIELDS,
};

const TOPOLOGY_DOT = `digraph starter_software_factory {
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

/* The one absence the starter blueprint teaches: nothing carries the acceptance criteria
   from planner to builder, and `code-builder`'s own `cannot` field is the prohibition that
   would refuse it. */
const ABSENCE: PaneAbsence = {
  id: "planner-to-builder",
  label: "planner ⇢ builder",
  detail:
    "No edge in this graph carries the acceptance criteria from planner to builder. Drawing one would be refused: this card's own `cannot` names the type.",
  nodeId: "builder",
  edge: { source: "planner", target: "builder" },
  field: { nodeId: "builder", key: "cannot" },
};

const BUILDER_NODE: PaneNode = {
  nodeId: "builder",
  label: "builder",
  dotLine: 6,
  edgeLines: [11],
  sources: [],
  targets: ["tester"],
  card: CODE_BUILDER_CARD,
};

const PLANNER_NODE: PaneNode = { nodeId: "planner", label: "planner", dotLine: 5, edgeLines: [10], sources: [], targets: ["tester"] };
const TESTER_NODE: PaneNode = { nodeId: "tester", label: "tester", dotLine: 7, edgeLines: [10, 11, 12, 13, 14], sources: ["planner", "builder", "debugger"], targets: ["debugger", "deployer"] };
const DEBUGGER_NODE: PaneNode = { nodeId: "debugger", label: "debugger", dotLine: 8, edgeLines: [12, 13], sources: ["tester"], targets: ["tester"] };
const DEPLOYER_NODE: PaneNode = { nodeId: "deployer", label: "deployer", dotLine: 9, edgeLines: [14], sources: ["tester"], targets: [] };

const MODEL: PaneModel = {
  slug: "starter-software-factory",
  title: "Starter Software Factory",
  dot: TOPOLOGY_DOT,
  dotFile: "topology.dot",
  nodes: [PLANNER_NODE, BUILDER_NODE, TESTER_NODE, DEBUGGER_NODE, DEPLOYER_NODE],
  absences: [ABSENCE],
  dotLineNodes: {},
  dotLineMeaning: {},
};

function focusOn(field?: PaneField): PaneFocus {
  return {
    node: BUILDER_NODE,
    card: CODE_BUILDER_CARD,
    field,
    graphNodeId: "builder",
    dotPrimary: [6],
    dotSecondary: [11],
    yamlPrimary: field?.lines === undefined ? [] : [field.lines.start, field.lines.end],
    dotActiveLine: 6,
    cardActiveLine: field?.lines?.start,
    dotGhosts: [],
    yamlGhosts: [],
  };
}

/** `SynchronisedPanes`' pane 2 for the builder node: every block, and the one absence a
    "interfaces / cannot" row carries — the reader's own edge that never got drawn. */
export const Closed = () => (
  <SkeletonPane
    paneNumber={2}
    model={MODEL}
    focus={focusOn(undefined)}
    onSelectField={() => {}}
    onSelectAbsence={() => {}}
    linkToCard
  />
);

/** The `spec` row opened: the clamp lifted, the whole payload legible, exactly the disclosure
    the author asked this pane to gain. */
export const FieldOpen = () => (
  <SkeletonPane
    paneNumber={2}
    model={MODEL}
    focus={focusOn(CODE_BUILDER_FIELDS.find((f) => f.key === "spec"))}
    onSelectField={() => {}}
    onSelectAbsence={() => {}}
    linkToCard
  />
);

/** The DOT pins a card this bundle does not carry — the resolver's own unresolved-node case. */
export const CardMissing = () => (
  <SkeletonPane
    paneNumber={2}
    model={MODEL}
    focus={{
      node: DEBUGGER_NODE,
      card: undefined,
      graphNodeId: "debugger",
      dotPrimary: [8],
      dotSecondary: [12, 13],
      yamlPrimary: [],
      dotActiveLine: 8,
      dotGhosts: [],
      yamlGhosts: [],
    }}
    onSelectField={() => {}}
    onSelectAbsence={() => {}}
  />
);
