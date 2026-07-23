import type { BlueprintGraph } from "@/lib/types";

/* ============================================================
   A library of agent-pipeline topologies.
   Positions are in pixels (left→right); the graph component
   fits/zooms to view. Each carries authentic DOT source.
   ============================================================ */

/** 1 — Agent-conflict negotiation & voting (seed blueprint). */
export const gConflict: BlueprintGraph = {
  nodes: [
    { id: "task", kind: "start", label: "Task in", position: { x: 0, y: 130 } },
    { id: "plan", kind: "planner", label: "Decompose", position: { x: 180, y: 130 } },
    { id: "a", kind: "executor", label: "Solver A", sub: "temp 0.2", position: { x: 380, y: 30 } },
    { id: "b", kind: "executor", label: "Solver B", sub: "temp 0.9", position: { x: 380, y: 230 } },
    { id: "vote", kind: "negotiator", label: "Consensus vote", position: { x: 600, y: 130 } },
    { id: "verify", kind: "verifier", label: "Verify", position: { x: 810, y: 130 } },
    { id: "resolve", kind: "retry", label: "Re-open debate", position: { x: 600, y: 290 } },
    { id: "ship", kind: "ship", label: "Deliver", position: { x: 1010, y: 130 } },
  ],
  edges: [
    { id: "e1", source: "task", target: "plan", variant: "flow" },
    { id: "e2", source: "plan", target: "a", variant: "flow" },
    { id: "e3", source: "plan", target: "b", variant: "flow" },
    { id: "e4", source: "a", target: "vote", variant: "flow" },
    { id: "e5", source: "b", target: "vote", variant: "flow" },
    { id: "e6", source: "vote", target: "verify", variant: "flow" },
    { id: "e7", source: "verify", target: "ship", label: "pass", variant: "flow" },
    { id: "e8", source: "verify", target: "resolve", label: "conflict", variant: "fallback" },
    { id: "e9", source: "resolve", target: "vote", label: "re-vote", variant: "control" },
  ],
  dot: `digraph conflict {
  rankdir=LR;
  node [shape=box, style=rounded];
  task  -> plan;
  plan  -> solverA;
  plan  -> solverB;
  solverA -> vote;
  solverB -> vote;
  vote  -> verify;
  verify -> deliver [label="pass"];
  verify -> reopen  [label="conflict", style=dashed];
  reopen -> vote    [label="re-vote"];
}`,
};

/** 2 — Mid-pipeline failure recovery with checkpoints (seed blueprint). */
export const gRecovery: BlueprintGraph = {
  nodes: [
    { id: "job", kind: "start", label: "Job in", position: { x: 0, y: 120 } },
    { id: "plan", kind: "planner", label: "Plan stages", position: { x: 170, y: 120 } },
    { id: "s1", kind: "executor", label: "Stage 1", position: { x: 360, y: 30 } },
    { id: "s2", kind: "executor", label: "Stage 2", position: { x: 560, y: 30 } },
    { id: "s3", kind: "executor", label: "Stage 3", position: { x: 760, y: 30 } },
    { id: "ckpt", kind: "memory", label: "Checkpoint", position: { x: 560, y: 250 } },
    { id: "resume", kind: "retry", label: "Resume", position: { x: 360, y: 250 } },
    { id: "verify", kind: "verifier", label: "Verify", position: { x: 960, y: 120 } },
    { id: "ship", kind: "ship", label: "Ship", position: { x: 1140, y: 120 } },
  ],
  edges: [
    { id: "e1", source: "job", target: "plan", variant: "flow" },
    { id: "e2", source: "plan", target: "s1", variant: "flow" },
    { id: "e3", source: "s1", target: "s2", variant: "flow" },
    { id: "e4", source: "s2", target: "s3", variant: "flow" },
    { id: "e5", source: "s3", target: "verify", variant: "flow" },
    { id: "e6", source: "s1", target: "ckpt", variant: "control" },
    { id: "e7", source: "s2", target: "ckpt", variant: "control" },
    { id: "e8", source: "ckpt", target: "resume", label: "on failure", variant: "fallback" },
    { id: "e9", source: "resume", target: "s2", label: "restore", variant: "control" },
    { id: "e10", source: "verify", target: "ship", variant: "flow" },
  ],
  dot: `digraph recovery {
  rankdir=LR;
  node [shape=box, style=rounded];
  job -> plan -> stage1 -> stage2 -> stage3 -> verify -> ship;
  stage1 -> checkpoint [style=dotted];
  stage2 -> checkpoint [style=dotted];
  checkpoint -> resume  [style=dashed, label="on failure"];
  resume -> stage2      [label="restore"];
}`,
};

