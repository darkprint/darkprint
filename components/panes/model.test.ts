import { describe, expect, it } from "vitest";

import type { NodeCard } from "@/lib/core";
import { buildPaneModel } from "./build";
import {
  CARD_BLOCKS,
  CARD_FIELD_KEYS,
  announce,
  blockOf,
  fieldForCardLine,
  lineMeaning,
  lineNodes,
  nodesPinning,
  resolveFocus,
  selectionForDotLine,
  type PaneModel,
} from "./model";

/* ============================================================
   Doc 2 §5.1: "la selezione funziona in tutte le direzioni".
   These are the four directions, checked one at a time on a
   model the real builder produced from a real parse.
   ============================================================ */

const DOT = `digraph starter {
  planner  [card="spec-planner@1.0.0"];
  builder  [card="code-builder@1.0.0"];
  tester   [card="acceptance-tester@1.0.0"];

  planner -> tester [label="acceptance criteria"];
  builder -> tester [label="build"];
  tester  -> debugger [label="failure evidence"];
}
`;

const BUILDER_YAML = `id: code-builder
name: Code Builder
type: agent
phase: implementation

action: >-
  Work through the build brief.
spec: >-
  A build brief arrives with the run.
  Write the source it describes and nothing else.
tools: []

inputs:
  - name: brief
    type: plan
outputs:
  - name: build
    type: code
dependencies:
  - planner

risk_markers: []

version: 1.0.0
`;

const BUILDER_CARD: NodeCard = {
  id: "code-builder",
  name: "Code Builder",
  type: "agent",
  phases: ["implementation"],
  action: "Work through the build brief.",
  spec: "A build brief arrives with the run. Write the source it describes and nothing else.",
  tools: [],
  mcp: [],
  params: {},
  inputs: [{ name: "brief", type: "plan" }],
  outputs: [{ name: "build", type: "code" }],
  dependencies: ["planner"],
  cannot: [],
  willNot: [],
  riskMarkers: [],
  version: "1.0.0",
};

function model(): PaneModel {
  return buildPaneModel({
    slug: "starter",
    title: "Starter software factory",
    dot: DOT,
    nodes: [
      { nodeId: "planner", label: "Spec Planner", ref: "spec-planner@1.0.0" },
      {
        nodeId: "builder",
        label: "Code Builder",
        ref: "code-builder@1.0.0",
        card: BUILDER_CARD,
        yaml: BUILDER_YAML,
      },
      { nodeId: "tester", label: "Acceptance Tester", ref: "acceptance-tester@1.0.0" },
    ],
    absences: [
      {
        id: "criteria-to-builder",
        label: "planner ⇢ builder",
        detail: "The criteria reach the tester and stop there.",
        edge: { source: "planner", target: "builder" },
      },
      {
        id: "criteria-in-spec",
        label: "criteria in the prose",
        detail: "The spec names no criterion.",
        field: { nodeId: "builder", key: "spec" },
      },
    ],
  });
}

/* --------------------- doc 1 §3's table --------------------- */

describe("CARD_BLOCKS", () => {
  it("is the four blocks of doc 1 §3 plus the service fields of §3.5", () => {
    expect(CARD_BLOCKS.map((b) => b.id)).toEqual([
      "identity",
      "behaviour",
      "interfaces",
      "evaluation",
      "service",
    ]);
  });

  it("names every key exactly once", () => {
    expect(new Set(CARD_FIELD_KEYS).size).toBe(CARD_FIELD_KEYS.length);
  });

  it("answers which block a key belongs to", () => {
    expect(blockOf("spec")).toBe("behaviour");
    // `risk_markers` and not `requires_human`: the withdrawn key was this cell's probe
    // into the evaluation block, and the block still has two keys to probe with. Whether a
    // person acts at the node is `type`, in `identity`, and the line below already asks
    // about a key in a third block, so the cell still covers three of the five.
    expect(blockOf("risk_markers")).toBe("evaluation");
    // `provenance` and not `ontology_version`: the withdrawn key was this cell's probe into
    // the service block, which still has three keys to probe with. There is one vocabulary
    // and a card declares no version of it; the version a SCORE was computed under is on the
    // score, which is not a card field and has no block here.
    expect(blockOf("provenance")).toBe("service");
    expect(blockOf("nothing_like_this")).toBeUndefined();
  });
});

/* --------------------- graph → the other three --------------------- */

