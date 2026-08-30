/* ============================================================
   The workspace — card content, one set per output type
   Doc 2 §5.2 fixes the five nodes and §5.3 fixes what the first
   choice may move: "Non muove metriche, non cambia la topologia,
   cambia il contenuto delle card." So everything that varies with
   the output type lives here, as data, and nothing that varies
   with it touches the graph.

   What this module is careful about, in the order it matters:

   1. **Isolation, both halves.** Doc 1 §3.2: an absent edge with
      the criteria written into the prose is a false isolation. The
      builder's `spec` never names a criterion, never quotes a
      threshold and never paraphrases the planner. That is checked,
      not asserted: `variants.test.ts` measures the 3-gram Jaccard
      similarity between the two specs against
      `DARKPRINT_CONFIG.criteriaLeak.similarityThreshold`.
   2. **Doc 2 §1.1.** The human gate's card says where a person
      acts and says the level records that. It does not apologise
      for the number and it does not congratulate the other choice.
   3. **Doc 2 §2.5.** No "not X, but Y", no em-dash as a pause, no
      three-item list where two carry the information.

   The wire model here is deliberately the *document* shape
   (`phase`, `risk_markers`) rather than the engine's `NodeCard`: this module describes files, and
   `variants.ts` writes them out. `variants.test.ts` closes the
   loop by parsing every emitted file back through the engine's own
   `loadCard` and comparing it with the model below, so a bug in
   the writer cannot hide behind a passing bundle.
   ============================================================ */

import type { JsonValue } from "@/lib/core";

/* --------------------- the choices, as vocabularies --------------------- */

/** Doc 2 §5.3, choice 1. Four options, in the order the tutorial offers them. */
export const STARTER_OUTPUTS = ["python", "react", "data", "docs"] as const;
export type StarterOutput = (typeof STARTER_OUTPUTS)[number];

/** Doc 2 §5.3, choice 2. Who decides the work is finished. */
export const STARTER_APPROVALS = ["tester", "human"] as const;
export type StarterApproval = (typeof STARTER_APPROVALS)[number];

/** Doc 2 §5.3, choice 3 — the slider's range. */
export const MIN_ITERATIONS = 1;
export const MAX_ITERATIONS = 10;

/**
 * The slider value, made safe.
 *
 * Doc 2 §5.3: "Ogni combinazione di scelte deve produrre una fabbrica funzionante". A
 * caller that hands this module 0, 40 or 2.5 gets a working factory at the nearest legal
 * cap rather than an artefact nobody can run, and the clamp is deterministic so the same
 * input always produces the same bundle. A non-finite value falls back to the tutorial's
 * own default of 3, which is what the reference starter declares.
 */
export function clampIterations(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ITERATIONS;
  return Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, Math.round(value)));
}

/** What `content/blueprints/starter-software-factory/` pins today. */
export const DEFAULT_ITERATIONS = 3;

/* --------------------- the document model --------------------- */

/** One declared port, in the shape the card document writes it. */
export interface StarterPort {
  name: string;
  /** `data-type` term id. */
  type: string;
  description: string;
  /** Written only when false; the engine defaults an input to required. */
  required?: boolean;
}

/** One card document, field for field, in the order it is written out. */
export interface StarterCardSpec {
  id: string;
  name: string;
  /** `node-type` term id. */
  type: string;
  /** One of doc 3 §2's five phases. */
  phase: string;
  action: string;
  spec: string;
  agent?: string;
  /** `tool` term ids. */
  tools: readonly string[];
  /** Installed MCP server names. Free text, and `[]` on a node that reaches nothing. */
  mcp: readonly string[];
  /**
   * Path to the document defining this node's behaviour. Absent on the approval gate,
   * where a person decides and no document defines them.
   */
  skill?: string;
  params?: Readonly<Record<string, JsonValue>>;
  inputs: readonly StarterPort[];
  outputs: readonly StarterPort[];
  dependencies: readonly string[];
  /**
   * `data-type` term ids the node must never receive. The resolver holds every incoming
   * edge to each one. `[]` on most of these cards, and that is an answer.
   */
  cannot: readonly string[];
  /**
   * What the node undertakes never to do, in sentences. Nothing checks these, which is
   * the reason they are not in `cannot` beside the term ids.
   */
  willNot: readonly string[];
  riskMarkers: readonly string[];
  notes: string;
  version: string;
  provenance: string;
}

