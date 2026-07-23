import type { Blueprint, Metric, AutonomyLevel } from "@/lib/types";
import { AUTONOMY_LABELS } from "@/lib/format";
import { AUTHORS } from "./users";
import {
  gConflict,
  gRecovery,
  gResearch,
  gReview,
  gSupport,
  gExtract,
} from "./graphs";

/* --- helpers to keep entries compact --- */

const AUTONOMY_BLURB: Record<AutonomyLevel, string> = {
  1: "A human drives; agents assist step by step.",
  2: "Agents act, but a human approves the critical move.",
  3: "Self-directed within guardrails; escalates edge cases.",
  4: "Plans, executes, verifies and ships with no human in the loop.",
};

function autonomy(level: AutonomyLevel) {
  return { level, label: AUTONOMY_LABELS[level], blurb: AUTONOMY_BLURB[level] };
}

function metrics(
  v: { au: number; ef: number; re: number; tr: number; co: number; se: number },
  notes?: { autonomy?: string; security?: string },
): Metric[] {
  return [
    {
      key: "autonomy",
      label: "Autonomy",
      value: v.au,
      source: "auto",
      detail: notes?.autonomy ?? "Derived from human-gate nodes on the critical path.",
    },
    {
      key: "efficacy",
      label: "Efficacy",
      value: v.ef,
      source: "community",
      detail: "Community-rated task success on real runs.",
    },
    {
      key: "reliability",
      label: "Reliability",
      value: v.re,
      source: "community",
      detail: "Rated across repeated executions without error.",
    },
    {
      key: "transparency",
      label: "Transparency",
      value: v.tr,
      source: "community",
      detail: "How well the internal decisions are documented.",
    },
    {
      key: "cost",
      label: "Cost / time",
      value: v.co,
      source: "measured",
      detail: "Median tokens and wall-clock recorded on execution.",
    },
    {
      key: "security",
      label: "Security",
      value: v.se,
      source: "auto",
      detail: notes?.security ?? "Permissions & tool scopes inferred from the graph.",
    },
  ];
}

