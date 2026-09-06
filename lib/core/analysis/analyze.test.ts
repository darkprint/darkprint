/* ============================================================
   End-to-end tests for the analysis facade.
   Everything below goes in as text — a DOT source and a handful
   of hand-written YAML cards, exactly what an upload contains —
   and comes out as a scored blueprint. Nothing is stubbed: the
   lexer, parser, card validator, hasher, resolver, the Attractor
   linter and both metrics all run for real.

   All three fixtures were rewritten against doc 3's vocabulary.
   The old vocabulary they used — `trigger`, `sink`, `network-
   access`, `code-execution`, `human-control`, `credential-access`
   — does not exist any more, and neither does the security repeat
   curve those numbers were computed under. Every card now carries
   the two fields doc 3 §2 and doc 1 §3.2 made required, `phase`
   and `spec`.
   ============================================================ */

import { describe, expect, it } from "vitest";
import type { Bundle, BundleManifest } from "../bundle/types";
import { summarize, type Diagnostic } from "../diagnostics";
import { DARKPRINT_CONFIG, type DarkprintConfig } from "../config";
import { CORE_ONTOLOGY } from "../ontology/core";
import { ontologyView } from "../ontology/resolve";
import type { OntologyTerm } from "../ontology/types";
import { analyzeBlueprint, loadBundle } from "./analyze";

/**
 * The `since` a locally declared fixture term carries. Read off a core term rather than
 * written out, so the one fixture below states what the shipped vocabulary states; there is
 * no vocabulary version left to read it from.
 */
const TERM_SINCE = CORE_ONTOLOGY.terms[0].since;

/* ============================================================
   fixture 1 — "adversarial consensus", a healthy blueprint
   Two solvers draft in parallel, a vote picks a winner, a
   validation step checks it, and a contested vote escalates to a
   human before the report is published.
   ============================================================ */

const CONSENSUS_DOT = `digraph adversarial_consensus {
  rankdir=LR;
  node [shape=box, style=rounded];

  task     [card="task-intake@1.0.0"];
  plan     [card="decompose@1.0.0"];
  solver_a [card="solver-a@1.2.0"];
  solver_b [card="solver-b@1.2.0"];
  vote     [card="consensus-vote@1.1.0"];
  verify   [card="verify@1.0.0"];
  reopen   [card="escalate@1.0.0"];
  deliver  [card="deliver@1.0.0"];

  task     -> plan;
  plan     -> solver_a;
  plan     -> solver_b;
  solver_a -> vote;
  solver_b -> vote;
  vote     -> verify;
  verify   -> deliver [label="pass", out="approved", in="payload"];
  verify   -> reopen  [label="conflict", style=dashed];
  reopen   -> vote    [label="re-vote"];
}`;

const CONSENSUS_CARDS: Record<string, string> = {
  "cards/task-intake@1.0.0.yaml": `id: task-intake
name: Task intake
type: tool
phase: planning
version: 1.0.0
action: Accept the incoming task and hand it to the pipeline
spec: Take the task exactly as the requester wrote it and place it on the task port unchanged, adding nothing and dropping nothing.
inputs: []
outputs:
  - { name: task, type: text }
dependencies: []
`,
  "cards/decompose@1.0.0.yaml": `id: decompose
name: Decompose
type: agent
phase: planning
version: 1.0.0
action: Break the task into independently solvable sub-tasks
spec: Split the incoming task into sub-tasks that can each be solved on their own, and emit them as an ordered list on the subtasks port.
model: claude-opus-4
inputs:
  - { name: task, type: text }
outputs:
  - { name: subtasks, type: plan }
dependencies: [task-intake]
`,
  "cards/solver-a@1.2.0.yaml": `id: solver-a
name: Solver A
type: agent
phase: implementation
version: 1.2.0
action: Draft a candidate solution at low temperature
spec: Work the sub-tasks in order and return one conservative candidate solution as JSON, favouring the obvious approach over the clever one.
model: claude-opus-4
params:
  temperature: 0.2
inputs:
  - { name: subtasks, type: plan }
outputs:
  - { name: draft, type: json }
dependencies: [decompose]
`,
  "cards/solver-b@1.2.0.yaml": `id: solver-b
name: Solver B
type: agent
phase: implementation
version: 1.2.0
action: Draft a candidate solution at high temperature
spec: Work the sub-tasks in order and return one exploratory candidate solution as JSON, preferring an unusual approach where it plausibly wins.
model: claude-opus-4
params:
  temperature: 0.9
inputs:
  - { name: subtasks, type: plan }
outputs:
  - { name: draft, type: json }
dependencies: [decompose]
`,
  "cards/consensus-vote@1.1.0.yaml": `id: consensus-vote
name: Consensus vote
type: decision
phase: testing
version: 1.1.0
action: Score the candidate drafts against each other and pick a winner
spec: Score the candidate drafts against one another on correctness first and cost second, then route the stronger one onward as the winner.
params:
  max_iterations: 2
inputs:
  - { name: candidates, type: json }
  - { name: reopened, type: signal, required: false }
outputs:
  - { name: winner, type: json }
dependencies: [solver-a, solver-b, escalate]
`,
  "cards/verify@1.0.0.yaml": `id: verify
name: Verify
type: validation
phase: testing
version: 1.0.0
action: Check the winning draft against the acceptance criteria
spec: Run the checks the request implies against the winning draft and emit a verdict, quoting the failing evidence whenever the answer is no.
inputs:
  - { name: winner, type: json }
outputs:
  - { name: verdict, type: status }
  - { name: approved, type: report }
dependencies: [consensus-vote]
`,
  "cards/escalate@1.0.0.yaml": `id: escalate
name: Escalate to a reviewer
type: human-gate
phase: testing
version: 1.0.0
action: Ask a reviewer to re-open the debate when the vote is contested
spec: Show the reviewer both candidate drafts and the verdict, and wait for them to say whether the debate should be re-opened.
tools: [human-review]
inputs:
  - { name: verdict, type: status }
outputs:
  - { name: reopened, type: event }
dependencies: [verify]
`,
  "cards/deliver@1.0.0.yaml": `id: deliver
name: Deliver
type: human-gate
phase: deployment
version: 1.0.0
action: Publish the approved report to the customer channel
spec: Post the approved report to the customer channel named in the run configuration, and record where it landed.
tools: [messaging]
inputs:
  - { name: payload, type: report }
outputs: []
dependencies: [verify]
`,
};

/* ============================================================
   fixture 2 — "rogue scraper", the same shape gone wrong
   A shell node, an unvalidated fetch and a retry loop nothing can
   break out of. Structurally valid: it must resolve cleanly so
   that the collapsed score cannot be blamed on a broken upload.
   ============================================================ */