describe("resolveFocus — from a node", () => {
  it("lights the node's own DOT line and the edges it is an endpoint of", () => {
    const focus = resolveFocus(model(), { nodeId: "builder" });
    expect(focus?.dotPrimary).toEqual([3]);
    expect(focus?.dotSecondary).toEqual([7]);
  });

  it("opens that node's card and highlights no field until one is picked", () => {
    const focus = resolveFocus(model(), { nodeId: "builder" });
    expect(focus?.card?.ref).toBe("code-builder@1.0.0");
    expect(focus?.yamlPrimary).toEqual([]);
  });

  it("falls back to the first node rather than blanking four panes", () => {
    const focus = resolveFocus(model(), { nodeId: "no-such-node" });
    expect(focus?.node.nodeId).toBe("planner");
  });

  it("returns nothing only when the graph has no nodes", () => {
    const empty = buildPaneModel({ slug: "s", title: "S", dot: "digraph d {}", nodes: [] });
    expect(resolveFocus(empty, { nodeId: "anything" })).toBeUndefined();
  });

  it("carries no card for a node whose card the bundle does not hold", () => {
    const focus = resolveFocus(model(), { nodeId: "planner" });
    expect(focus?.card).toBeUndefined();
    expect(focus?.yamlPrimary).toEqual([]);
  });
});

/* --------------------- DOT → graph --------------------- */

describe("selectionForDotLine", () => {
  it("resolves a node statement to that node", () => {
    expect(selectionForDotLine(model(), 2)).toEqual({ nodeId: "planner" });
  });

  it("resolves an edge statement to the id the line opens with", () => {
    expect(selectionForDotLine(model(), 7)).toEqual({ nodeId: "builder" });
  });

  it("resolves nothing for a line that names nothing", () => {
    expect(selectionForDotLine(model(), 5)).toBeUndefined();
    expect(lineNodes(model(), 5)).toEqual([]);
    expect(lineMeaning(model(), 5)).toBeUndefined();
  });
});

/* --------------------- card → graph and DOT --------------------- */

describe("fieldForCardLine", () => {
  it("resolves a line of the document to the key that owns it", () => {
    const card = model().nodes.find((n) => n.nodeId === "builder")?.card;
    expect(card).toBeDefined();
    if (card === undefined) return;
    expect(fieldForCardLine(card, 1)).toBe("id");
    // The second line of the folded `spec` scalar still belongs to `spec`.
    expect(fieldForCardLine(card, 10)).toBe("spec");
    expect(fieldForCardLine(card, 13)).toBe("inputs");
  });

  it("resolves nothing for a line above the first key", () => {
    const card = model().nodes.find((n) => n.nodeId === "builder")?.card;
    if (card === undefined) throw new Error("the fixture card is missing");
    expect(fieldForCardLine({ ...card, yaml: `\n${card.yaml}` }, 0)).toBeUndefined();
  });
});

describe("resolveFocus — from a card field", () => {
  it("highlights the lines of the document that write the field", () => {
    const focus = resolveFocus(model(), { nodeId: "builder", field: "spec" });
    expect(focus?.yamlPrimary).toEqual([8, 9, 10]);
  });

  it("keeps the node's DOT line lit, because that is where the card is pinned", () => {
    const focus = resolveFocus(model(), { nodeId: "builder", field: "spec" });
    expect(focus?.dotPrimary).toEqual([3]);
  });

  it("narrows the edge highlight to the edges a topological field names", () => {
    // `dependencies: [planner]` names an edge that is not in this DOT, so nothing
    // narrows and the node's own edges stay lit. The absence is the lesson, and the
    // pane says so rather than lighting an edge that is not there.
    const focus = resolveFocus(model(), { nodeId: "builder", field: "dependencies" });
    expect(focus?.field?.edgeLines).toBeUndefined();
    expect(focus?.dotSecondary).toEqual([7]);
  });

  it("ignores a field the selected node's card does not carry", () => {
    const focus = resolveFocus(model(), { nodeId: "planner", field: "spec" });
    expect(focus?.field).toBeUndefined();
  });
});

/* --------------------- the row the reader is on --------------------- */