/** One DOT node and the card it pins. */
export interface StarterNode {
  /** The DOT node id — the instance. Doc 2 §5.2's five names, plus `approver`. */
  nodeId: string;
  card: StarterCardSpec;
}

/** What a caller has to have decided before a card can be written. */
export interface StarterCardInput {
  output: StarterOutput;
  approval: StarterApproval;
  /** Already clamped by `clampIterations`, or clamped here if not. */
  maxIterations: number;
}

/* --------------------- the four output types --------------------- */

/**
 * Everything about an output type that the cards read.
 *
 * The port *types* are here because they are the one structural thing the output type is
 * allowed to move: a documentation factory carries `markdown` where a code factory
 * carries `code`, and the edges pair up either way. The node set and the edge set are
 * identical across all four, which is what doc 2 §5.3's "non cambia la topologia" means.
 */
export interface StarterProfile {
  output: StarterOutput;
  /** Card-id prefix and the stem of the blueprint slug. */
  slug: string;
  /** Human name of the thing the factory builds, with an article. */
  subject: string;
  /** The same thing, definite, for mid-sentence use. */
  theSubject: string;
  /** Title case, for the blueprint title. */
  title: string;
  category: string;
  /** `data-type` of what the builder emits and the tester reads. */
  buildType: string;
  /** `data-type` of what the tester releases and the deployer writes. */
  releaseType: string;
  /**
   * What the factory does, as the predicate of a sentence whose subject is the node count.
   * `manifestFor` writes that subject, because the count differs between the two approval
   * modes and a summary that names its own figure would contradict the node table three
   * lines below it in the README.
   */
  summaryTail: string;
  description: string;
  tools: {
    builder: readonly string[];
    tester: readonly string[];
    debugger: readonly string[];
    deployer: readonly string[];
  };
  /** Who the approver is, when there is one. Written into `params.approver_scope`. */
  approverScope: string;
  /** Per-role prose. One entry per role, written out by hand for each output type. */
  plannerCriteria: string;
  plannerStep: string;
  builderSpec: string;
  testerSpec: string;
  debuggerEvidence: string;
}

const PYTHON: StarterProfile = {
  output: "python",
  slug: "python-script",
  subject: "a Python script",
  theSubject: "the script",
  title: "Python Script Factory",
  category: "Software",
  buildType: "code",
  releaseType: "artifact",
  summaryTail:
    "turns a written request into a Python script, tests it against criteria the writer never sees, and releases what passes.",
  description:
    "Five nodes, one per phase: plan, build, test, debug, release. The planner writes the build brief and the acceptance criteria as two separate artefacts, and only the criteria reach the tester.\n\nThe edge that is missing is the one worth studying. Nothing carries the acceptance criteria to the builder, and the builder's spec does not restate them either, so the node that writes the code cannot write code aimed at the check.",
  tools: {
    builder: ["file-io"],
    tester: ["python-sandbox"],
    debugger: ["file-io"],
    deployer: ["file-io"],
  },
  approverScope: "release-owner",
  plannerStep: "the module or function it touches",
  plannerCriteria:
    "an input paired with the value the script must return, an exit code for a named failure, a ceiling on how long one call may take",
  builderSpec:
    "A build brief arrives with the run: an ordered list of steps, each naming the module or function it touches and what should exist once it is done. Work through the steps in order and write the Python they describe, staying inside the files each step names and adding no behaviour nobody asked for. Emit the finished source on `build` as one complete, importable module, with no commentary and no summary of what you did. The brief is all you get, and that is deliberate. Do not go looking for a test suite, and do not shape anything around a check you imagine exists.",
  testerSpec:
    "You are handed a set of criteria and a script. Run each criterion against that script in turn, one at a time and in a fresh interpreter, and record whether it held. When every one of them holds, emit the script unchanged on `approved` and emit nothing on `evidence`. When any of them does not, emit on `evidence` only what the run itself produced: the assertion that failed, the traceback underneath it, and the expected value beside the value actually obtained. Nothing else belongs on that port. Do not quote the criterion and do not say how many are still outstanding. A criterion you were unable to evaluate has not held.",
  debuggerEvidence:
    "the assertions that did not hold, the tracebacks underneath them, and the expected value beside the one actually obtained",
};