/** 3 — Research & synthesis (parallel retrieval). */
export const gResearch: BlueprintGraph = {
  nodes: [
    { id: "q", kind: "start", label: "Question", position: { x: 0, y: 130 } },
    { id: "plan", kind: "planner", label: "Plan search", position: { x: 180, y: 130 } },
    { id: "web", kind: "tool", label: "Web search", position: { x: 380, y: 20 } },
    { id: "vec", kind: "tool", label: "Vector store", position: { x: 380, y: 130 } },
    { id: "code", kind: "tool", label: "Code index", position: { x: 380, y: 240 } },
    { id: "syn", kind: "executor", label: "Synthesize", position: { x: 600, y: 130 } },
    { id: "fc", kind: "verifier", label: "Fact-check", position: { x: 800, y: 130 } },
    { id: "ship", kind: "ship", label: "Report", position: { x: 1000, y: 130 } },
  ],
  edges: [
    { id: "e1", source: "q", target: "plan", variant: "flow" },
    { id: "e2", source: "plan", target: "web", variant: "flow" },
    { id: "e3", source: "plan", target: "vec", variant: "flow" },
    { id: "e4", source: "plan", target: "code", variant: "flow" },
    { id: "e5", source: "web", target: "syn", variant: "flow" },
    { id: "e6", source: "vec", target: "syn", variant: "flow" },
    { id: "e7", source: "code", target: "syn", variant: "flow" },
    { id: "e8", source: "syn", target: "fc", variant: "flow" },
    { id: "e9", source: "fc", target: "syn", label: "unsupported", variant: "fallback" },
    { id: "e10", source: "fc", target: "ship", label: "grounded", variant: "flow" },
  ],
  dot: `digraph research {
  rankdir=LR;
  node [shape=box, style=rounded];
  question -> plan;
  plan -> web; plan -> vectors; plan -> code;
  web -> synth; vectors -> synth; code -> synth;
  synth -> factcheck;
  factcheck -> synth  [label="unsupported", style=dashed];
  factcheck -> report [label="grounded"];
}`,
};

/** 4 — Review line WITH a human approval gate (lower autonomy). */
export const gReview: BlueprintGraph = {
  nodes: [
    { id: "pr", kind: "start", label: "PR opened", position: { x: 0, y: 120 } },
    { id: "triage", kind: "planner", label: "Triage diff", position: { x: 190, y: 120 } },
    { id: "draft", kind: "executor", label: "Draft review", position: { x: 400, y: 120 } },
    { id: "tests", kind: "verifier", label: "Run tests", position: { x: 610, y: 120 } },
    { id: "gate", kind: "gate", label: "Maintainer OK", position: { x: 820, y: 120 } },
    { id: "merge", kind: "ship", label: "Merge", position: { x: 1030, y: 120 } },
  ],
  edges: [
    { id: "e1", source: "pr", target: "triage", variant: "flow" },
    { id: "e2", source: "triage", target: "draft", variant: "flow" },
    { id: "e3", source: "draft", target: "tests", variant: "flow" },
    { id: "e4", source: "tests", target: "draft", label: "red", variant: "fallback" },
    { id: "e5", source: "tests", target: "gate", label: "green", variant: "flow" },
    { id: "e6", source: "gate", target: "merge", label: "approve", variant: "control" },
  ],
  dot: `digraph review {
  rankdir=LR;
  node [shape=box, style=rounded];
  pr -> triage -> draft -> tests;
  tests -> draft [label="red", style=dashed];
  tests -> gate  [label="green"];
  gate  -> merge [label="human approve"];
}`,
};