const ROGUE_DOT = `digraph rogue_scraper {
  intake [card="intake@1.0.0"];
  fetch  [card="scrape@1.0.0"];
  exec   [card="run-script@1.0.0"];
  refine [card="refine-script@1.0.0"];
  ship   [card="ship@1.0.0"];

  intake -> fetch;
  fetch  -> exec;
  exec   -> refine;
  refine -> exec [label="retry"];
  refine -> ship;
}`;

const ROGUE_CARDS: Record<string, string> = {
  "cards/intake@1.0.0.yaml": `id: intake
name: Intake
type: tool
phase: planning
version: 1.0.0
action: Take the target the operator typed in
spec: Read the target the operator typed and put it on the query port with no interpretation of any kind.
inputs: []
outputs:
  - { name: query, type: text }
`,
  "cards/scrape@1.0.0.yaml": `id: scrape
name: Scrape the target
type: agent
phase: implementation
version: 1.0.0
action: Fetch the page behind the query and return its body
spec: Resolve the query to a URL, fetch that page with the stored session token, and return the body verbatim on the page port.
tools: [http-fetch]
risk_markers: [secret-access]
dependencies: [intake]
inputs:
  - { name: query, type: text }
outputs:
  - { name: page, type: text }
`,
  "cards/run-script@1.0.0.yaml": `id: run-script
name: Run the extracted script
type: tool
phase: implementation
version: 1.0.0
action: Execute whatever the scraper produced and capture the result
spec: Execute the script found in the fetched page in a shell and capture whatever it writes to standard output as the result.
tools: [shell]
risk_markers: [arbitrary-code-execution]
dependencies: [scrape, refine-script]
inputs:
  - { name: script, type: text }
outputs:
  - { name: result, type: json }
`,
  "cards/refine-script@1.0.0.yaml": `id: refine-script
name: Refine the script
type: agent
phase: debugging
version: 1.0.0
action: Rewrite the script from the last result and try again
spec: Read the last result, rewrite the extraction script so it gets further than the previous attempt, and send it back to be run.
dependencies: [run-script]
inputs:
  - { name: result, type: json }
outputs:
  - { name: script, type: text }
`,
  "cards/ship@1.0.0.yaml": `id: ship
name: Ship
type: tool
phase: deployment
version: 1.0.0
action: Write the final extract to the operator's inbox
spec: Write the final extract to the operator inbox configured for this run and report the path it was written to.
dependencies: [refine-script]
inputs:
  - { name: payload, type: text }
outputs: []
`,
};

/* ============================================================
   fixture 3 — the starter of doc 2 §5.2
   Five nodes, one phase each: planner, builder, tester, debugger,
   deployer, with doc 2 §5.5's `tester -> debugger -> tester` loop
   and the iteration cap that section requires.

   THE SHAPE, AND THE ONE JUDGEMENT CALL IN IT. Doc 2 §5.2 has the
   planner produce "piano + criteri di accettazione" and feed the
   builder the plan. Under doc 3 §4.1 that is already a leak: the
   rule is reachability, not which port an edge carries, and it is
   written that way on purpose — "copre il caso in cui l'arco
   diretto è assente ma l'informazione arriva per vie traverse".
   A builder one hop downstream of the node holding the criteria is
   exactly that case. So the clean starter keeps the criteria
   producer off every path into the builder, and the builder takes
   its instructions from its own `spec`, which doc 1 §0.1.2 makes
   the payload that instructs the agent in the first place.

   `tester` is a `validation` node, and that is now load-bearing
   rather than cosmetic: the `criteria-leak` generator set is
   `{ n | ∃ v : type(v) ⊑ validation ∧ edge(n → v) }`, so it is the
   tester's *type* that makes the builder a node whose work is
   judged. Doc 3 §3 defines `validation` as exactly what this card
   does — "confronta un artefatto contro criteri e produce un
   verdetto con evidenze" — and the real archive's
   `acceptance-tester@1.0.0` declares it too. It used to say `tool`,
   which was a shrug, and under the old `phase: implementation`
   anchor nothing depended on it.

   The pair below is the point of this file: two bundles that
   differ by ONE edge, `planner -> builder`. That edge is doc 2
   §5.4's demonstration switch, and adding it must move the score.
   ============================================================ */

const STARTER_DOT = `digraph starter {
  rankdir=LR;

  planner  [card="planner@1.0.0"];
  builder  [card="builder@1.0.0"];
  tester   [card="tester@1.0.0"];
  debugger [card="debugger@1.0.0"];
  deployer [card="deployer@1.0.0"];

  planner  -> tester   [label="acceptance criteria"];
  builder  -> tester   [label="code"];
  tester   -> debugger [label="failure evidence"];
  debugger -> tester   [label="patch"];
  tester   -> deployer [label="approved build"];
}`;

/** Doc 2 §5.4: the arc that must not exist, and the whole reason the pair is here. */
const LEAK_EDGE = "  planner  -> builder [label=\"acceptance criteria\"];\n}";

const STARTER_LEAKING_DOT = STARTER_DOT.replace(/}$/, LEAK_EDGE);

const STARTER_CARDS: Record<string, string> = {
  "cards/planner@1.0.0.yaml": `id: planner
name: Planner
type: agent
phase: planning
version: 1.0.0
action: Turn the request into acceptance criteria
spec: Read the request and write the conditions the finished work must satisfy, one per line, phrased so a machine can check each of them.
inputs: []
outputs:
  - { name: criteria, type: acceptance-criteria }
dependencies: []
`,
  "cards/builder@1.0.0.yaml": `id: builder
name: Builder
type: agent
phase: implementation
version: 1.0.0
action: Write the code the brief asks for
spec: Build what the brief describes, in the smallest change that does the job, and hand the result over as source without commentary.
inputs:
  - { name: brief, type: structured }
outputs:
  - { name: code, type: code }
dependencies: []
`,
  "cards/tester@1.0.0.yaml": `id: tester
name: Tester
type: validation
phase: testing
version: 1.0.0
action: Run the checks and report what failed
spec: Execute every check against the submitted build and report a verdict, an approved bundle when it passes, and the failing evidence when it does not.
inputs:
  - { name: criteria, type: acceptance-criteria }
  - { name: artifact, type: code }
outputs:
  - { name: verdict, type: status }
  - { name: evidence, type: report }
  - { name: approved, type: artifact }
dependencies: [planner, builder, debugger]
`,
  "cards/debugger@1.0.0.yaml": `id: debugger
name: Debugger
type: agent
phase: debugging
version: 1.0.0
action: Turn failure evidence into a targeted patch
spec: Take the stack traces and failed assertions from the last run and produce the narrowest patch that addresses them, changing nothing else.
params:
  max_iterations: 3
inputs:
  - { name: evidence, type: report }
outputs:
  - { name: patch, type: code }
dependencies: [tester]
`,
  "cards/deployer@1.0.0.yaml": `id: deployer
name: Deployer
type: tool
phase: deployment
version: 1.0.0
action: Release the approved build
spec: Publish the approved build to the target named in the run configuration and report the released version back to the operator.
inputs:
  - { name: release, type: artifact }
outputs: []
dependencies: [tester]
`,
};

