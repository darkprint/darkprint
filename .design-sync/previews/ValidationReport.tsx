import { loadBundle } from "@/lib/core";
import { ValidationReport } from "darkprint";

/* ValidationReport calls the real engine internally (`graphForBlueprint`, `buildPaneModel`,
   `GraphPane`) once a bundle resolves, so a hand-typed `LoadBundleResult` risks a shape the
   engine did not itself produce. This runs the actual starter-software-factory bundle — the
   same DOT and the same five cards `content/blueprints/starter-software-factory` ships —
   through the real `loadBundle`, the same call `UploadFlow.tsx` makes, so all three states
   below are the engine's own output rather than an approximation of it. */

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

const BROKEN_DOT = `digraph starter_software_factory {
  rankdir=LR;
  planner [card="spec-planner@1.0.0"];
  builder [card="code-builder@1.0.0"];
  tester  [card="acceptance-tester@1.0.0"];
  planner -> tester [label="acceptance criteria"];
  builder -> tester [label="build"];
  tester ->
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
  independently of one another. Write no code yourself, and never weaken a criterion to make
  it easier to meet.
model: claude-opus-5
agent: Planner
tools: []
mcp: []
skill: skills/spec-planner.md

inputs:
  - name: request
    type: text
    description: The feature request the run was started with, in the requester's own words.
outputs:
  - name: plan
    type: plan
    description: The ordered build steps, each naming what it touches and what exists when it is done.
  - name: criteria
    type: acceptance-criteria
    description: The conditions the finished work must satisfy, one per line, each machine-decidable.
dependencies: []
cannot:
  - write any of the code it plans
  - weaken a criterion to make it easier to meet

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
  A build brief arrives with the run: an ordered list of steps, each naming the file or module
  it touches and what should exist once it is done. Emit the finished source on \`build\` as one
  complete, compiling change, with no commentary and no summary of what you did.
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

version: 1.0.0
author: orin
ontology_version: 0.1.0
`;

const ACCEPTANCE_TESTER = `id: acceptance-tester
name: Acceptance Tester
type: validation
phase: testing

action: >-
  Run every criterion against the submitted build and split the outcome: the build itself when
  all of them pass, the raw failure evidence when any of them does not.
spec: >-
  You are handed a set of criteria and a build. Run each criterion against that build in turn,
  one at a time, and record whether it held.
model: claude-sonnet-5
agent: Acceptance tester
tools: []
mcp: []
skill: skills/acceptance-tester.md

inputs:
  - name: criteria
    type: acceptance-criteria
    description: The conditions the build is judged against, as the planner wrote them.
  - name: build
    type: code
    description: The submitted change, the builder's first pass, or the debugger's patched version.
outputs:
  - name: evidence
    type: report
    description: Raw failure output only, assertions, traces, expected beside obtained. No criteria.
  - name: approved
    type: artifact
    description: The build unchanged, emitted only once every criterion has held.
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
  Turn one run's failure evidence into the narrowest patch that addresses it, and stop once the
  attempt cap is spent or the evidence stops changing.
spec: >-
  You are given the evidence from a run that failed. Find the smallest change to the existing
  source that accounts for those failures and emit it on \`patch\`. Stop after three attempts.
model: claude-opus-5
agent: Debugger
tools: []
mcp:
  - filesystem
skill: skills/targeted-debugger.md
params:
  max_iterations: 3

inputs:
  - name: evidence
    type: report
    description: One run's failure output, assertions, traces, expected beside obtained.
outputs:
  - name: patch
    type: code
    description: The narrowest change that accounts for the evidence, ready to be re-run.
dependencies:
  - acceptance-tester
cannot:
  - acceptance-criteria
  - special-case the literal values in a trace

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
  Admit only a signed-off build, write it to the run's release target with its tag and digest,
  and close the run.
spec: >-
  A build reaches you only once it has been signed off, and your first job is to check that.
  Write the artefact byte-for-byte as you received it to the release target named in the run
  configuration, under a tag made from the run id, and record the digest of exactly what you wrote.
tools: []
mcp:
  - filesystem
skill: skills/release-gate.md
params:
  target: run-releases
  tag_from: run_id
  record_digest: true

inputs:
  - name: release
    type: artifact
    description: The signed-off build, exactly as the tester released it.
outputs: []
dependencies:
  - acceptance-tester
cannot:
  - alter the artefact on the way through
  - release work the tester did not sign off

requires_human: false
risk_markers: []

version: 1.0.0
author: orin
ontology_version: 0.1.0
`;

const ALL_CARDS = {
  "cards/spec-planner@1.0.0.yaml": SPEC_PLANNER,
  "cards/code-builder@1.0.0.yaml": CODE_BUILDER,
  "cards/acceptance-tester@1.0.0.yaml": ACCEPTANCE_TESTER,
  "cards/targeted-debugger@1.0.0.yaml": TARGETED_DEBUGGER,
  "cards/release-gate@1.0.0.yaml": RELEASE_GATE,
};

const TWO_CARDS = {
  "cards/spec-planner@1.0.0.yaml": SPEC_PLANNER,
  "cards/code-builder@1.0.0.yaml": CODE_BUILDER,
};

const resolved = loadBundle({ manifest: MANIFEST, dot: DOT, cardFiles: ALL_CARDS });
const unfinished = loadBundle({ manifest: MANIFEST, dot: DOT, cardFiles: TWO_CARDS });
const rejected = loadBundle({ manifest: MANIFEST, dot: BROKEN_DOT, cardFiles: {} });

/** Every reference checked: the schematic and the two computed scores unlock. */
export const Resolved = () => <ValidationReport result={resolved} dot={DOT} />;

/** Two of five cards written. Every error is "not written yet," never "wrong." */
export const Unfinished = () => <ValidationReport result={unfinished} dot={DOT} />;

/** The DOT itself does not parse: no topology, no blueprint, the raw source stays open. */
export const Rejected = () => <ValidationReport result={rejected} dot={BROKEN_DOT} />;
