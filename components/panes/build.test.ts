import { describe, expect, it } from "vitest";

import type { NodeCard } from "@/lib/core";
import { buildPaneModel, cardYamlBlocks, type PaneNodeInput } from "./build";
import { CARD_FIELD_KEYS } from "./model";

/* ============================================================
   The line numbers pane 3 highlights and the line ranges pane 4
   highlights are the whole contract of this module. Everything
   below either checks one of those against a source it can read
   by eye, or checks that a card the archive really ships lands
   in the right slots.
   ============================================================ */

const DOT = `digraph starter {
  rankdir=LR;

  // five nodes
  planner  [card="spec-planner@1.0.0"];
  builder  [card="code-builder@1.0.0"];
  tester   [card="acceptance-tester@1.0.0"];

  planner -> tester [label="acceptance criteria"];
  builder -> tester [label="build"];
  tester  -> builder [label="verdict"];
}
`;

const CARD_YAML = `id: code-builder
name: Code Builder
type: agent
phase: implementation

action: >-
  Work through the build brief.
spec: >-
  A build brief arrives with the run. Write the source it describes and nothing else.
agent: Builder
tools: []

inputs:
  - name: brief
    type: plan
outputs:
  - name: build
    type: code
dependencies: []

requires_human: false
risk_markers: []

version: 1.0.0
author: orin
ontology_version: 0.1.0
`;

function card(overrides: Partial<NodeCard> = {}): NodeCard {
  return {
    id: "code-builder",
    name: "Code Builder",
    type: "agent",
    phases: ["implementation"],
    action: "Work through the build brief.",
    spec: "A build brief arrives with the run. Write the source it describes and nothing else.",
    agent: "Builder",
    tools: [],
    mcp: [],
    params: {},
    inputs: [{ name: "brief", type: "plan" }],
    outputs: [{ name: "build", type: "code" }],
    dependencies: [],
    cannot: [],
    requiresHuman: false,
    riskMarkers: [],
    version: "1.0.0",
    author: "orin",
    ontologyVersion: "0.1.0",
    ...overrides,
  };
}

function nodes(): PaneNodeInput[] {
  return [
    { nodeId: "planner", label: "Spec Planner", ref: "spec-planner@1.0.0" },
    {
      nodeId: "builder",
      label: "Code Builder",
      ref: "code-builder@1.0.0",
      card: card(),
      yaml: CARD_YAML,
    },
    { nodeId: "tester", label: "Acceptance Tester", ref: "acceptance-tester@1.0.0" },
  ];
}

function model(absences?: Parameters<typeof buildPaneModel>[0]["absences"]) {
  return buildPaneModel({
    slug: "starter",
    title: "Starter",
    dot: DOT,
    nodes: nodes(),
    ...(absences === undefined ? {} : { absences }),
  });
}

/* --------------------- DOT positions --------------------- */