const REACT: StarterProfile = {
  output: "react",
  slug: "react-component",
  subject: "a React component",
  theSubject: "the component",
  title: "React Component Factory",
  category: "Software",
  buildType: "code",
  releaseType: "artifact",
  summaryTail:
    "turns a written request into a React component, tests it against criteria the writer never sees, and releases what passes.",
  description:
    "Five nodes, one per phase: plan, build, test, debug, release. The planner writes the build brief and the acceptance criteria as two separate artefacts, and only the criteria reach the tester.\n\nThe edge that is missing is the one worth studying. Nothing carries the acceptance criteria to the builder, and the builder's spec does not restate them either, so the node that writes the markup cannot write markup aimed at the query that will look for it.",
  tools: {
    builder: ["file-io"],
    tester: ["shell"],
    debugger: ["file-io"],
    deployer: ["file-io"],
  },
  approverScope: "design-owner",
  plannerStep: "the file it touches",
  plannerCriteria:
    "a set of props paired with what has to be on screen, an interaction paired with the state it leaves behind, an accessible name or role a query has to find",
  builderSpec:
    "A build brief arrives with the run: an ordered list of steps, each naming the file it touches and what should exist once it is done. Work through the steps in order and write the component they describe, staying inside the files each step names and adding no behaviour nobody asked for. Emit the finished source on `build` as one complete, compiling change: the component, its props type, and whatever it imports from inside the repository. Send no commentary with it. The brief is all you get, and that is deliberate. Do not go looking for a test file, and do not add a label or a test id to the markup on the chance that something will query it.",
  testerSpec:
    "You are handed a set of criteria and a component. Render the component for each criterion in turn, drive it the way the criterion describes, and record whether it held. When every one of them holds, emit the source unchanged on `approved` and emit nothing on `evidence`. When any of them does not, emit on `evidence` only what the run itself produced: the assertion that failed, the stack trace underneath it, and the rendered output beside the one the criterion expected. Nothing else belongs on that port. Do not quote the criterion and do not say how many are still outstanding. A criterion you were unable to evaluate has not held.",
  debuggerEvidence:
    "the assertions that did not hold, the stack traces underneath them, and the rendered output beside the one that was expected",
};

const DATA: StarterProfile = {
  output: "data",
  slug: "data-transform",
  subject: "a data transformation",
  theSubject: "the transformation",
  title: "Data Transformation Factory",
  category: "Data",
  buildType: "code",
  releaseType: "artifact",
  summaryTail:
    "turns a written request into a data transformation, tests it against criteria the writer never sees, and releases what passes.",
  description:
    "Five nodes, one per phase: plan, build, test, debug, release. The planner writes the build brief and the acceptance criteria as two separate artefacts, and only the criteria reach the tester.\n\nThe edge that is missing is the one worth studying. Nothing carries the acceptance criteria to the builder, and the builder's spec does not restate them either, so the node that writes the transformation cannot special-case the rows it will be measured on.",
  tools: {
    builder: ["file-io"],
    tester: ["python-sandbox"],
    debugger: ["file-io"],
    deployer: ["file-io"],
  },
  approverScope: "data-owner",
  plannerStep: "the field or the table it touches",
  plannerCriteria:
    "a fixture input paired with the rows that must come out, a column paired with the type and the null rate it has to hold to, a count that has to survive end to end",
  builderSpec:
    "A build brief arrives with the run: an ordered list of steps, each naming the field or the table it touches and what should exist once it is done. Work through the steps in order and write the transformation they describe, staying inside the steps each one names and adding no column nobody asked for. Emit the finished source on `build` as one complete, runnable transformation that reads its input and writes its output, with no commentary attached. The brief is all you get, and that is deliberate. Do not go looking for the fixtures, and do not branch on a value you imagine somebody will feed it.",
  testerSpec:
    "You are handed a set of criteria and a transformation. Run the transformation over the recorded fixtures once, then evaluate each criterion against what came out, one at a time, and record whether it held. When every one of them holds, emit the transformation unchanged on `approved` and emit nothing on `evidence`. When any of them does not, emit on `evidence` only what the run itself produced: the assertion that failed, the stack trace underneath it, and the rows obtained beside the rows the criterion expected. Nothing else belongs on that port. Do not quote the criterion and do not say how many are still outstanding. A criterion you were unable to evaluate has not held.",
  debuggerEvidence:
    "the assertions that did not hold, the stack traces underneath them, and the rows obtained beside the rows that were expected",
};