/** 5 — Support triage with routing + escalation. */
export const gSupport: BlueprintGraph = {
  nodes: [
    { id: "tk", kind: "start", label: "Ticket", position: { x: 0, y: 130 } },
    { id: "cls", kind: "router", label: "Classify", position: { x: 190, y: 130 } },
    { id: "auto", kind: "executor", label: "Auto-resolve", position: { x: 400, y: 40 } },
    { id: "kb", kind: "tool", label: "KB lookup", position: { x: 400, y: 220 } },
    { id: "qa", kind: "verifier", label: "QA reply", position: { x: 620, y: 130 } },
    { id: "esc", kind: "gate", label: "Escalate", position: { x: 620, y: 280 } },
    { id: "send", kind: "ship", label: "Send", position: { x: 840, y: 130 } },
  ],
  edges: [
    { id: "e1", source: "tk", target: "cls", variant: "flow" },
    { id: "e2", source: "cls", target: "auto", label: "simple", variant: "flow" },
    { id: "e3", source: "cls", target: "kb", label: "lookup", variant: "flow" },
    { id: "e4", source: "kb", target: "auto", variant: "flow" },
    { id: "e5", source: "auto", target: "qa", variant: "flow" },
    { id: "e6", source: "qa", target: "send", label: "confident", variant: "flow" },
    { id: "e7", source: "qa", target: "esc", label: "low conf.", variant: "fallback" },
  ],
  dot: `digraph support {
  rankdir=LR;
  node [shape=box, style=rounded];
  ticket -> classify;
  classify -> autoresolve [label="simple"];
  classify -> kb [label="lookup"]; kb -> autoresolve;
  autoresolve -> qa;
  qa -> send     [label="confident"];
  qa -> escalate [label="low conf.", style=dashed];
}`,
};

/** 6 — Extraction / normalize / validate with repair loop. */
export const gExtract: BlueprintGraph = {
  nodes: [
    { id: "raw", kind: "start", label: "Raw docs", position: { x: 0, y: 120 } },
    { id: "ext", kind: "executor", label: "Extract", position: { x: 190, y: 120 } },
    { id: "norm", kind: "executor", label: "Normalize", position: { x: 390, y: 120 } },
    { id: "val", kind: "verifier", label: "Validate schema", position: { x: 590, y: 120 } },
    { id: "repair", kind: "retry", label: "Repair", position: { x: 590, y: 270 } },
    { id: "store", kind: "memory", label: "Store", position: { x: 810, y: 120 } },
    { id: "pub", kind: "ship", label: "Publish", position: { x: 1000, y: 120 } },
  ],
  edges: [
    { id: "e1", source: "raw", target: "ext", variant: "flow" },
    { id: "e2", source: "ext", target: "norm", variant: "flow" },
    { id: "e3", source: "norm", target: "val", variant: "flow" },
    { id: "e4", source: "val", target: "repair", label: "invalid", variant: "fallback" },
    { id: "e5", source: "repair", target: "norm", variant: "control" },
    { id: "e6", source: "val", target: "store", label: "valid", variant: "flow" },
    { id: "e7", source: "store", target: "pub", variant: "flow" },
  ],
  dot: `digraph extract {
  rankdir=LR;
  node [shape=box, style=rounded];
  raw -> extract -> normalize -> validate;
  validate -> repair [label="invalid", style=dashed];
  repair -> normalize;
  validate -> store [label="valid"];
  store -> publish;
}`,
};

/* --------------------- Part sub-graphs --------------------- */

export const pRetry: BlueprintGraph = {
  nodes: [
    { id: "in", kind: "start", label: "Attempt", position: { x: 0, y: 90 } },
    { id: "run", kind: "executor", label: "Run action", position: { x: 180, y: 90 } },
    { id: "chk", kind: "verifier", label: "Check", position: { x: 380, y: 90 } },
    { id: "back", kind: "retry", label: "Backoff", position: { x: 380, y: 230 } },
    { id: "out", kind: "ship", label: "OK", position: { x: 580, y: 90 } },
  ],
  edges: [
    { id: "e1", source: "in", target: "run", variant: "flow" },
    { id: "e2", source: "run", target: "chk", variant: "flow" },
    { id: "e3", source: "chk", target: "out", label: "ok", variant: "flow" },
    { id: "e4", source: "chk", target: "back", label: "fail", variant: "fallback" },
    { id: "e5", source: "back", target: "run", label: "retry ≤3", variant: "control" },
  ],
  dot: `digraph retry {
  rankdir=LR;
  attempt -> run -> check;
  check -> ok [label="ok"];
  check -> backoff [label="fail", style=dashed];
  backoff -> run [label="retry <= 3"];
}`,
};