describe("buildPaneModel — DOT positions", () => {
  it("takes each node's line from the parser's node statement", () => {
    const m = model();
    const byId = new Map(m.nodes.map((n) => [n.nodeId, n]));
    expect(byId.get("planner")?.dotLine).toBe(5);
    expect(byId.get("builder")?.dotLine).toBe(6);
    expect(byId.get("tester")?.dotLine).toBe(7);
  });

  it("does not confuse a node with the same name written inside a comment or a card ref", () => {
    const withDecoys = buildPaneModel({
      slug: "s",
      title: "S",
      // `builder` appears in a comment and inside a quoted card ref before it is declared.
      dot: `digraph d {\n  // the builder is the point\n  planner [card="builder-spec@1.0.0"];\n  builder [card="code-builder@1.0.0"];\n}\n`,
      nodes: [
        { nodeId: "planner", label: "P" },
        { nodeId: "builder", label: "B" },
      ],
    });
    const byId = new Map(withDecoys.nodes.map((n) => [n.nodeId, n]));
    expect(byId.get("builder")?.dotLine).toBe(4);
    expect(withDecoys.dotLineNodes["2"]).toBeUndefined();
  });

  it("lists every edge line a node is an endpoint of, in both directions", () => {
    const byId = new Map(model().nodes.map((n) => [n.nodeId, n]));
    expect(byId.get("tester")?.edgeLines).toEqual([9, 10, 11]);
    expect(byId.get("planner")?.edgeLines).toEqual([9]);
    expect(byId.get("builder")?.edgeLines).toEqual([10, 11]);
  });

  it("records who feeds whom, so a pane can say what a node never hears from", () => {
    const byId = new Map(model().nodes.map((n) => [n.nodeId, n]));
    expect(byId.get("builder")?.sources).toEqual(["tester"]);
    expect(byId.get("builder")?.targets).toEqual(["tester"]);
    expect(byId.get("planner")?.sources).toEqual([]);
  });

  it("maps an edge line to its source first, then its target", () => {
    expect(model().dotLineNodes["9"]).toEqual(["planner", "tester"]);
  });

  it("says what each mapped line is", () => {
    const m = model();
    expect(m.dotLineMeaning["6"]).toBe("declares node builder, pinning card code-builder@1.0.0");
    expect(m.dotLineMeaning["9"]).toBe("edge from planner to tester");
    expect(m.dotLineMeaning["2"]).toBeUndefined();
  });

  it("keeps both edges of a chain written on one line", () => {
    const chained = buildPaneModel({
      slug: "s",
      title: "S",
      dot: `digraph d {\n  a -> b -> c;\n}\n`,
      nodes: [
        { nodeId: "a", label: "A" },
        { nodeId: "b", label: "B" },
        { nodeId: "c", label: "C" },
      ],
    });
    expect(chained.dotLineNodes["2"]).toEqual(["a", "b", "c"]);
    expect(chained.dotLineMeaning["2"]).toBe("edge from a to b; edge from b to c");
  });

  it("yields a model with no line numbers rather than throwing on unparseable DOT", () => {
    const broken = buildPaneModel({
      slug: "s",
      title: "S",
      dot: "this is not a graph at all",
      nodes: [{ nodeId: "a", label: "A" }],
    });
    expect(broken.nodes[0].dotLine).toBeUndefined();
    expect(broken.nodes[0].edgeLines).toEqual([]);
    expect(broken.dotLineNodes).toEqual({});
  });
});

/* --------------------- the card document --------------------- */

describe("cardYamlBlocks", () => {
  it("gives each top-level key the lines it owns", () => {
    const blocks = cardYamlBlocks(CARD_YAML);
    expect(blocks.get("id")).toEqual({ start: 1, end: 1 });
    expect(blocks.get("phase")).toEqual({ start: 4, end: 4 });
    // The folded scalar keeps its continuation line, and the blank line after it is not
    // charged to `spec`.
    expect(blocks.get("spec")).toEqual({ start: 8, end: 9 });
    expect(blocks.get("inputs")).toEqual({ start: 13, end: 15 });
    expect(blocks.get("ontology_version")).toEqual({ start: 26, end: 26 });
  });

  it("does not mistake an indented key for a top-level one", () => {
    const blocks = cardYamlBlocks(CARD_YAML);
    expect(blocks.has("type")).toBe(true);
    // `name:` appears indented under `inputs` and `outputs` as well as at the top level.
    expect(blocks.get("name")).toEqual({ start: 2, end: 2 });
  });

  it("is empty for an empty document", () => {
    expect(cardYamlBlocks("").size).toBe(0);
  });

  it("keeps the first range when a key is written twice", () => {
    expect(cardYamlBlocks("id: a\nname: n\nid: b\n").get("id")).toEqual({
      start: 1,
      end: 1,
    });
  });
});

/* --------------------- the skeleton --------------------- */