const DOCS: StarterProfile = {
  output: "docs",
  slug: "docs-page",
  subject: "a documentation page",
  theSubject: "the page",
  title: "Documentation Factory",
  category: "Documentation",
  buildType: "markdown",
  releaseType: "markdown",
  summaryTail:
    "turns a written request into a documentation page, tests every example on it against criteria the writer never sees, and releases what passes.",
  description:
    "Five nodes, one per phase: plan, build, test, debug, release. The planner writes the build brief and the acceptance criteria as two separate artefacts, and only the criteria reach the tester.\n\nThe edge that is missing is the one worth studying. Nothing carries the acceptance criteria to the builder, and the builder's spec does not restate them either, so the node that writes the page cannot write an example around the output it knows will be checked.",
  tools: {
    builder: ["file-io"],
    tester: ["shell"],
    debugger: ["file-io"],
    deployer: ["file-io"],
  },
  approverScope: "docs-owner",
  plannerStep: "the section it touches",
  plannerCriteria:
    "a command shown on the page paired with the output it has to print, a link that has to resolve inside the repository, a heading that has to carry a worked example under it",
  builderSpec:
    "A build brief arrives with the run: an ordered list of steps, each naming the section it touches and what should exist once it is done. Work through the steps in order and write the page they describe, staying inside the sections each step names and adding nothing nobody asked for. Emit the finished page on `build` as one complete Markdown document, with every command and every code block written out the way a reader would type it. Send no commentary with it. The brief is all you get, and that is deliberate. Do not go looking for the checks, and do not write an example around an output you have not run.",
  testerSpec:
    "You are handed a set of criteria and a page. Take each command and each code block off the page, run it in a clean working copy, and evaluate the criteria against what it printed, one at a time. When every one of them holds, emit the page unchanged on `approved` and emit nothing on `evidence`. When any of them does not, emit on `evidence` only what the run itself produced: the command as it appeared on the page, its exit status, and the output obtained beside the output the page promised. Nothing else belongs on that port. Do not quote the criterion and do not say how many are still outstanding. A criterion you were unable to evaluate has not held.",
  debuggerEvidence:
    "the commands that did not behave as the page said, their exit status, and the output obtained beside the output the page promised",
};

/** The four output types, keyed. */
export const STARTER_PROFILES: Readonly<Record<StarterOutput, StarterProfile>> = Object.freeze({
  python: PYTHON,
  react: REACT,
  data: DATA,
  docs: DOCS,
});

/* --------------------- shared card constants --------------------- */

/* There is no `ONTOLOGY_VERSION` here. Every starter card used to carry one, naming the
   vocabulary it was written against, and the wizard emitted it into each YAML file. A card
   declares no vocabulary version any more: there is one, every card is read against it, and
   a score records the version it was computed under on the score itself. */

/**
 * Doc 2 §6 does not exist yet: there are no accounts, so there is no author to record.
 * `provenance` says where the file came from, which is true today and stays true after
 * accounts arrive.
 */
const PROVENANCE = "Generated by the DarkPrint workspace";

/** Every card in a set is at 1.0.0, except the debugger — see `debuggerVersion`. */
const BASE_VERSION = "1.0.0";

/**
 * Where the document defining a node's behaviour lives, keyed off the card id so the two
 * cannot drift apart.
 *
 * Doc 2 §3 puts a skill one level below the graph: a skill hands one agent a capability,
 * and the blueprint decides who is wired to whom. Every node here carries one except the
 * approval gate, where a person decides and no document defines them.
 */
function skillPath(id: string): string {
  return `skills/${id}.md`;
}

/**
 * The prohibition the whole starter is built around, and the one entry on these cards the
 * engine reads rather than displays.
 *
 * `acceptance-criteria` is a `data-type` in the vocabulary, so `bundle/resolve.ts` holds
 * the graph to it: an incoming edge able to carry the criteria raises
 * `bundle/prohibition-violated`. Doc 2 §5.4's switch draws exactly that edge into the
 * builder, so the demonstration now costs an error as well as the security level, and the
 * absent edge stops being a convention the author remembered.
 */
const NO_CRITERIA = "acceptance-criteria";