export const BLUEPRINTS: Blueprint[] = [
  {
    kind: "blueprint",
    slug: "adversarial-consensus-line",
    title: "Adversarial Consensus Line",
    summary:
      "Two agents solve the same task from opposite temperatures, then a consensus node negotiates a single answer — re-opening the debate when they clash.",
    description:
      "The hardest part of a multi-agent factory isn't getting work done — it's what happens when two competent agents disagree. This blueprint runs a deliberate adversarial pair: Solver A stays conservative, Solver B explores. A consensus node scores both proposals against the acceptance criteria and, on a genuine conflict, re-opens a bounded debate instead of silently picking one. The loop closes only when the verifier signs off, so no human ever has to arbitrate.\n\nUse it wherever a single model is confidently wrong too often: spec interpretation, refactor strategy, or any judgement call where a second, differently-tuned opinion catches the blind spot.",
    tags: ["multi-agent", "negotiation", "consensus", "voting"],
    category: "Coordination",
    author: AUTHORS.mara,
    autonomy: autonomy(4),
    metrics: metrics(
      { au: 92, ef: 84, re: 78, tr: 88, co: 46, se: 74 },
      {
        autonomy: "No approval nodes; conflict is resolved by re-vote, not a human.",
        security: "Read-only tools; no write scopes requested.",
      },
    ),
    graph: gConflict,
    requiredAgents: ["Solver A (low-temp)", "Solver B (high-temp)", "Consensus judge", "Verifier"],
    requiredTools: ["Acceptance-criteria evaluator", "Vote log"],
    createdAt: "2026-04-09",
    updatedAt: "2026-06-30",
    downloads: 3120,
    votes: 214,
    featured: true,
    seed: true,
    comments: [
      {
        id: "c1",
        author: AUTHORS.sol,
        body: "Ran the static analyzer on this — genuinely zero human gates, autonomy 4 confirmed. The bounded re-vote (max 3) is what keeps it from looping forever.",
        createdAt: "2026-05-02",
        votes: 41,
      },
      {
        id: "c2",
        author: AUTHORS.hachi,
        body: "1,000 executions, 12 hard conflicts, all resolved without escalation. Cost is the weak metric — the debate loop roughly doubles tokens when it triggers.",
        createdAt: "2026-05-18",
        votes: 27,
      },
      {
        id: "c3",
        author: AUTHORS.orin,
        body: "Swapped Solver B for a cheaper model and efficacy barely moved. The value is in the disagreement, not the raw horsepower.",
        createdAt: "2026-06-11",
        votes: 15,
      },
    ],
  },
  {
    kind: "blueprint",
    slug: "checkpoint-resume-runner",
    title: "Checkpoint & Resume Runner",
    summary:
      "A staged pipeline that snapshots state after every stage, so a failure at stage 3 resumes from the last good checkpoint instead of restarting the whole job.",
    description:
      "Long agent jobs fail halfway — a tool times out, a rate limit hits, a stage produces garbage. The naive fix is to start over and burn the work already done. This blueprint writes an immutable checkpoint after each stage: inputs, outputs and the decisions taken. When a downstream stage fails, the resume node restores the most recent valid checkpoint and continues from there, not from zero.\n\nIt turns a brittle linear pipeline into something you can actually run unattended overnight. The verifier gates the final ship, and the checkpoint store doubles as an audit trail of exactly what each stage did.",
    tags: ["reliability", "checkpointing", "recovery", "long-running"],
    category: "Reliability",
    author: AUTHORS.kwame,
    autonomy: autonomy(4),
    metrics: metrics(
      { au: 90, ef: 80, re: 94, tr: 82, co: 58, se: 70 },
      {
        autonomy: "Failure recovery is automated end-to-end; no human restart.",
        security: "Requires durable storage write scope for checkpoints.",
      },
    ),
    graph: gRecovery,
    requiredAgents: ["Planner", "Stage workers", "Resume controller", "Verifier"],
    requiredTools: ["Durable checkpoint store", "State differ"],
    createdAt: "2026-03-21",
    updatedAt: "2026-07-05",
    downloads: 4780,
    votes: 301,
    featured: true,
    seed: true,
    comments: [
      {
        id: "c1",
        author: AUTHORS.mara,
        body: "This is the part everyone skips and then wonders why their factory can't run for more than 20 minutes. Reliability 94 is earned.",
        createdAt: "2026-04-14",
        votes: 52,
      },
      {
        id: "c2",
        author: AUTHORS.hachi,
        body: "Checkpoint granularity is a real knob — per-stage is the sweet spot. Went finer once and the storage writes dominated the cost metric.",
        createdAt: "2026-05-29",
        votes: 33,
      },
    ],
  },
  {
    kind: "blueprint",
    slug: "grounded-research-desk",
    title: "Grounded Research Desk",
    summary:
      "Fans a question across web, vector and code search, synthesizes one answer, and loops back through a fact-checker until every claim is grounded.",
    description:
      "A research agent that won't ship an unsupported sentence. The planner splits the question into retrieval strands that run in parallel — web, an internal vector store, and a code index — then a synthesizer drafts a single grounded answer. The fact-checker verifies each claim against the retrieved evidence and bounces anything unsupported back for another pass. Only a fully-grounded report reaches the reader.",
    tags: ["research", "RAG", "synthesis", "grounding"],
    category: "Knowledge",
    author: AUTHORS.orin,
    autonomy: autonomy(3),
    metrics: metrics(
      { au: 74, ef: 82, re: 76, tr: 90, co: 52, se: 80 },
      {
        autonomy: "Self-directed; escalates only when evidence stays thin after N loops.",
        security: "Outbound web fetch only; no credentials in scope.",
      },
    ),
    graph: gResearch,
    requiredAgents: ["Search planner", "Synthesizer", "Fact-checker"],
    requiredTools: ["Web search", "Vector store", "Code index"],
    createdAt: "2026-05-01",
    updatedAt: "2026-07-12",
    downloads: 2210,
    votes: 158,
    featured: true,
    comments: [
      {
        id: "c1",
        author: AUTHORS.lupo,
        body: "Transparency 90 is fair — the citation trail per claim makes it trivial to audit. Wish more blueprints did this.",
        createdAt: "2026-06-03",
        votes: 22,
      },
    ],
  },
  {
    kind: "blueprint",
    slug: "guarded-merge-bot",
    title: "Guarded Merge Bot",
    summary:
      "Triages a PR, drafts a review, runs the tests, then stops at a maintainer approval gate before merging — a deliberately supervised line.",
    description:
      "Not every factory should be lights-out. This blueprint is honest about its human gate: agents do all the toil — triaging the diff, drafting the review, iterating until tests are green — but a maintainer makes the final merge call. The static analyzer sees that gate and correctly caps autonomy at level 2. It's here as a reference for teams who want most of the leverage without handing over the merge button.",
    tags: ["code-review", "CI", "human-in-loop", "software"],
    category: "Software",
    author: AUTHORS.sol,
    autonomy: autonomy(2),
    metrics: metrics(
      { au: 44, ef: 88, re: 90, tr: 84, co: 62, se: 66 },
      {
        autonomy: "One human-approval gate on the merge path caps this at supervised.",
        security: "Requests repo write scope — flagged for review.",
      },
    ),
    graph: gReview,
    requiredAgents: ["Triager", "Reviewer", "Test runner"],
    requiredTools: ["Git host API", "CI runner"],
    createdAt: "2026-02-17",
    updatedAt: "2026-06-20",
    downloads: 5410,
    votes: 276,
    comments: [
      {
        id: "c1",
        author: AUTHORS.kwame,
        body: "Good honest example of why the gate matters. Autonomy 2 isn't a failure — for merges it's the point.",
        createdAt: "2026-03-30",
        votes: 30,
      },
    ],
  },
  {
    kind: "blueprint",
    slug: "frontline-triage",
    title: "Frontline Triage",
    summary:
      "Classifies inbound tickets, auto-resolves the simple ones with a KB lookup, QAs its own reply, and escalates only when confidence drops.",
    description:
      "A support line that handles the long tail on its own and knows when it's out of its depth. The router classifies each ticket, simple cases get an auto-resolution backed by a knowledge-base lookup, and a QA step checks the drafted reply before it goes out. Low-confidence replies escalate to a human instead of being sent — so the escalation is a safety valve, not the default.",
    tags: ["support", "routing", "escalation", "operations"],
    category: "Operations",
    author: AUTHORS.hachi,
    autonomy: autonomy(3),
    metrics: metrics(
      { au: 70, ef: 79, re: 83, tr: 72, co: 68, se: 76 },
      {
        autonomy: "Escalation gate is a conditional off-ramp, not a required step.",
        security: "Read scope on KB; send scope on the reply channel.",
      },
    ),
    graph: gSupport,
    requiredAgents: ["Classifier", "Resolver", "QA checker"],
    requiredTools: ["Knowledge base", "Ticket API", "Reply channel"],
    createdAt: "2026-04-25",
    updatedAt: "2026-07-01",
    downloads: 1890,
    votes: 121,
    comments: [],
  },
  {
    kind: "blueprint",
    slug: "schema-forge-etl",
    title: "Schema Forge ETL",
    summary:
      "Extracts, normalizes and schema-validates messy documents, repairing anything that fails validation before it ever reaches the store.",
    description:
      "Unstructured input is where pipelines quietly rot. Schema Forge extracts fields, normalizes them to a target shape, and validates against a strict schema. Anything invalid loops through a repair pass rather than being dropped or, worse, written half-formed. Only records that pass validation are stored and published, so downstream consumers get a hard guarantee about shape.",
    tags: ["ETL", "extraction", "validation", "data"],
    category: "Data",
    author: AUTHORS.lupo,
    autonomy: autonomy(4),
    metrics: metrics(
      { au: 88, ef: 81, re: 89, tr: 78, co: 55, se: 72 },
      {
        autonomy: "Repair loop closes without human input; hard schema gate only.",
        security: "Write scope on the target store; source is read-only.",
      },
    ),
    graph: gExtract,
    requiredAgents: ["Extractor", "Normalizer", "Validator", "Repair worker"],
    requiredTools: ["Schema registry", "Document store"],
    createdAt: "2026-03-08",
    updatedAt: "2026-06-28",
    downloads: 2640,
    votes: 167,
    comments: [
      {
        id: "c1",
        author: AUTHORS.orin,
        body: "The repair loop is the difference between 'demo' and 'prod'. Set the max-repair count or it'll chew tokens on genuinely broken input.",
        createdAt: "2026-05-10",
        votes: 19,
      },
    ],
  },
  {
    kind: "blueprint",
    slug: "nightly-data-janitor",
    title: "Nightly Data Janitor",
    summary:
      "An unattended overnight cleanup line: extract deltas, normalize, validate against schema, and publish — repairing dirty rows in place.",
    description:
      "A scheduled variant of the extract-validate pattern, tuned to run while nobody's watching. It picks up the day's deltas, normalizes and validates them, repairs what it can, and quarantines what it can't for a morning review queue. Built to be boring and dependable — the kind of factory node you forget exists because it never pages you.",
    tags: ["ETL", "scheduled", "data", "cleanup"],
    category: "Data",
    author: AUTHORS.kwame,
    autonomy: autonomy(4),
    metrics: metrics(
      { au: 86, ef: 77, re: 91, tr: 74, co: 61, se: 69 },
      {
        autonomy: "Quarantine is asynchronous; the nightly run never blocks on a human.",
        security: "Batch write scope; runs under a scoped service identity.",
      },
    ),
    graph: gExtract,
    requiredAgents: ["Delta extractor", "Normalizer", "Validator"],
    requiredTools: ["Warehouse", "Schema registry", "Scheduler"],
    createdAt: "2026-05-19",
    updatedAt: "2026-07-14",
    downloads: 1320,
    votes: 88,
    comments: [],
  },
  {
    kind: "blueprint",
    slug: "incident-commander",
    title: "Incident Commander",
    summary:
      "Triages alerts, routes to the right runbook, drafts a mitigation, QAs it against blast-radius rules, and escalates to on-call when risk is high.",
    description:
      "A first-responder for production incidents. It classifies the alert, routes to the matching runbook, and drafts a mitigation — but a QA step checks that mitigation against blast-radius rules before anything runs. Anything risky escalates to on-call with a full context pack rather than acting unilaterally. It buys your humans the ten minutes that matter without letting an agent take down prod on a hunch.",
    tags: ["incident-response", "routing", "escalation", "operations"],
    category: "Operations",
    author: AUTHORS.mara,
    autonomy: autonomy(3),
    metrics: metrics(
      { au: 72, ef: 80, re: 85, tr: 81, co: 64, se: 63 },
      {
        autonomy: "High-risk actions require escalation; low-risk mitigations auto-run.",
        security: "Holds runbook exec scope — the highest-privilege blueprint here.",
      },
    ),
    graph: gSupport,
    requiredAgents: ["Alert classifier", "Mitigation drafter", "Blast-radius QA"],
    requiredTools: ["Runbook store", "Paging system", "Metrics API"],
    createdAt: "2026-06-02",
    updatedAt: "2026-07-18",
    downloads: 970,
    votes: 74,
    comments: [
      {
        id: "c1",
        author: AUTHORS.sol,
        body: "Security 63 is the lowest in the gallery for a reason — this thing can execute runbooks. Read the required scopes before you run it.",
        createdAt: "2026-06-25",
        votes: 24,
      },
    ],
  },
];

export function getBlueprint(slug: string): Blueprint | undefined {
  return BLUEPRINTS.find((b) => b.slug === slug);
}