/** The leaking variant declares the edge it adds, so the delta is the marker and not a warning. */
const STARTER_LEAKING_CARDS: Record<string, string> = {
  ...STARTER_CARDS,
  "cards/builder@1.0.0.yaml": STARTER_CARDS["cards/builder@1.0.0.yaml"].replace(
    "dependencies: []",
    "dependencies: [planner]",
  ),
};

/* --------------------- helpers --------------------- */

function manifest(over: Partial<BundleManifest> = {}): BundleManifest {
  return {
    slug: "adversarial-consensus",
    title: "Adversarial consensus",
    summary: "Two solvers argue, a vote decides, a human breaks the tie.",
    tags: ["consensus", "multi-agent"],
    ...over,
  };
}

const consensusBundle = (over: Partial<Bundle> = {}): Bundle => ({
  manifest: manifest(),
  dot: CONSENSUS_DOT,
  cardFiles: CONSENSUS_CARDS,
  ...over,
});

const rogueBundle = (): Bundle => ({
  manifest: manifest({ slug: "rogue-scraper", title: "Rogue scraper", tags: [] }),
  dot: ROGUE_DOT,
  cardFiles: ROGUE_CARDS,
});

const starterBundle = (): Bundle => ({
  manifest: manifest({
    slug: "starter",
    title: "Starter factory",
    summary: "The five phases, one node each, with the criteria kept away from the builder.",
    tags: ["starter"],
  }),
  dot: STARTER_DOT,
  cardFiles: STARTER_CARDS,
});

const leakingStarterBundle = (): Bundle => ({
  ...starterBundle(),
  dot: STARTER_LEAKING_DOT,
  cardFiles: STARTER_LEAKING_CARDS,
});

/** Codes only — what a failing assertion needs to say which diagnostic is unexpected. */
function codes(ds: readonly Diagnostic[]): string[] {
  return ds.map((d) => `${d.severity}:${d.code} ${d.message}`);
}

/* ============================================================
   the happy path
   ============================================================ */