/**
 * The debugger's version carries the iteration cap.
 *
 * The cap is written into `params.max_iterations` and into the sentence of the `spec` that
 * tells the agent when to stop, so two runs of the workspace with different slider
 * positions produce two different documents. Doc 1 §4 makes the ref the key to the
 * content: shipping both under `…-debugger@1.0.0` would put two contents behind one pin,
 * which is the failure the version exists to prevent.
 *
 * MINOR, not PATCH. A changed `params` value on its own is a patch, but the cap also moves
 * the `spec`, and the engine's own `inferBump` calls a changed `spec` a minor bump: "the
 * instruction handed to the agent is different, behaviour moved and the interface did not".
 * `variants.test.ts` asks `inferBump` rather than trusting this comment, so the scheme
 * follows the engine if that classification ever changes.
 */
function debuggerVersion(maxIterations: number): string {
  return `1.${maxIterations}.0`;
}

/* --------------------- the cards --------------------- */

function planner(p: StarterProfile): StarterCardSpec {
  const id = `${p.slug}-planner`;
  return {
    id,
    name: `${p.title} Planner`,
    type: "agent",
    phase: "planning",
    action: `Turn the incoming request into two separate artefacts: an ordered build brief for ${p.subject}, and the acceptance criteria the finished work will be judged against.`,
    spec: `Read the feature request you are handed and turn it into two artefacts, written independently of one another. On \`plan\`, set out the ordered steps someone would follow to build ${p.theSubject}, naming for each step ${p.plannerStep} and what exists once it is done. On \`criteria\`, set out the conditions the finished work has to satisfy, one per line, each phrased so a machine can decide it: ${p.plannerCriteria}. Keep the two apart. A step is not a criterion, and a criterion that restates a step tests nothing. Write no code yourself, and never soften a criterion to make it easier to meet.`,
    agent: "Planner",
    tools: [],
    // It reads a request and writes two artefacts. Nothing here reaches outside the run.
    mcp: [],
    skill: skillPath(id),
    inputs: [
      {
        name: "request",
        type: "text",
        description: "The feature request the run was started with, in the requester's own words.",
      },
    ],
    outputs: [
      {
        name: "plan",
        type: "plan",
        description: `The ordered build steps for ${p.theSubject}, each naming what it touches and what exists when it is done.`,
      },
      {
        name: "criteria",
        type: "acceptance-criteria",
        description: "The conditions the finished work has to satisfy, one per line, each machine-decidable.",
      },
    ],
    dependencies: [],
    cannot: [],
    willNot: ["write any of the code it plans", "weaken a criterion to make it easier to meet"],
    riskMarkers: [],
    notes: `The \`plan\` port is deliberately not wired to the builder in this blueprint, and the gap is the lesson rather than an oversight. Doc 3 §4.1 defines \`criteria-leak\` over a path from the criteria producer to the node whose artefact they judge, and the analyzer reads that path at node level, so any edge at all from this node into the builder establishes the marker whichever port it carries. The builder is handed its brief when the graph is instantiated, and nothing leaves this node except the criteria, which go to the tester. The other end of that gap is written down too: the builder's card lists \`${NO_CRITERIA}\` under \`cannot\`, so an edge from here into it is refused by the resolver as well as charged by the analyzer.`,
    version: BASE_VERSION,
    provenance: PROVENANCE,
  };
}

function builder(p: StarterProfile): StarterCardSpec {
  const id = `${p.slug}-builder`;
  return {
    id,
    name: `${p.title} Builder`,
    type: "agent",
    phase: "implementation",
    action: `Work through the build brief and produce ${p.subject}, adding nothing the brief does not ask for.`,
    spec: p.builderSpec,
    agent: "Builder",
    tools: p.tools.builder,
    // The brief names the files each step touches, so this node has to open them. The
    // server is the concrete thing that reaches them; `file-io` is the capability.
    mcp: ["filesystem"],
    skill: skillPath(id),
    inputs: [
      {
        name: "brief",
        type: "plan",
        description: "The ordered build steps the run was instantiated with. This is the only thing this node sees.",
      },
    ],
    outputs: [
      {
        name: "build",
        type: p.buildType,
        description: `${capitalize(p.theSubject)} as this node produced it, with no commentary attached.`,
      },
    ],
    dependencies: [],
    cannot: [NO_CRITERIA],
    willNot: ["read the checks the work will be run against"],
    riskMarkers: [],
    notes: `Doc 1 §3.2 makes isolation a property of the prose as well as of the diagram. The spec above names no criterion, quotes no threshold and paraphrases nothing the planner wrote, so the similarity half of the \`criteria-leak\` check stays quiet on this card as well as the topological half. A card that keeps the arrow off the drawing and repeats the criteria in its prose is isolated on the diagram and leaking in practice. A third check sits under both of those. \`${NO_CRITERIA}\` names a data type in the vocabulary, so the entry under \`cannot\` is one the resolver enforces: an edge carrying the criteria into this node fails the bundle with \`bundle/prohibition-violated\`, whatever the prose says.`,
    version: BASE_VERSION,
    provenance: PROVENANCE,
  };
}