describe("resolveFocus — the picked line", () => {
  it("keeps the picked DOT line lit next to the statement that declares its node", () => {
    // Line 7 is `builder -> tester`. It resolves to `builder`, declared on line 3.
    const focus = resolveFocus(model(), { nodeId: "builder", dotLine: 7 });
    expect(focus?.dotPrimary).toEqual([3, 7]);
    expect(focus?.dotActiveLine).toBe(7);
  });

  it("never lists a line as context when it is already the anchor", () => {
    const focus = resolveFocus(model(), { nodeId: "builder", dotLine: 7 });
    expect(focus?.dotSecondary).toEqual([]);
  });

  it("drops a picked line that names nothing in this model", () => {
    const focus = resolveFocus(model(), { nodeId: "builder", dotLine: 5 });
    expect(focus?.dotPrimary).toEqual([3]);
    expect(focus?.dotActiveLine).toBe(3);
  });

  it("keeps the picked card line inside the selected field", () => {
    const focus = resolveFocus(model(), {
      nodeId: "builder",
      field: "spec",
      cardLine: 10,
    });
    expect(focus?.cardActiveLine).toBe(10);
  });

  it("falls back to the first line of the field when the picked one is outside it", () => {
    const focus = resolveFocus(model(), {
      nodeId: "builder",
      field: "spec",
      cardLine: 2,
    });
    expect(focus?.cardActiveLine).toBe(8);
  });

  it("has no card row to sit on when no field is selected", () => {
    expect(resolveFocus(model(), { nodeId: "builder" })?.cardActiveLine).toBeUndefined();
  });
});

/* --------------------- absences --------------------- */

describe("resolveFocus — absences", () => {
  it("draws a missing edge in the DOT whether or not it is selected", () => {
    const focus = resolveFocus(model(), { nodeId: "tester" });
    expect(focus?.dotGhosts).toEqual([
      {
        absenceId: "criteria-to-builder",
        afterLine: 6,
        text: "planner -> builder;",
        label: "planner ⇢ builder",
        detail: "The criteria reach the tester and stop there.",
      },
    ]);
  });

  it("draws a content absence under the field it concerns, on that node's card only", () => {
    const onBuilder = resolveFocus(model(), { nodeId: "builder" });
    expect(onBuilder?.yamlGhosts).toEqual([
      {
        absenceId: "criteria-in-spec",
        afterLine: 10,
        label: "criteria in the prose",
        detail: "The spec names no criterion.",
      },
    ]);
    expect(resolveFocus(model(), { nodeId: "tester" })?.yamlGhosts).toEqual([]);
  });

  it("moves the ring in the drawing to the node the gap concerns", () => {
    const focus = resolveFocus(model(), {
      nodeId: "planner",
      absence: "criteria-to-builder",
    });
    expect(focus?.node.nodeId).toBe("planner");
    expect(focus?.graphNodeId).toBe("builder");
  });
});

/* --------------------- the join, and what it says out loud --------------------- */

describe("nodesPinning", () => {
  it("finds the nodes of this graph that pin a card ref", () => {
    expect(nodesPinning(model(), "code-builder@1.0.0").map((n) => n.nodeId)).toEqual([
      "builder",
    ]);
    expect(nodesPinning(model(), "not-in-this-graph@1.0.0")).toEqual([]);
  });
});

describe("announce", () => {
  it("says where the node is in all four panes, in one sentence", () => {
    const m = model();
    const focus = resolveFocus(m, { nodeId: "builder" });
    if (focus === undefined) throw new Error("the fixture graph is empty");
    expect(announce(m, focus)).toBe(
      "Node builder, Code Builder. DOT line 3, card code-builder@1.0.0. 3 nodes in the graph.",
    );
  });

  it("names the field, the node and both line ranges when a field is selected", () => {
    const m = model();
    const focus = resolveFocus(m, { nodeId: "builder", field: "spec" });
    if (focus === undefined) throw new Error("the fixture graph is empty");
    expect(announce(m, focus)).toContain("Field spec of card code-builder@1.0.0");
    expect(announce(m, focus)).toContain("DOT line 3");
    expect(announce(m, focus)).toContain("card lines 8 to 10");
  });

  it("states an absence as an absence", () => {
    const m = model();
    const focus = resolveFocus(m, { nodeId: "planner", absence: "criteria-to-builder" });
    if (focus === undefined) throw new Error("the fixture graph is empty");
    expect(announce(m, focus)).toBe(
      "planner ⇢ builder is not in this blueprint. The criteria reach the tester and stop there. The drawing rings builder.",
    );
  });
});