export const pValidation: BlueprintGraph = {
  nodes: [
    { id: "in", kind: "start", label: "Candidate", position: { x: 0, y: 90 } },
    { id: "sch", kind: "verifier", label: "Schema + assert", position: { x: 200, y: 90 } },
    { id: "pass", kind: "ship", label: "Accept", position: { x: 430, y: 20 } },
    { id: "fail", kind: "retry", label: "Reject → fix", position: { x: 430, y: 190 } },
  ],
  edges: [
    { id: "e1", source: "in", target: "sch", variant: "flow" },
    { id: "e2", source: "sch", target: "pass", label: "valid", variant: "flow" },
    { id: "e3", source: "sch", target: "fail", label: "invalid", variant: "fallback" },
  ],
  dot: `digraph validation {
  rankdir=LR;
  candidate -> validate;
  validate -> accept [label="valid"];
  validate -> fix [label="invalid", style=dashed];
}`,
};

export const pNegotiation: BlueprintGraph = {
  nodes: [
    { id: "a", kind: "executor", label: "Proposal A", position: { x: 0, y: 20 } },
    { id: "b", kind: "executor", label: "Proposal B", position: { x: 0, y: 190 } },
    { id: "neg", kind: "negotiator", label: "Weighted vote", position: { x: 220, y: 105 } },
    { id: "out", kind: "ship", label: "Chosen", position: { x: 440, y: 105 } },
  ],
  edges: [
    { id: "e1", source: "a", target: "neg", variant: "flow" },
    { id: "e2", source: "b", target: "neg", variant: "flow" },
    { id: "e3", source: "neg", target: "out", variant: "flow" },
  ],
  dot: `digraph negotiation {
  rankdir=LR;
  proposalA -> vote;
  proposalB -> vote;
  vote -> chosen;
}`,
};

export const pRouting: BlueprintGraph = {
  nodes: [
    { id: "in", kind: "start", label: "Input", position: { x: 0, y: 105 } },
    { id: "r", kind: "router", label: "Route", position: { x: 180, y: 105 } },
    { id: "l1", kind: "executor", label: "Lane A", position: { x: 380, y: 10 } },
    { id: "l2", kind: "executor", label: "Lane B", position: { x: 380, y: 105 } },
    { id: "l3", kind: "executor", label: "Lane C", position: { x: 380, y: 200 } },
  ],
  edges: [
    { id: "e1", source: "in", target: "r", variant: "flow" },
    { id: "e2", source: "r", target: "l1", variant: "flow" },
    { id: "e3", source: "r", target: "l2", variant: "flow" },
    { id: "e4", source: "r", target: "l3", variant: "flow" },
  ],
  dot: `digraph routing {
  rankdir=LR;
  input -> route;
  route -> laneA; route -> laneB; route -> laneC;
}`,
};

export const pMemory: BlueprintGraph = {
  nodes: [
    { id: "in", kind: "start", label: "Event", position: { x: 0, y: 90 } },
    { id: "w", kind: "memory", label: "Write state", position: { x: 190, y: 90 } },
    { id: "r", kind: "memory", label: "Recall", position: { x: 390, y: 90 } },
    { id: "out", kind: "ship", label: "Context out", position: { x: 590, y: 90 } },
  ],
  edges: [
    { id: "e1", source: "in", target: "w", variant: "flow" },
    { id: "e2", source: "w", target: "r", label: "k-NN", variant: "control" },
    { id: "e3", source: "r", target: "out", variant: "flow" },
  ],
  dot: `digraph memory {
  rankdir=LR;
  event -> write -> recall -> context;
}`,
};

export const pEscalation: BlueprintGraph = {
  nodes: [
    { id: "in", kind: "start", label: "Result", position: { x: 0, y: 90 } },
    { id: "conf", kind: "verifier", label: "Confidence", position: { x: 190, y: 90 } },
    { id: "auto", kind: "ship", label: "Auto-accept", position: { x: 420, y: 20 } },
    { id: "gate", kind: "gate", label: "Escalate", position: { x: 420, y: 190 } },
  ],
  edges: [
    { id: "e1", source: "in", target: "conf", variant: "flow" },
    { id: "e2", source: "conf", target: "auto", label: "high", variant: "flow" },
    { id: "e3", source: "conf", target: "gate", label: "low", variant: "fallback" },
  ],
  dot: `digraph escalation {
  rankdir=LR;
  result -> confidence;
  confidence -> accept [label="high"];
  confidence -> escalate [label="low", style=dashed];
}`,
};