describe("loadBundle — the adversarial-consensus blueprint", () => {
  const result = loadBundle(consensusBundle());

  it("resolves every node and reports one thing: that the criteria check could not run", () => {
    // Listed rather than counted: a failure names the diagnostic that appeared.
    //
    // This used to expect an empty list. It is not a regression, it is the finding: this
    // blueprint has a `validation` node judging the vote's output and no node anywhere
    // declaring an `acceptance-criteria` port, so the most important check in the system
    // has nothing to anchor on. It reported silence before, which was indistinguishable
    // from a pass. Eight of the nine bundles in the real archive are in this state.
    expect(codes(result.diagnostics)).toEqual([
      'warning:analysis/criteria-leak-unanchored The `criteria-leak` check was not evaluated on this blueprint: "verify" judges the output of "vote", but no node declares an output port typed `acceptance-criteria`, so there is no criteria producer to trace a path from.',
    ]);
    expect(summarize(result.diagnostics).error).toBe(0);
    expect(result.blueprint).toBeDefined();
    expect(result.analysis).toBeDefined();
  });

  it("joins all eight DOT nodes to their pinned cards", () => {
    const bp = result.blueprint;
    if (bp === undefined) throw new Error("expected the bundle to resolve");
    expect(bp.nodes).toHaveLength(8);
    expect(bp.graph.ids).toHaveLength(8);
    expect(bp.nodes.map((n) => n.nodeId)).toEqual([
      "task",
      "plan",
      "solver_a",
      "solver_b",
      "vote",
      "verify",
      "reopen",
      "deliver",
    ]);
    expect(bp.nodes.map((n) => n.ref)).toEqual([
      "task-intake@1.0.0",
      "decompose@1.0.0",
      "solver-a@1.2.0",
      "solver-b@1.2.0",
      "consensus-vote@1.1.0",
      "verify@1.0.0",
      "escalate@1.0.0",
      "deliver@1.0.0",
    ]);
    expect(bp.cards.size).toBe(8);
    expect(bp.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("wires the edges to real ports, pinned and inferred alike", () => {
    const bp = result.blueprint;
    if (bp === undefined) throw new Error("expected the bundle to resolve");
    expect(bp.edges).toHaveLength(9);

    // Pinned with out=/in= on the DOT edge.
    const pass = bp.edges.find((e) => e.source === "verify" && e.target === "deliver");
    expect(pass?.label).toBe("pass");
    expect(pass?.fromPort).toEqual({ name: "approved", type: "report" });
    expect(pass?.toPort).toEqual({ name: "payload", type: "report" });

    // Inferred: `event` is the only output that any input of `vote` accepts.
    const revote = bp.edges.find((e) => e.source === "reopen" && e.target === "vote");
    expect(revote?.fromPort).toEqual({ name: "reopened", type: "event" });
    expect(revote?.toPort).toEqual({ name: "reopened", type: "signal", required: false });
  });

  it("scores autonomy 2 (Supervised) and says where the two people are", () => {
    const autonomy = result.analysis?.autonomy;
    if (autonomy === undefined) throw new Error("expected an analysis");

    expect(autonomy.label).toBe("Supervised");
    expect(autonomy.totalNodes).toBe(8);
    expect(autonomy.autonomousNodes).toBe(6);
    expect(autonomy.staffingFraction).toBe(0.75);
    /* Six of eight nodes run alone and the band still lands on 2, because the second
       reading is the weaker one here: both of this graph's people stand on control points.
       That is the whole reason the reading exists — by headcount alone this blueprint reads
       the same as one whose two people do work that decides nothing. */
    expect(autonomy.control.totalNodes).toBe(4);
    expect(autonomy.control.unattendedNodes).toBe(2);
    expect(autonomy.fraction).toBe(autonomy.control.fraction);
    expect(autonomy.level).toBe(2);
    // Doc 2 §1.1: the sentence states where the people are, not how far the graph is
    // from full autonomy.
    expect(autonomy.rationale).toBe(
      "6 of 8 nodes run unattended, 2 have a person in the loop. 2 of 4 control points run unattended. 0.50 ≥ 0.50 → level 2 (Supervised).",
    );
    expect(autonomy.diagnostics).toEqual([]);

    // Doc 1 §8.3: every node explains itself, in graph order.
    expect(autonomy.contributions).toHaveLength(8);
    expect(autonomy.contributions.map((c) => c.nodeId)).toEqual(bp(result).graph.ids.slice());

    const human = autonomy.contributions.filter((c) => c.requiresHuman);
    expect(human.map((c) => c.nodeId)).toEqual(["reopen", "deliver"]);
    /* Both people are here because their cards say `human-gate`, and that is the only way
       a card can put one there. `deliver` used to be a `tool` carrying `requires_human:
       true` — the author staffing a node whose type said nothing about people — and this
       cell asserted the second reason the metric had for counting it. The field is gone,
       so a node the author staffs is a node they type, and the fixture says what it means
       in the field every other surface reads. */
    expect(human.map((c) => c.reason)).toEqual([
      "human-in-the-loop-type",
      "human-in-the-loop-type",
    ]);
    expect(human.map((c) => c.term)).toEqual(["human-gate", "human-gate"]);
    expect(human[0].explanation).toBe(
      "Ask a reviewer to re-open the debate when the vote is contested (type: human-gate). A person acts here.",
    );
    expect(human[1].explanation).toBe(
      "Publish the approved report to the customer channel (type: human-gate). A person acts here.",
    );

    const solver = autonomy.contributions.find((c) => c.nodeId === "solver_a");
    expect(solver?.requiresHuman).toBe(false);
    expect(solver?.reason).toBeUndefined();
    expect(solver?.explanation).toBe(
      "Draft a candidate solution at low temperature (type: agent). Runs unattended.",
    );
  });

  it("scores security 4: no marker is declared and none is inferred", () => {
    const security = result.analysis?.security;
    if (security === undefined) throw new Error("expected an analysis");

    expect(security.level).toBe(4);
    expect(security.raw).toBe(4);
    expect(security.findings).toEqual([]);
    expect(security.penalties).toEqual([]);
    expect(security.rationale).toBe("4 − 0.00 (no risk marker present across 8 nodes) → 4");
  });

  it("qualifies that 4: one of the three inferred markers was never evaluated", () => {
    // The whole reason `analysis/criteria-leak-unanchored` exists. A 4 with this warning
    // beside it is not the same claim as a 4 without it, and the warning does not move
    // the number: reporting that the system does not know is a third state, not evidence.
    const security = result.analysis?.security;
    if (security === undefined) throw new Error("expected an analysis");

    expect(security.diagnostics.map((d) => d.code)).toEqual([
      "analysis/criteria-leak-unanchored",
    ]);
    expect(security.diagnostics[0].severity).toBe("warning");
    expect(security.raw).toBe(4);
  });

  it("does not read the re-vote loop as unbounded: the vote declares a cap", () => {
    const graph = bp(result).graph;
    expect(graph.cycles()).toEqual([["vote", "verify", "reopen"]]);
    // Doc 3 §4.1's condition is a cycle in which NO member declares an iteration cap. The
    // pre-doc-3 metric also accepted a `decision` node as a brake; that is gone, so this
    // fixture has to earn its clean score by declaring `params.max_iterations` on `vote`.
    expect(result.analysis?.security.findings.filter((f) => f.marker === "unbounded-loop")).toEqual(
      [],
    );
  });

  it("covers four of the five phases, and says so without scoring it", () => {
    const analysis = result.analysis;
    if (analysis === undefined) throw new Error("expected an analysis");
    // Doc 3 §2 lifecycle order, never alphabetical, and `missing` is scope and not a gap.
    expect(analysis.phaseCoverage.covered).toEqual([
      "planning",
      "implementation",
      "testing",
      "deployment",
    ]);
    expect(analysis.phaseCoverage.missing).toEqual(["debugging"]);
    expect(analysis.phaseCoverage).toEqual(bp(result).phaseCoverage);
  });

  it("is reproducible: the same bytes in, the same digest and the same scores out", () => {
    const again = loadBundle(consensusBundle());
    expect(again.blueprint?.digest).toBe(result.blueprint?.digest);
    expect(again.analysis?.autonomy).toEqual(result.analysis?.autonomy);
    expect(again.analysis?.security).toEqual(result.analysis?.security);
  });
});

/* ============================================================
   the unsafe path
   ============================================================ */

describe("loadBundle — the rogue-scraper blueprint", () => {
  const result = loadBundle(rogueBundle());

  it("resolves without a single error, so the score is about the graph and not the upload", () => {
    expect(codes(result.diagnostics)).toEqual([]);
    expect(result.blueprint?.nodes).toHaveLength(5);
  });

  it("is fully autonomous — which is exactly what makes it dangerous", () => {
    const autonomy = result.analysis?.autonomy;
    expect(autonomy?.level).toBe(4);
    expect(autonomy?.label).toBe("Closed-loop");
    expect(autonomy?.fraction).toBe(1);
    expect(autonomy?.rationale).toBe(
      "5 of 5 nodes run unattended, none have a person in the loop. 1.00 > 0.90 → level 4 (Closed-loop).",
    );
  });

  it("collapses security to 1 and charges each marker once for the blueprint", () => {
    const security = result.analysis?.security;
    if (security === undefined) throw new Error("expected an analysis");

    // Doc 3 §5: 4 − (2.00 + 1.50 + 1.00 + 1.00) = −1.50, clamped to 1. Two markers are
    // declared on the cards, two are inferred from the graph, and none is charged twice.
    expect(security.raw).toBe(-1.5);
    expect(security.level).toBe(1);
    expect(security.rationale).toBe(
      "4 − 2.00 (arbitrary-code-execution) − 1.50 (unbounded-loop) − 1.00 (secret-access) − 1.00 (unvalidated-external-access) → 1",
    );

    expect(security.penalties.map((p) => [p.marker, p.weight, p.nodeIds])).toEqual([
      ["arbitrary-code-execution", 2, ["exec"]],
      ["unbounded-loop", 1.5, ["exec", "refine"]],
      ["secret-access", 1, ["fetch"]],
      ["unvalidated-external-access", 1, ["fetch"]],
    ]);
  });

  it("says of every finding which way it was established (doc 3 §4.1)", () => {
    const findings = result.analysis?.security.findings ?? [];
    expect(findings.map((f) => [f.marker, f.nodeId, f.establishedBy])).toEqual([
      ["arbitrary-code-execution", "exec", "declared"],
      ["unbounded-loop", "exec", "inferred"],
      ["unbounded-loop", "refine", "inferred"],
      ["secret-access", "fetch", "declared"],
      ["unvalidated-external-access", "fetch", "inferred"],
    ]);
    for (const finding of findings) {
      expect(finding.hint).toBeTruthy();
    }
  });

  it("explains each finding well enough to act on", () => {
    const findings = result.analysis?.security.findings ?? [];
    const byMarker = new Map(findings.map((f) => [f.marker, f]));

    expect(byMarker.get("arbitrary-code-execution")?.explanation).toContain(
      "declares the risk marker `arbitrary-code-execution`",
    );
    expect(byMarker.get("unvalidated-external-access")?.explanation).toContain(
      'reaches outside the graph (tool "http-fetch") and hands its output straight to "exec" with no validation node in between',
    );
    expect(byMarker.get("unbounded-loop")?.explanation).toContain(
      "in which no node declares an iteration cap",
    );
  });

  it("charges the loop once for the pair, and lists both members (doc 3 §5)", () => {
    const penalty = (result.analysis?.security.penalties ?? []).find(
      (p) => p.marker === "unbounded-loop",
    );
    expect(penalty?.weight).toBe(1.5);
    expect(penalty?.nodeIds).toEqual(["exec", "refine"]);
    expect(penalty?.explanation).toContain("once for the blueprint");
  });
});

/* ============================================================
   fixture 3 — the isolation the whole system exists to check
   ============================================================ */

describe("loadBundle — the doc 2 §5.2 starter, clean", () => {
  const result = loadBundle(starterBundle());

  it("reports one thing: the one channel the topology cannot follow", () => {
    // This used to expect an empty list, and the empty list was a claim the engine could
    // not support. Doc 2 §5.5's repair loop is `tester → debugger → tester`, so the
    // criteria reach the tester and the tester's output reaches the debugger, whose patch
    // the tester then judges. Whether what crosses that edge is failure evidence (doc 2
    // §5.5 endorses it) or the criteria set (doc 2 §5.5 forbids it in the next sentence)
    // is a fact about the prose: `tester → debugger → tester` and the forbidden
    // `tester → builder → tester` are the same shape in the graph. The walk stops at the
    // judge either way, and now it says that it stopped. Doc 2 §5.5 flags this exact
    // channel itself — "su molte iterazioni il debugger può ricostruire i criteri
    // accumulando messaggi di errore" — so naming it on the flagship is the finding, not
    // noise on it.
    expect(codes(result.diagnostics)).toEqual([
      'warning:analysis/criteria-relayed-through-judge The `criteria-leak` check stops at "tester" on this blueprint and does not trace past it: the acceptance criteria reach that validation node, and its output flows on to "Debugger" (debugger), whose own work is judged in turn. Whether what it forwards is failure evidence or the criteria themselves is a property of the prose, not of the graph.',
    ]);
    expect(summarize(result.diagnostics).error).toBe(0);
    expect(result.blueprint?.nodes).toHaveLength(5);
  });

  it("covers all five phases", () => {
    expect(result.analysis?.phaseCoverage.covered).toEqual([
      "planning",
      "implementation",
      "testing",
      "debugging",
      "deployment",
    ]);
    expect(result.analysis?.phaseCoverage.missing).toEqual([]);
    expect(result.analysis?.phaseCoverage.byPhase.debugging).toEqual(["debugger"]);
  });

  it("scores security 4: the criteria producer cannot reach the builder", () => {
    const security = result.analysis?.security;
    if (security === undefined) throw new Error("expected an analysis");
    expect(security.level).toBe(4);
    expect(security.raw).toBe(4);
    expect(security.findings).toEqual([]);
    // Clean on the marker, and one warning about the debug loop — which costs nothing and
    // is not a finding. Asserted by code so "clean" can never be restated as "silent".
    expect(security.diagnostics.map((d) => d.code)).toEqual([
      "analysis/criteria-relayed-through-judge",
    ]);

    // The fact the score rests on, asserted directly so a topology change cannot make the
    // clean result true for the wrong reason.
    const graph = bp(result).graph;
    expect(graph.descendants("planner").has("builder")).toBe(false);
  });

  it("does not read the debug loop as unbounded: doc 2 §5.5's cap is declared", () => {
    expect(bp(result).graph.cycles()).toEqual([["tester", "debugger"]]);
    expect(result.analysis?.security.penalties).toEqual([]);
  });

  it("is fully autonomous, which is a description of this graph and not a grade", () => {
    expect(result.analysis?.autonomy.level).toBe(4);
    expect(result.analysis?.autonomy.rationale).toBe(
      "5 of 5 nodes run unattended, none have a person in the loop. The graph declares 1 control point, which is one reading rather than a share. 1.00 > 0.90 → level 4 (Closed-loop).",
    );
    /* The starter has one node that decides anything — the checker — and one observation
       is not a share, so the band is the headcount's and the sentence says why. A graph
       where every node runs alone reads 1.00 on both halves anyway; the floor is what stops
       a single staffed decision elsewhere from speaking for a whole graph. */
    expect(result.analysis?.autonomy.control.counted).toBe(false);
    expect(result.analysis?.autonomy.fraction).toBe(
      result.analysis?.autonomy.staffingFraction,
    );
  });
});

describe("loadBundle — the same starter with the criteria edge added", () => {
  const clean = loadBundle(starterBundle());
  const leaking = loadBundle(leakingStarterBundle());

  it("still resolves cleanly — the difference is the score, not the upload", () => {
    // The same single warning the clean starter carries, and no error: doc 2 §5.4's switch
    // moves the score, never the validity of the upload.
    expect(leaking.diagnostics.map((d) => d.code)).toEqual([
      "analysis/criteria-relayed-through-judge",
    ]);
    expect(summarize(leaking.diagnostics).error).toBe(0);
    expect(leaking.blueprint?.nodes).toHaveLength(5);
    // One edge more, and nothing else about the topology moved.
    expect(leaking.blueprint?.edges).toHaveLength(
      (clean.blueprint?.edges.length ?? 0) + 1,
    );
    expect(leaking.blueprint?.graph.ids).toEqual(clean.blueprint?.graph.ids);
  });

  it("fires criteria-leak at weight 2.0 and names the builder (doc 3 §4.1, doc 2 §5.4)", () => {
    const security = leaking.analysis?.security;
    if (security === undefined) throw new Error("expected an analysis");

    expect(security.penalties).toHaveLength(1);
    expect(security.penalties[0]).toMatchObject({
      marker: "criteria-leak",
      weight: 2,
      nodeIds: ["builder"],
    });
    expect(security.findings).toHaveLength(1);
    expect(security.findings[0]).toMatchObject({
      marker: "criteria-leak",
      nodeId: "builder",
      // Nobody wrote the marker on a card: the graph established it. Doc 3 §4.1.
      establishedBy: "inferred",
    });
    expect(security.findings[0].explanation).toBe(
      'Node "Builder" (builder) hands its output to the validation node "tester" and is reachable from "planner", which produces an `acceptance-criteria` output, so the criteria can reach the node whose work they judge.',
    );
    expect(security.findings[0].hint).toContain("must never see the acceptance tests");
  });

  it("takes the score from 4 to 2, and that is the whole delta", () => {
    expect(clean.analysis?.security.level).toBe(4);
    expect(leaking.analysis?.security.level).toBe(2);
    expect(leaking.analysis?.security.raw).toBe(2);
    expect(leaking.analysis?.security.rationale).toBe("4 − 2.00 (criteria-leak) → 2");
    // Doc 2 §5.4's switch moves security and nothing else: the same five nodes still run
    // unattended and still cover the same five phases.
    expect(leaking.analysis?.autonomy).toEqual(clean.analysis?.autonomy);
    expect(leaking.analysis?.phaseCoverage).toEqual(clean.analysis?.phaseCoverage);
  });

  it("does not also fire the content detector: the two specs do not overlap", () => {
    // The topological detector found this one. The similarity check is independent and
    // stays quiet here, so the marker above is provably the reachability rule's doing.
    expect(
      leaking.diagnostics.filter((d) => d.code === "analysis/criteria-leak-suspected"),
    ).toEqual([]);
  });
});

describe("the starter's other leak: the criteria pasted into the builder's prose", () => {
  /** Doc 1 §3.2 and doc 3 §4.1's ⚠️ note: an absent edge is not isolation on its own. */
  const pastedBundle = (): Bundle => {
    const bundle = starterBundle();
    const planner = bundle.cardFiles["cards/planner@1.0.0.yaml"];
    const plannerSpec = planner
      .split("\n")
      .filter((line) => line.startsWith("spec: "))[0]
      .slice("spec: ".length);
    return {
      ...bundle,
      cardFiles: {
        ...bundle.cardFiles,
        "cards/builder@1.0.0.yaml": bundle.cardFiles["cards/builder@1.0.0.yaml"].replace(
          /^spec: .*$/m,
          `spec: ${plannerSpec}`,
        ),
      },
    };
  };

  it("warns about the overlap even though no edge was added", () => {
    const result = loadBundle(pastedBundle());
    const suspected = result.diagnostics.filter(
      (d) => d.code === "analysis/criteria-leak-suspected",
    );
    expect(suspected).toHaveLength(1);
    expect(suspected[0].severity).toBe("warning");
    expect(suspected[0].location?.nodeId).toBe("builder");
    expect(suspected[0].message).toContain("3-gram similarity 1.00");
  });

  it("leaves the score alone by default — a fuzzy match does not cost 2.0 points", () => {
    const result = loadBundle(pastedBundle());
    expect(DARKPRINT_CONFIG.criteriaLeak.similarityFiresMarker).toBe(false);
    expect(result.analysis?.security.level).toBe(4);
    expect(result.analysis?.security.penalties).toEqual([]);
  });

  it("charges it when the deployment has turned that switch on", () => {
    const firing: DarkprintConfig = {
      ...DARKPRINT_CONFIG,
      criteriaLeak: { ...DARKPRINT_CONFIG.criteriaLeak, similarityFiresMarker: true },
    };
    const result = loadBundle(pastedBundle(), { config: firing });
    expect(result.analysis?.security.penalties.map((p) => p.marker)).toEqual(["criteria-leak"]);
    expect(result.analysis?.security.level).toBe(2);
    expect(result.analysis?.security.findings[0].nodeId).toBe("builder");
  });
});

/* ============================================================
   the facade's own behaviour
   ============================================================ */

describe("analyzeBlueprint", () => {
  it("merges both metrics' diagnostics without losing either sentence", () => {
    const empty = loadBundle({
      manifest: manifest({ slug: "empty", title: "Empty" }),
      dot: "digraph empty {}",
      cardFiles: {},
    });
    const analysis = empty.analysis;
    if (analysis === undefined) throw new Error("an empty graph still resolves");

    expect(analysis.autonomy.level).toBe(1);
    expect(analysis.autonomy.totalNodes).toBe(0);
    // Nothing to subtract from is arithmetically a 4; the diagnostic is what stops it
    // being read as a clean bill of health.
    expect(analysis.security.level).toBe(4);

    expect(analysis.diagnostics.map((d) => d.code)).toEqual([
      "analysis/empty-graph",
      "analysis/empty-graph",
    ]);
    const messages = analysis.diagnostics.map((d) => d.message);
    expect(new Set(messages).size).toBe(2);
    expect(empty.diagnostics).toEqual(analysis.diagnostics);
  });

  it("reports an empty graph as covering no phase, rather than as five gaps", () => {
    const empty = loadBundle({
      manifest: manifest({ slug: "empty", title: "Empty" }),
      dot: "digraph empty {}",
      cardFiles: {},
    });
    expect(empty.analysis?.phaseCoverage.covered).toEqual([]);
    // `missing` names the five, and carries no count and no sentence: doc 2 §1.1.
    expect(empty.analysis?.phaseCoverage.missing).toHaveLength(5);
  });

  it("is the same as calling both metrics by hand", () => {
    const loaded = loadBundle(consensusBundle());
    const blueprint = loaded.blueprint;
    if (blueprint === undefined) throw new Error("expected the bundle to resolve");
    expect(analyzeBlueprint(blueprint)).toEqual(loaded.analysis);
  });

  it("threads a custom config through to both metrics", () => {
    const strict: DarkprintConfig = {
      ...DARKPRINT_CONFIG,
      // 0.75 no longer clears level 3, and arbitrary code execution costs half as much.
      autonomy: { ...DARKPRINT_CONFIG.autonomy, level4: 0.95, level3: 0.8, level2: 0.6 },
      security: {
        ...DARKPRINT_CONFIG.security,
        weights: { ...DARKPRINT_CONFIG.security.weights, "arbitrary-code-execution": 0.5 },
      },
    };
    const relaxed = loadBundle(consensusBundle(), { config: strict });
    /* The bands moved and so did the reading they are applied to: this blueprint's four
       control points run at 0.50, which is the weaker half and therefore the number the
       tuned bands see. 0.50 is below the tuned 0.60, so level 1 rather than the level 2
       the headcount's 0.75 would have given. */
    expect(relaxed.analysis?.autonomy.level).toBe(1);
    expect(relaxed.analysis?.autonomy.rationale).toContain("0.50 < 0.60 → level 1");
    expect(relaxed.analysis?.autonomy.staffingFraction).toBe(0.75);

    const rogue = loadBundle(rogueBundle(), { config: strict });
    const ace = rogue.analysis?.security.penalties.find(
      (p) => p.marker === "arbitrary-code-execution",
    );
    expect(ace?.weight).toBe(0.5);
  });
});

describe("loadBundle — inputs it must survive", () => {
  it("defaults the ontology to the shipped core vocabulary", () => {
    const plain = loadBundle(consensusBundle());
    /* The witness that the default view is the shipped core: every card in this bundle is
       written in core terms only, so it resolves without an error exactly when the core is
       what it was read against. */
    expect(summarize(plain.diagnostics).error).toBe(0);
    expect(plain.analysis?.autonomy.level).toBe(2);
    expect(summarize(plain.diagnostics).error).toBe(0);

    /* This cell used to drive the DEFAULT through a disagreement: the manifest declared
       `0.0.9`, `loadBundle` was left to default, and nine `bundle/ontology-mismatch` warnings
       came back — one for the manifest and one for each of the eight cards that then
       disagreed with it. Neither the manifest nor a card declares a vocabulary version now,
       so nothing can disagree with anything and the two diagnostics that reported it are
       gone. What the cell was actually about survives above: with no `ontology` option the
       bundle is read against the shipped core. The local-extensions cell below drives the
       other half, that a SUPPLIED view wins over the shipped one — the same card is rejected
       without it and accepted with it. */
    expect(
      loadBundle(consensusBundle()).diagnostics.filter(
        (d) => d.code === "bundle/ontology-mismatch",
      ),
      "the shipped core cannot shadow one of its own ids, which is the only thing left that " +
        "raises this code",
    ).toEqual([]);
  });

  it("accepts an ontology view with local extensions layered on (doc 3 §7)", () => {
    const local: OntologyTerm = {
      id: "berti/patch-script",
      kind: "node-type",
      label: "Patch script",
      description: "A locally defined step that rewrites a script before it is run.",
      broader: "agent",
      since: TERM_SINCE,
    };
    const bundle = rogueBundle();
    const withLocalType: Bundle = {
      ...bundle,
      cardFiles: {
        ...bundle.cardFiles,
        "cards/refine-script@1.0.0.yaml": bundle.cardFiles[
          "cards/refine-script@1.0.0.yaml"
        ].replace("type: agent", "type: berti/patch-script"),
      },
    };

    // Without the extension the term does not exist, so the card is rejected outright.
    const unknown = loadBundle(withLocalType);
    expect(unknown.diagnostics.some((d) => d.code === "card/unknown-term")).toBe(true);

    // With it, the card loads and the graph scores exactly as it did before: a local type
    // rooted at `agent` says nothing about people or risk, which is the point of doc 3 §7.
    const known = loadBundle(withLocalType, {
      ontology: ontologyView(CORE_ONTOLOGY, [local]),
    });
    expect(summarize(known.diagnostics).error).toBe(0);
    expect(known.analysis?.security.level).toBe(1);
    expect(known.analysis?.autonomy.level).toBe(4);
  });

  it("withholds the blueprint when the DOT does not parse, and says where", () => {
    const broken = loadBundle(consensusBundle({ dot: "digraph broken { a -> " }));
    expect(broken.blueprint).toBeUndefined();
    expect(broken.analysis).toBeUndefined();
    const parseErrors = broken.diagnostics.filter((d) => d.code === "dot/parse-error");
    expect(parseErrors.length).toBeGreaterThan(0);
    expect(parseErrors[0].location?.file).toBe("topology.dot");
    expect(parseErrors[0].location?.line).toBeGreaterThan(0);
  });

  it("withholds the blueprint for an undirected graph rather than guessing a direction", () => {
    const undirected = loadBundle(
      consensusBundle({ dot: "graph g {\n  a -- b;\n}" }),
    );
    expect(undirected.blueprint).toBeUndefined();
    expect(undirected.diagnostics.some((d) => d.code === "dot/not-directed")).toBe(true);
  });

  it("warns about a DOT Attractor could not run, without refusing to score it", () => {
    // Doc 1 §0.1.1: `attractor/*` is a separate namespace at warning severity, so an
    // author can tell "DarkPrint cannot read this" from "Attractor will not run this".
    const kebab = loadBundle(
      consensusBundle({
        dot: CONSENSUS_DOT.replace("solver_a ", '"solver-a" ').replace(
          /solver_a/g,
          '"solver-a"',
        ),
      }),
    );
    const attractor = kebab.diagnostics.filter((d) => d.code.startsWith("attractor/"));
    expect(attractor.length).toBeGreaterThan(0);
    expect(attractor.every((d) => d.severity === "warning")).toBe(true);
    expect(kebab.analysis).toBeDefined();
  });

  it("still scores what it can when a card is missing", () => {
    const bundle = consensusBundle();
    const cardFiles: Record<string, string> = { ...bundle.cardFiles };
    delete cardFiles["cards/solver-b@1.2.0.yaml"];
    const partial = loadBundle({ ...bundle, cardFiles });

    expect(partial.diagnostics.some((d) => d.code === "bundle/missing-card")).toBe(true);
    // Topology outlives the missing card: the node stays in the graph, out of `nodes`.
    expect(partial.blueprint?.graph.ids).toHaveLength(8);
    expect(partial.blueprint?.nodes).toHaveLength(7);
    // …and it stays in the denominator: doc 3 §6 scores nodi totali, so a node nobody can
    // read cannot be quietly excused from the count.
    expect(partial.analysis?.autonomy.totalNodes).toBe(8);
    expect(partial.analysis?.autonomy.autonomousNodes).toBe(5);
    expect(partial.analysis?.autonomy.staffingFraction).toBe(0.625);
    /* The band reads the weaker half, which here is the second: four control points, two
       of them staffed. The missing node is not one of them and could not be — a node with
       no card has no type, so nothing says it decides anything, which is the one place the
       two readings treat an unresolved node differently. The headcount keeps it in its
       denominator (doc 3 §6's nodi totali) and this reading has nothing to put it in. */
    expect(partial.analysis?.autonomy.control.totalNodes).toBe(4);
    expect(partial.analysis?.autonomy.control.unattendedNodes).toBe(2);
    expect(partial.analysis?.autonomy.fraction).toBe(0.5);
    expect(partial.analysis?.autonomy.level).toBe(2);
    expect(
      partial.analysis?.autonomy.contributions.filter((c) => c.ref === ""),
    ).toHaveLength(1);
    // It joins no phase group either — there is no card to read a phase off.
    expect(partial.analysis?.phaseCoverage.byPhase.implementation).toEqual(["solver_a"]);
  });

  it("reports an empty upload instead of throwing", () => {
    const empty: Bundle = {
      manifest: manifest({ slug: "nothing", title: "Nothing" }),
      dot: "",
      cardFiles: {},
    };
    expect(() => loadBundle(empty)).not.toThrow();
    const nothing = loadBundle(empty);
    expect(nothing.blueprint).toBeUndefined();
    expect(nothing.diagnostics.map((d) => d.code)).toContain("dot/parse-error");
  });

  it("reports a card file that is not a card, and drops only that node", () => {
    const bundle = consensusBundle();
    const garbled = loadBundle({
      ...bundle,
      cardFiles: {
        ...bundle.cardFiles,
        "cards/solver-b@1.2.0.yaml": "id: solver-b\nname: [unclosed\n",
      },
    });
    const parseErrors = garbled.diagnostics.filter((d) => d.code === "card/parse-error");
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0].location?.file).toBe("cards/solver-b@1.2.0.yaml");
    expect(garbled.blueprint?.nodes).toHaveLength(7);
    // The other seven cards are unaffected: one bad file does not void the upload.
    expect(garbled.analysis?.security.level).toBe(4);
  });

  it("accepts a card with no phase, silently, and still analyses the bundle", () => {
    // Rewritten to the author's ruling, which supersedes doc 3 §1's cardinality row: the
    // five phases describe the factory, not every node in it, so a card that declares none
    // is complete. This used to assert `card/missing-phase`, which no longer exists.
    const bundle = consensusBundle();
    const noPhase = loadBundle({
      ...bundle,
      cardFiles: {
        ...bundle.cardFiles,
        "cards/solver-b@1.2.0.yaml": bundle.cardFiles["cards/solver-b@1.2.0.yaml"].replace(
          "phase: implementation\n",
          "",
        ),
      },
    });
    expect(noPhase.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(noPhase.blueprint).toBeDefined();
    // It drops out of the coverage it used to hold up, and appears in `unphased` instead —
    // a description of where it sits, never a gap.
    expect(noPhase.blueprint?.phaseCoverage.unphased).toEqual(["solver_b"]);
    expect(noPhase.analysis).toBeDefined();
  });
});

/* ============================================================
   a guarded edge is a real edge
   `ResolvedEdge.condition` carries Attractor's §10 guard, and the
   rule written on that field is that a conditional edge counts
   exactly as much as an unconditional one in every risk analysis.
   A leak that can happen is a leak.

   The suite below is what makes the rule fail loudly instead of
   quietly. It takes each of the three fixtures, writes
   `condition="false", weight=0` onto EVERY edge — the cheapest
   thing an author could do to claim a path is never taken — and
   holds the whole scored analysis to what the unguarded bundle
   produced, byte for byte: the same security level, the same
   findings, the same autonomy, the same diagnostics.

   Reading a guard as "maybe not taken" would look like an
   improvement and would lower Security across the entire archive,
   by exactly the amount somebody gains by writing that attribute
   on the edge that leaks. It fails here first.
   ============================================================ */

/**
 * Written onto every edge: the guard that claims the branch never runs.
 *
 * `condition="false"` until 2026-09-04, and the replacement is the same claim spelled in a
 * grammar that exists. Engine spec §10.2 is `Clause ::= Key Operator Literal` with `Key`
 * one of `outcome`, `preferred_label` or `context.` Path, so a bare `false` is not an
 * expression at all, and `attractor/condition-syntax` now says so. That report is correct
 * and it was landing on the guarded half of every pair below, which is what reddened the
 * diagnostics cell while the scoring cell stayed green.
 *
 * `context.never=1` is still provably never true, which is the whole point of this fixture:
 * §10.3 says a missing key compares as an empty string and is "never equal to non-empty
 * values". So the claim under test is unweakened — an edge that CANNOT fire still counts
 * for everything an unconditional one counts for — and it is now made with a guard a runner
 * would actually accept, which makes the pair differ in the one property being measured
 * rather than in two.
 */
const NEVER = 'condition="context.never=1", weight=0';

/**
 * Add `NEVER` to every edge statement of a DOT source, into the existing attribute list
 * where there is one and in a new one where there is not.
 *
 * Deliberately not clever: the fixtures in this file write one edge per line and no
 * chained `a -> b -> c`, so a line-wise rewrite is total for them and obviously so. Each
 * cell below checks the transform actually fired before checking anything else — a regex
 * that matched nothing would make every assertion here pass against an unguarded bundle
 * compared to itself.
 */
function guardEveryEdge(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      if (!line.includes("->")) return line;
      const withAttrs = /^(.*\[)([^\]]*)(\];\s*)$/.exec(line);
      if (withAttrs !== null) return `${withAttrs[1]}${withAttrs[2]}, ${NEVER}${withAttrs[3]}`;
      const bare = /^(\s*\S+\s*->\s*\S+?)\s*;(\s*)$/.exec(line);
      if (bare !== null) return `${bare[1]} [${NEVER}];${bare[2]}`;
      return line;
    })
    .join("\n");
}

