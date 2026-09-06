/* ============================================================
   Tests for the Attractor reserved-name sets (Fase 0 PART 0).
   These are a transcription of an external contract, so the tests
   are mostly equality against the contract as written: if someone
   "tidies" a name, the diff has to show up here.
   ============================================================ */

import { describe, expect, it } from "vitest";
import {
  ATTRACTOR_BOUNDARY_IDS,
  ATTRACTOR_EDGE_ATTRIBUTES,
  ATTRACTOR_GRAPH_ATTRIBUTES,
  ATTRACTOR_IDENTIFIER,
  ATTRACTOR_KEYWORDS,
  ATTRACTOR_NODE_ATTRIBUTES,
  ATTRACTOR_RESERVED,
  isAttractorBoundaryId,
  isAttractorIdentifier,
  isAttractorKeyword,
  isReserved,
  isUsableAttractorNodeId,
  type AttractorScope,
} from "./reserved";

describe("the three reserved sets", () => {
  it("lists the graph attributes exactly as the contract does", () => {
    expect([...ATTRACTOR_GRAPH_ATTRIBUTES]).toEqual([
      "goal",
      "label",
      "model_stylesheet",
      "default_max_retries",
      // §3.5's legacy alias. Appendix A tabulates only the canonical spelling, but the
      // handler accepts both, so writing DarkPrint data here would set the retry default.
      "default_max_retry",
      "default_fidelity",
      "retry_target",
      "fallback_retry_target",
      "stack.child_dotfile",
      "stack.child_workdir",
      "tool_hooks.pre",
      "tool_hooks.post",
    ]);
  });

  it("lists the node attributes exactly as the contract does", () => {
    expect([...ATTRACTOR_NODE_ATTRIBUTES]).toEqual([
      "label",
      "shape",
      "type",
      "prompt",
      "max_retries",
      "goal_gate",
      "retry_target",
      "fallback_retry_target",
      "fidelity",
      "thread_id",
      "class",
      "timeout",
      "llm_model",
      "llm_provider",
      "reasoning_effort",
      "auto_status",
      "allow_partial",
      // Read by handler pseudocode or by §9.7 rather than tabulated in Appendix A: §4.6
      // WaitForHumanHandler, §4.8 ParallelHandler, §4.10 ToolHandler, §4.11
      // ManagerLoopHandler, §9.7 tool call hooks. The compatibility claim is "attributes
      // not in the reserved list are silently ignored", so a name Attractor really reads
      // belongs in the list whether or not the table prints it.
      "human.default_choice",
      "join_policy",
      "max_parallel",
      "tool_command",
      "manager.poll_interval",
      "manager.max_cycles",
      "manager.stop_condition",
      "manager.actions",
      "stack.child_autostart",
      "tool_hooks.pre",
      "tool_hooks.post",
    ]);
  });

  it("reserves the names the spec's handlers read but Appendix A does not tabulate", () => {
    // The regression this guards: the sets were transcribed from Appendix A alone, so
    // `isReserved` answered false for names Attractor does not ignore.
    expect(isReserved("graph", "default_max_retry")).toBe(true);
    for (const key of [
      /* §4.6's timeout branch reads it off the node and §6.5 names it again. A hexagon
         without one returns RETRY on a timeout, so DarkPrint data parked here would not be
         ignored — it would pick which edge a stalled gate takes. */
      "human.default_choice",
      "tool_command",
      "join_policy",
      "max_parallel",
      "manager.poll_interval",
      "manager.max_cycles",
      "manager.stop_condition",
      "manager.actions",
      "stack.child_autostart",
    ]) {
      expect(isReserved("node", key)).toBe(true);
    }
  });

  it("reserves the two tool-call hooks in BOTH scopes, because §9.7 reads them in both", () => {
    /* "Graph-level or node-level attributes `tool_hooks.pre` and `tool_hooks.post` specify
       shell commands executed around each LLM tool call". Appendix A tabulates only the
       graph row, and reserving the graph row alone would have told a caller that a
       node-level hook is ignored — a shell command per tool call is not something to be
       wrong about in that direction. The scopes are asserted separately because
       `isReserved` is per scope: one set holding both names proves nothing about the
       other. */
    for (const key of ["tool_hooks.pre", "tool_hooks.post"]) {
      expect(isReserved("graph", key), `graph \`${key}\``).toBe(true);
      expect(isReserved("node", key), `node \`${key}\``).toBe(true);
      // Not on an edge: §9.7 names two scopes and an edge is not one of them.
      expect(isReserved("edge", key), `edge \`${key}\``).toBe(false);
    }
  });

  it("lists the edge attributes exactly as the contract does", () => {
    expect([...ATTRACTOR_EDGE_ATTRIBUTES]).toEqual([
      "label",
      "condition",
      "weight",
      "fidelity",
      "thread_id",
      "loop_restart",
    ]);
  });

  it("has no duplicates within a set", () => {
    for (const scope of ["graph", "node", "edge"] as const) {
      const names = ATTRACTOR_RESERVED[scope];
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("is frozen at both levels, so a caller cannot edit the contract in place", () => {
    expect(Object.isFrozen(ATTRACTOR_RESERVED)).toBe(true);
    expect(Object.isFrozen(ATTRACTOR_GRAPH_ATTRIBUTES)).toBe(true);
    expect(Object.isFrozen(ATTRACTOR_NODE_ATTRIBUTES)).toBe(true);
    expect(Object.isFrozen(ATTRACTOR_EDGE_ATTRIBUTES)).toBe(true);
  });

  it("exposes the same arrays through ATTRACTOR_RESERVED", () => {
    expect(ATTRACTOR_RESERVED.graph).toBe(ATTRACTOR_GRAPH_ATTRIBUTES);
    expect(ATTRACTOR_RESERVED.node).toBe(ATTRACTOR_NODE_ATTRIBUTES);
    expect(ATTRACTOR_RESERVED.edge).toBe(ATTRACTOR_EDGE_ATTRIBUTES);
  });
});

describe("isReserved", () => {
  const cases: { scope: AttractorScope; key: string; expected: boolean; why: string }[] = [
    { scope: "node", key: "prompt", expected: true, why: "the card's spec lands here" },
    { scope: "node", key: "type", expected: true, why: "Attractor's handler override" },
    { scope: "graph", key: "goal", expected: true, why: "the manifest summary lands here" },
    { scope: "edge", key: "condition", expected: true, why: "edge-level branch condition" },
    { scope: "graph", key: "prompt", expected: false, why: "`prompt` is a node attribute" },
    { scope: "edge", key: "shape", expected: false, why: "`shape` is a node attribute" },
    { scope: "node", key: "goal", expected: false, why: "`goal` is a graph attribute" },
    { scope: "edge", key: "type", expected: false, why: "edges have no handler override" },
    { scope: "node", key: "card", expected: false, why: "DarkPrint's own pin, ignored by Attractor" },
    { scope: "node", key: "dp_node", expected: false, why: "DarkPrint's own id record" },
    { scope: "graph", key: "rankdir", expected: false, why: "Graphviz layout, ignored" },
    { scope: "node", key: "style", expected: false, why: "Graphviz cosmetics, ignored" },
    { scope: "node", key: "", expected: false, why: "the empty key names nothing" },
  ];

  it.each(cases)("$scope/$key → $expected ($why)", ({ scope, key, expected }) => {
    expect(isReserved(scope, key)).toBe(expected);
  });

  it("matches the dotted graph names unquoted, which is how the parser hands them over", () => {
    expect(isReserved("graph", "stack.child_dotfile")).toBe(true);
    expect(isReserved("graph", "tool_hooks.pre")).toBe(true);
    // With the quotes still attached it is a different string, and a caller that forgot
    // to strip them would otherwise be told their attribute is read when it is not.
    expect(isReserved("graph", '"tool_hooks.pre"')).toBe(false);
  });

  it("is case-sensitive: `Label` is not `label`", () => {
    expect(isReserved("node", "label")).toBe(true);
    expect(isReserved("node", "Label")).toBe(false);
    expect(isReserved("node", "LABEL")).toBe(false);
  });

  it("does not answer for inherited Object properties", () => {
    expect(isReserved("node", "toString")).toBe(false);
    expect(isReserved("node", "constructor")).toBe(false);
    expect(isReserved("node", "__proto__")).toBe(false);
  });

  it("agrees with the arrays it is built from", () => {
    for (const scope of ["graph", "node", "edge"] as const) {
      for (const key of ATTRACTOR_RESERVED[scope]) {
        expect(isReserved(scope, key)).toBe(true);
      }
    }
  });
});

describe("the Identifier rule", () => {
  const legal = ["a", "A", "_", "planner", "solver_a", "__start", "n1", "Node_42", "_9"];
  const illegal = [
    "",
    "solver-a",
    "9lives",
    "1",
    "with space",
    "città",
    "a.b",
    "a/b",
    "planner;",
    '"planner"',
    "a\nb",
  ];

  it.each(legal)("accepts %j", (value) => {
    expect(isAttractorIdentifier(value)).toBe(true);
  });

  it.each(illegal)("rejects %j", (value) => {
    expect(isAttractorIdentifier(value)).toBe(false);
  });

  it("is anchored at both ends, so it never matches a substring", () => {
    expect(ATTRACTOR_IDENTIFIER.source.startsWith("^")).toBe(true);
    expect(ATTRACTOR_IDENTIFIER.source.endsWith("$")).toBe(true);
    expect(isAttractorIdentifier("ok then")).toBe(false);
  });

  it("is not sticky or global, so repeated calls give the same answer", () => {
    // A `/g` regex carries `lastIndex` between calls and would alternate true/false.
    expect(ATTRACTOR_IDENTIFIER.flags).toBe("");
    expect(isAttractorIdentifier("planner")).toBe(true);
    expect(isAttractorIdentifier("planner")).toBe(true);
  });

  it("admits the grammar's keywords, which is why matching it is not enough", () => {
    // The defect this records: `toAttractorIdentifier` guaranteed this rule and nothing
    // else, so a node id of `node` was emitted bare and read back as a defaults statement.
    for (const keyword of ATTRACTOR_KEYWORDS) {
      expect(isAttractorIdentifier(keyword)).toBe(true);
    }
  });
});

describe("the words that cannot open a node statement", () => {
  it("lists the grammar's keywords", () => {
    expect([...ATTRACTOR_KEYWORDS]).toEqual([
      "digraph",
      "edge",
      "graph",
      "node",
      "strict",
      "subgraph",
    ]);
  });

  it.each(["node", "edge", "graph", "subgraph", "digraph", "strict"])(
    "recognises %j as a keyword",
    (value) => {
      expect(isAttractorKeyword(value)).toBe(true);
    },
  );

  it("compares case-insensitively, as DOT keywords are", () => {
    expect(isAttractorKeyword("Node")).toBe(true);
    expect(isAttractorKeyword("SUBGRAPH")).toBe(true);
  });

  it.each(["planner", "nodes", "node_", "_node", "n_node", ""])("leaves %j alone", (value) => {
    expect(isAttractorKeyword(value)).toBe(false);
  });

  it("does not answer for inherited Object properties", () => {
    expect(isAttractorKeyword("toString")).toBe(false);
    expect(isAttractorKeyword("__proto__")).toBe(false);
  });
});

describe("the ids Attractor resolves as the pipeline boundary", () => {
  it("lists them exactly as §3.2 and §4.4 write them", () => {
    expect([...ATTRACTOR_BOUNDARY_IDS]).toEqual(["start", "Start", "exit", "end"]);
  });

  it.each(["start", "Start", "exit", "end"])("recognises %j", (value) => {
    expect(isAttractorBoundaryId(value)).toBe(true);
  });

  it("is case-exact, so the set is not widened on a guess", () => {
    // §7.2 resolves the start node by `shape=Mdiamond` or by an id matching `start`/`Start`
    // and the terminal node by `shape=Msquare` or `exit`/`end`. Nothing else.
    expect(isAttractorBoundaryId("START")).toBe(false);
    expect(isAttractorBoundaryId("Exit")).toBe(false);
    expect(isAttractorBoundaryId("End")).toBe(false);
    expect(isAttractorBoundaryId("started")).toBe(false);
  });
});

describe("isUsableAttractorNodeId", () => {
  it.each(["planner", "_", "__start", "n_node", "Node_42", "starting"])(
    "accepts %j",
    (value) => {
      expect(isUsableAttractorNodeId(value)).toBe(true);
    },
  );

  it.each([
    ["solver-a", "outside the Identifier rule"],
    ["9lives", "leading digit"],
    ["", "empty"],
    ["node", "a defaults statement, not a node"],
    ["graph", "a graph-attribute statement"],
    ["subgraph", "does not parse at all"],
    ["Edge", "the keyword test is case-insensitive"],
    ["start", "Attractor's own start node"],
    ["exit", "Attractor's own terminal node"],
    ["end", "Attractor's own terminal node"],
  ])("rejects %j (%s)", (value) => {
    expect(isUsableAttractorNodeId(value)).toBe(false);
  });
});