function tester(p: StarterProfile): StarterCardSpec {
  const id = `${p.slug}-tester`;
  return {
    id,
    name: `${p.title} Tester`,
    type: "validation",
    phase: "testing",
    action: `Run every criterion against the submitted work and split the outcome: ${p.theSubject} itself when all of them pass, the raw failure evidence when any of them does not.`,
    spec: p.testerSpec,
    agent: "Acceptance tester",
    tools: p.tools.tester,
    // It runs the criteria on the host that runs the graph. No server stands in for that.
    mcp: [],
    skill: skillPath(id),
    params: { stop_on_first_failure: false },
    inputs: [
      {
        name: "criteria",
        type: "acceptance-criteria",
        description: "The conditions the work is judged against, as the planner wrote them.",
      },
      {
        name: "build",
        type: p.buildType,
        description: "The submitted work: the builder's first pass, or the debugger's patched version.",
      },
    ],
    outputs: [
      {
        name: "evidence",
        type: "report",
        description: "Raw failure output only. Assertions, traces, obtained beside expected, and no criteria.",
      },
      {
        name: "approved",
        type: p.releaseType,
        description: "The work unchanged, emitted only once every criterion has held.",
      },
    ],
    dependencies: [`${p.slug}-planner`, `${p.slug}-builder`, `${p.slug}-debugger`],
    cannot: [],
    willNot: ["quote a criterion in the evidence it emits"],
    riskMarkers: [],
    notes: `This is the only node that sees both halves, and the shape of \`evidence\` is what keeps that safe. Doc 2 §5.5: seeing the criteria lets a node produce work built to pass them, seeing the evidence of a failure it caused says only what broke. The first is gaming and the second is feedback. Emitting the criterion text alongside the trace would collapse that distinction and hand the debugger the acceptance surface a line at a time.`,
    version: BASE_VERSION,
    provenance: PROVENANCE,
  };
}

function debugger_(p: StarterProfile, maxIterations: number): StarterCardSpec {
  const attempts = maxIterations === 1 ? "one attempt" : `${maxIterations} attempts`;
  const id = `${p.slug}-debugger`;
  return {
    id,
    name: `${p.title} Debugger`,
    type: "agent",
    phase: "debugging",
    action:
      "Turn one run's failure evidence into the narrowest patch that accounts for it, and stop when the attempt cap is spent or the evidence stops changing.",
    spec: `You are given the evidence from a run that failed: ${p.debuggerEvidence}. Find the smallest change to the existing source that accounts for those failures and emit it on \`patch\`, leaving every part of the work the evidence does not implicate exactly as it is. Do not special-case the literal values in the trace, because a change that satisfies only the example in front of you has fixed nothing and it comes straight back. Stop after ${attempts}. Stop earlier if two consecutive runs hand you the same evidence, which means you are circling and another pass costs a round without buying information. When the cap is spent, emit nothing on \`patch\` and end the run with the evidence you have gathered attached, so whoever filed the request can decide whether the plan was wrong.`,
    agent: "Debugger",
    tools: p.tools.debugger,
    // It patches source it did not write, so it has to open the same files the builder did.
    mcp: ["filesystem"],
    skill: skillPath(id),
    params: {
      max_iterations: maxIterations,
      stop_on_repeated_evidence: true,
      on_cap_exhausted: "stop-and-report",
    },
    inputs: [
      {
        name: "evidence",
        type: "report",
        description: "One run's failure output. Assertions, traces, obtained beside expected.",
      },
    ],
    outputs: [
      {
        name: "patch",
        type: p.buildType,
        description: "The narrowest change that accounts for the evidence, ready to be re-run.",
      },
    ],
    dependencies: [`${p.slug}-tester`],
    cannot: [NO_CRITERIA],
    willNot: ["special-case the literal values in a trace"],
    riskMarkers: [],
    notes: `\`max_iterations\` is the declared cap for the \`tester -> debugger -> tester\` cycle and it is load-bearing twice over. Drop it and doc 3 §4.1 charges the blueprint for an unbounded loop. It also bounds a slower leak doc 2 §5.5 names: every iteration reveals another slice of the acceptance surface through the failure messages, so the cap limits how much of the criteria this node can reconstruct by accumulation. The other two requirements of a healthy loop are written into the spec above rather than into the graph. \`stop_on_repeated_evidence\` is a progress criterion over the content of two consecutive runs, which a topology cannot express; \`on_cap_exhausted\` ends the run and hands the evidence back, and an escalation edge drawn to the planner would take the planner's incoming degree above zero and move the run's entry point onto the builder. The cap bounds how fast this node can rebuild the criteria out of failure messages; \`${NO_CRITERIA}\` under \`cannot\` closes the direct route, and the resolver enforces that entry because it names a data type in the vocabulary.`,
    version: debuggerVersion(maxIterations),
    provenance: PROVENANCE,
  };
}

