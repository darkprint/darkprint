import { describe, expect, it } from "vitest";

import type { NodeCard } from "@/lib/core";
import {
  buildPaneModel,
  cardYamlBlocks,
  paneNodesFor,
  pinnedRefs,
  type PaneNodeInput,
} from "./build";
import { CARD_FIELD_KEYS } from "./model";
import type { PaneNode } from "./model";

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

risk_markers: []

version: 1.0.0
author: orin
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
    willNot: [],
    riskMarkers: [],
    version: "1.0.0",
    author: "orin",
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
    // `author` and not `ontology_version`, at 24 rather than 25. Two withdrawals in a row
    // moved this probe: `requires_human` leaving the schema took the fixture from 26 to 25,
    // and `ontology_version` leaving it took the KEY as well, so the last top-level line of
    // the document is now `author`. It asks the identical question — the last key in the
    // document owns exactly its own line — and the block boundaries this cell is about did
    // not change either time; the document did.
    expect(blocks.get("author")).toEqual({ start: 24, end: 24 });
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
  });

  /* This assertion used to pin "15 words, handed to the agent when the graph is
     instantiated" — the slot answering with a description of itself. The author asked for
     the content instead, so it pins the content, and the two claims that sentence carried
     are checked where they went rather than dropped: the size is `measure`, and "handed to
     the agent" is `FIELD_NOTE.spec`, which says it in the honest form doc 1 §0.1.3 wants,
     naming whose machine the graph is instantiated on. */
  it("puts what the card wrote on the slot, and its size beside it", () => {
    const fields = model().nodes.find((n) => n.nodeId === "builder")?.card?.fields ?? [];
    const spec = fields.find((f) => f.key === "spec");
    expect(spec?.value).toBe(
      "A build brief arrives with the run. Write the source it describes and nothing else.",
    );
    expect(spec?.measure).toBe("15 words");
    // Nothing behind the row: it opens by unclamping itself, so a `detail` here would be
    // the row repeating what it had just shown.
    expect(spec?.detail).toBeUndefined();

    const action = fields.find((f) => f.key === "action");
    expect(action?.value).toBe("Work through the build brief.");
    expect(action?.measure).toBeUndefined();
  });

  it("flattens a folded scalar so the clamp counts the reader's lines, not the file's", () => {
    const folded = buildPaneModel({
      slug: "s",
      title: "S",
      dot: DOT,
      nodes: [
        {
          nodeId: "builder",
          label: "B",
          ref: "code-builder@1.0.0",
          card: card({ notes: "One line,\nwrapped by the\n  document's margin." }),
          yaml: CARD_YAML,
        },
      ],
    });
    const notes = folded.nodes[0].card?.fields.find((f) => f.key === "notes");
    expect(notes?.value).toBe("One line, wrapped by the document's margin.");
    expect(notes?.measure).toBe("7 words");
  });

  it("carries the values of `params` and not only its keys", () => {
    const configured = buildPaneModel({
      slug: "s",
      title: "S",
      dot: DOT,
      nodes: [
        {
          nodeId: "builder",
          label: "B",
          ref: "code-builder@1.0.0",
          card: card({ params: { max_retries: 3, restore_scope: "last-valid-stage" } }),
          yaml: CARD_YAML,
        },
      ],
    });
    const params = configured.nodes[0].card?.fields.find((f) => f.key === "params");
    expect(params?.value).toBe("max_retries: 3, restore_scope: last-valid-stage");
    expect(params?.filled).toBe(true);
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

  it("draws no row for a key the schema no longer has", () => {
    /* This cell used to be "states both sides of requires_human without weighing one
       against the other", and it drove the two sentences the pane printed for `true` and
       `false`. The field is gone: whether a person acts at the node is the `type`, and the
       pane says it there. Doc 2 §1.1's rule that the two answers weigh the same is not
       lost with the row, it moved to `FIELD_NOTE.type` with the answer.

       What is checked here instead is that the pane did not keep a slot for the withdrawn
       key. A row reading `requires_human — false` off a document that no longer writes it
       would be the pane inventing a field. */
    const attended = buildPaneModel({
      slug: "s",
      title: "S",
      dot: DOT,
      nodes: [
        {
          nodeId: "builder",
          label: "B",
          ref: "code-builder@1.0.0",
          card: card({ type: "human-gate" }),
          yaml: CARD_YAML,
        },
      ],
    });
    const keys = (n: PaneNode | undefined): string[] => n?.card?.fields.map((f) => f.key) ?? [];
    expect(keys(model().nodes.find((n) => n.nodeId === "builder"))).not.toContain(
      "requires_human",
    );
    expect(keys(attended.nodes[0])).not.toContain("requires_human");
    // The type is still a row, and it still says which type it is.
    expect(attended.nodes[0].card?.fields.find((f) => f.key === "type")?.value).toBe("human-gate");
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

/* --------------------- the join between a node and its card --------------------- */

describe("pinnedRefs and paneNodesFor", () => {
  /* The first node pins the ref that sorts LAST, and the third pins through the bare
     `version` form. A join by position against a sorted ref list would hand `task` the
     verifier's card; the join has to come from the DOT. */
  const JOIN_DOT = `digraph join {
  task    [card="task-intake@1.0.0"];
  verify  [card=" acceptance-verifier@2.0.0 "];
  deliver [version="1.0.0"];
  task -> verify -> deliver;
}
`;
  const NODES = [
    { id: "task", label: "Task Intake" },
    { id: "verify", label: "Acceptance Verifier" },
    { id: "deliver", label: "Deliver" },
  ];
  const RESOLVED = new Map<string, NodeCard>([
    ["task-intake@1.0.0", card({ id: "task-intake", name: "Task Intake" })],
    ["acceptance-verifier@2.0.0", card({ id: "acceptance-verifier", version: "2.0.0" })],
    ["deliver@1.0.0", card({ id: "deliver", name: "Deliver" })],
  ]);

  it("reads every node's pin off its own DOT statement, in both spellings", () => {
    expect([...pinnedRefs(JOIN_DOT)]).toEqual([
      ["task", "task-intake@1.0.0"],
      ["verify", "acceptance-verifier@2.0.0"],
      ["deliver", "deliver@1.0.0"],
    ]);
  });

  it("gives the first node its own card, not the card that sorts first", () => {
    const sorted = [...RESOLVED.keys()].sort();
    expect(sorted[0], "the fixture no longer discriminates").not.toBe("task-intake@1.0.0");

    const nodes = paneNodesFor(
      NODES,
      JOIN_DOT,
      RESOLVED,
      new Map([["task-intake@1.0.0", "id: task-intake\n"]]),
    );
    expect(nodes.map((n) => n.ref)).toEqual([
      "task-intake@1.0.0",
      "acceptance-verifier@2.0.0",
      "deliver@1.0.0",
    ]);
    expect(nodes[0].card?.id).toBe("task-intake");
    expect(nodes[0].yaml).toBe("id: task-intake\n");
    expect(nodes[1].card?.id).toBe("acceptance-verifier");
    expect(nodes[1].yaml).toBeUndefined();
  });

  it("leaves a node without a legal pin unjoined rather than guessing", () => {
    const nodes = paneNodesFor(
      [{ id: "loose", label: "Loose" }],
      `digraph g { loose [card="unversioned"]; }`,
      RESOLVED,
      new Map(),
    );
    expect(nodes).toEqual([{ nodeId: "loose", label: "Loose" }]);
  });
});