describe("a guarded edge counts exactly as much as an unconditional one", () => {
  const cases: { name: string; bundle: Bundle }[] = [
    { name: "adversarial consensus", bundle: consensusBundle() },
    { name: "rogue scraper", bundle: rogueBundle() },
    { name: "the starter with the criteria edge added", bundle: leakingStarterBundle() },
  ];

  for (const { name, bundle } of cases) {
    describe(name, () => {
      const plain = loadBundle(bundle);
      const guarded = loadBundle({ ...bundle, dot: guardEveryEdge(bundle.dot) });

      it("guards every edge, so the comparison below is not a bundle against itself", () => {
        const edges = bp(guarded).edges;
        expect(edges.length).toBe(bp(plain).edges.length);
        expect(edges.length).toBeGreaterThan(0);
        for (const edge of edges) {
          expect(edge.condition, `${edge.source} -> ${edge.target}`).toBe("context.never=1");
          expect(edge.weight, `${edge.source} -> ${edge.target}`).toBe("0");
        }
        expect(bp(plain).edges.every((e) => e.condition === undefined)).toBe(true);
      });

      it("scores identically", () => {
        expect(guarded.analysis).toEqual(plain.analysis);
      });

      it("reports the same diagnostics, in the same places", () => {
        expect(guarded.diagnostics).toEqual(plain.diagnostics);
      });

      it("keeps the same topology, so the reachability every metric walks is unchanged", () => {
        const g = bp(guarded).graph;
        const p = bp(plain).graph;
        expect(g.ids).toEqual(p.ids);
        for (const id of p.ids) {
          expect(g.successors(id), id).toEqual(p.successors(id));
          expect(g.descendants(id), id).toEqual(p.descendants(id));
        }
      });
    });
  }
});

/** Narrow a result's blueprint once, for assertions that only need the graph. */
function bp(result: ReturnType<typeof loadBundle>) {
  const blueprint = result.blueprint;
  if (blueprint === undefined) throw new Error("expected the bundle to resolve");
  return blueprint;
}