function releaseGate(p: StarterProfile): StarterCardSpec {
  const id = `${p.slug}-release-gate`;
  return {
    id,
    name: `${p.title} Release Gate`,
    type: "tool",
    phase: "deployment",
    action:
      "Admit only work the tester released, write it to the run's release target with its tag and digest, and close the run.",
    spec: `Work reaches you only once every acceptance criterion has held, and checking that is your first job. Anything arriving without the tester's release is refused, and the run ends there. For work that carries it, write ${p.theSubject} byte for byte as you received it to the release target named in the run configuration, under a tag made from the run id, and record the digest of exactly what you wrote beside it. Alter nothing on the way through, and substitute nothing you think is better. Emit nothing onward: this is the end of the run, and the tag and the digest are the whole of what it leaves behind.`,
    tools: p.tools.deployer,
    // It writes the artefact and its digest to the run's release target.
    mcp: ["filesystem"],
    skill: skillPath(id),
    params: { target: "run-releases", tag_from: "run_id", record_digest: true },
    inputs: [
      {
        name: "release",
        type: p.releaseType,
        description: "The released work, exactly as the tester emitted it.",
      },
    ],
    outputs: [],
    dependencies: [`${p.slug}-tester`],
    cannot: [],
    willNot: ["alter the artefact on the way through", "release work the tester did not sign off"],
    riskMarkers: [],
    notes: `No \`irreversible-action\` marker, deliberately. Doc 3 §4 prices that marker for actions that cannot be undone, and this node's declared destination is the run's own release target: it writes one tagged, digest-stamped artefact, sends nothing to a third party and deletes nothing. Point this node at a package registry or at a production branch and the marker applies, and the engine charges it against this blueprint at whatever weight the shipped configuration gives it.`,
    version: BASE_VERSION,
    provenance: PROVENANCE,
  };
}