describe("buildPaneModel — the card skeleton", () => {
  it("draws a slot for every key of doc 1 §3, in block order", () => {
    const builder = model().nodes.find((n) => n.nodeId === "builder");
    expect(builder?.card?.fields.map((f) => f.key)).toEqual([...CARD_FIELD_KEYS]);
  });

  it("points each filled slot at the lines of the document that write it", () => {
    const fields = model().nodes.find((n) => n.nodeId === "builder")?.card?.fields ?? [];
    const spec = fields.find((f) => f.key === "spec");
    expect(spec?.lines).toEqual({ start: 8, end: 9 });
    expect(spec?.value).toBe(
      "15 words, handed to the agent when the graph is instantiated",
    );
  });

  it("leaves a slot the document never writes without a line range", () => {
    const fields = model().nodes.find((n) => n.nodeId === "builder")?.card?.fields ?? [];
    const notes = fields.find((f) => f.key === "notes");
    expect(notes?.lines).toBeUndefined();
    expect(notes?.filled).toBe(false);
  });

  it("marks a declared empty list as unfilled and states what the card says", () => {
    const fields = model().nodes.find((n) => n.nodeId === "builder")?.card?.fields ?? [];
    const tools = fields.find((f) => f.key === "tools");
    expect(tools?.filled).toBe(false);
    expect(tools?.value).toBe("none required");
    // Declared, so it still points at its line: the card answered the question.
    expect(tools?.lines).toEqual({ start: 11, end: 11 });
  });

  it("states both sides of requires_human without weighing one against the other", () => {
    const unattended = model().nodes.find((n) => n.nodeId === "builder");
    const attended = buildPaneModel({
      slug: "s",
      title: "S",
      dot: DOT,
      nodes: [
        {
          nodeId: "builder",
          label: "B",
          ref: "code-builder@1.0.0",
          card: card({ requiresHuman: true }),
          yaml: CARD_YAML,
        },
      ],
    });
    const off = unattended?.card?.fields.find((f) => f.key === "requires_human");
    const on = attended.nodes[0].card?.fields.find((f) => f.key === "requires_human");
    expect(off?.filled).toBe(true);
    expect(on?.filled).toBe(true);
    expect(on?.value).toBe("true. The run holds here until a person acts.");
    expect(off?.value).toBe("false. A run passes through without stopping.");
  });

  it("gives `dependencies` the DOT lines of the edges it names", () => {
    const withDeps = buildPaneModel({
      slug: "s",
      title: "S",
      dot: DOT,
      nodes: [
        {
          nodeId: "builder",
          label: "B",
          ref: "code-builder@1.0.0",
          card: card({ dependencies: ["tester"] }),
          yaml: CARD_YAML,
        },
      ],
    });
    const deps = withDeps.nodes[0].card?.fields.find((f) => f.key === "dependencies");
    // `tester -> builder` is line 11; `builder -> tester` is not this dependency.
    expect(deps?.edgeLines).toEqual([11]);
  });

  it("carries no card for a node whose card the bundle does not hold", () => {
    expect(model().nodes.find((n) => n.nodeId === "planner")?.card).toBeUndefined();
  });
});

/* --------------------- absences --------------------- */

describe("buildPaneModel — absences", () => {
  const absent = [
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
  ];

  it("anchors a missing edge under the last edge leaving the same node", () => {
    const m = model(absent);
    expect(m.absences[0].dot).toEqual({
      text: "planner -> builder;",
      afterLine: 9,
    });
  });

  it("takes the node the gap concerns from the edge's target", () => {
    expect(model(absent).absences[0].nodeId).toBe("builder");
  });

  it("leaves a content-only absence without a DOT position", () => {
    const m = model(absent);
    expect(m.absences[1].dot).toBeUndefined();
    expect(m.absences[1].field).toEqual({ nodeId: "builder", key: "spec" });
    expect(m.absences[1].nodeId).toBe("builder");
  });

  it("falls back to the source node's own line when it has no edges at all", () => {
    const m = model([
      {
        id: "x",
        label: "builder ⇢ planner",
        detail: "Nothing runs back.",
        edge: { source: "builder", target: "planner" },
      },
    ]);
    // `builder` has edges, so this exercises the sibling path; a node with none falls
    // through to its declaration line.
    expect(m.absences[0].dot?.afterLine).toBe(10);
  });

  it("has none when the caller declares none", () => {
    expect(model().absences).toEqual([]);
  });
});