function approver(p: StarterProfile): StarterCardSpec {
  return {
    id: `${p.slug}-approval`,
    name: `${p.title} Approval`,
    type: "human-gate",
    phase: "deployment",
    action:
      "Hold the run at the release boundary until a named approver reads the work that passed and decides, and pass on only what they accept.",
    spec: `Hold the run here. Put ${p.theSubject} in front of the approver named in the run configuration, together with the run that judged it. Every acceptance criterion held before the work reached you, so show them what ran and let them read ${p.theSubject} themselves. Do not summarise the change for them and do not recommend an outcome. Wait for exactly one approver to accept or reject. There is no timeout, no default verdict, and no substitute for the person named. On an acceptance, emit the work byte for byte as you received it on \`release\`. On a rejection, emit nothing, and the run ends here unreleased.`,
    tools: ["human-review"],
    // A person decides here, so there is no server to reach and no document that defines
    // the behaviour. Both fields stay empty, and neither absence is a shortcoming.
    mcp: [],
    params: { required_approvals: 1, approver_scope: p.approverScope },
    inputs: [
      {
        name: "build",
        type: p.releaseType,
        description: "The work the tester released, unchanged.",
      },
    ],
    outputs: [
      {
        name: "release",
        type: p.releaseType,
        description: "The same work, emitted only on an acceptance.",
      },
    ],
    dependencies: [`${p.slug}-tester`],
    cannot: [],
    willNot: ["summarise the work for the approver", "recommend an outcome"],
    riskMarkers: [],
    // The class, never the band behind it. This string is written into the card YAML the
    // reader downloads and reads in the Cards tab, so spec part 2 binds it exactly as it
    // binds a page: a number here would be the 1-to-5 organisational ladder's number
    // appearing on a single graph, which is the collision the class exists to end. The
    // class name is the same fact, and `variants.test.ts` holds the sentence to the class
    // the engine actually computes for the bundle this card ships in.
    notes: `With this node the blueprint is classed supervised. Without it, closed-loop. The class records where a person acts in the run, and this is where. A blueprint that touches something you cannot roll back is a blueprint you want this node in, and the class names which of the two designs you are holding. The \`human-gate\` type is what says a person acts here, and it is the only thing that says it.`,
    version: BASE_VERSION,
    provenance: PROVENANCE,
  };
}

function approvedRelease(p: StarterProfile): StarterCardSpec {
  const id = `${p.slug}-approved-release`;
  return {
    id,
    name: `${p.title} Approved Release`,
    type: "tool",
    phase: "deployment",
    action:
      "Admit only work a named approver accepted, write it to the run's release target with its tag and digest, and close the run.",
    spec: `Work reaches you only once every acceptance criterion has held and one named approver has accepted it, and checking the acceptance is your first job. Anything arriving without one is refused, and the run ends there. For work that carries it, write ${p.theSubject} byte for byte as you received it to the release target named in the run configuration, under a tag made from the run id, and record the digest of exactly what you wrote beside it. Alter nothing on the way through, and substitute nothing you think is better. Emit nothing onward: this is the end of the run, and the tag and the digest are the whole of what it leaves behind.`,
    tools: p.tools.deployer,
    // Same write as the release gate, behind one more refusal.
    mcp: ["filesystem"],
    skill: skillPath(id),
    params: {
      target: "run-releases",
      tag_from: "run_id",
      record_digest: true,
      require_approval: true,
    },
    inputs: [
      {
        name: "release",
        type: p.releaseType,
        description: "The accepted work, exactly as the approver passed it on.",
      },
    ],
    outputs: [],
    dependencies: [`${p.slug}-approval`],
    cannot: [],
    willNot: ["alter the artefact on the way through", "release work no approver accepted"],
    riskMarkers: [],
    notes: `\`${p.slug}-release-gate\` is this node in the variant with no approval gate, and the two are separate cards because they refuse different things: that one refuses work the tester did not release, this one refuses work no person accepted. Doc 1 §4 makes the ref the key to the content, so one id covering both would put two behaviours behind a single pin. This card's \`tool\` type is what says nobody waits here: the person acts at the gate upstream.`,
    version: BASE_VERSION,
    provenance: PROVENANCE,
  };
}

/* --------------------- assembly --------------------- */

/**
 * The nodes of one variant, in DOT declaration order.
 *
 * Doc 2 §5.2's five names are the DOT node ids and they never change; `approver` is the
 * sixth, present only under human approval. The card ids carry the output type, so the
 * four output variants pin four disjoint sets of cards and no ref ever covers two
 * different documents.
 */
export function starterNodes(input: StarterCardInput): readonly StarterNode[] {
  const p = STARTER_PROFILES[input.output];
  const cap = clampIterations(input.maxIterations);
  const nodes: StarterNode[] = [
    { nodeId: "planner", card: planner(p) },
    { nodeId: "builder", card: builder(p) },
    { nodeId: "tester", card: tester(p) },
    { nodeId: "debugger", card: debugger_(p, cap) },
  ];
  if (input.approval === "human") {
    nodes.push({ nodeId: "approver", card: approver(p) });
    nodes.push({ nodeId: "deployer", card: approvedRelease(p) });
  } else {
    nodes.push({ nodeId: "deployer", card: releaseGate(p) });
  }
  return nodes;
}

/** "the script" → "The script". Titles nothing else, so it stays local. */
function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}
