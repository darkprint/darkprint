import { describe, expect, it } from "vitest";

import type { NodeCard } from "../card/schema";
import { canonicalJson } from "./canonical";
import { bundleDigest, cardDigest, shortDigest } from "./digest";

const CARD: NodeCard = {
  id: "solver-a",
  name: "Solver A",
  type: "agent",
  // Doc 3 §2 and doc 1 §3.2, both required as of ontology v0.1 — and both part of the
  // identity below, because `cardDigest` spreads the whole card.
  phase: "implementation",
  action: "Draft a candidate solution for the sub-task",
  spec: "Read the sub-task, draft one candidate solution, and return it as JSON on the draft port.",
  tools: [],
  params: {},
  inputs: [{ name: "task", type: "text" }],
  outputs: [{ name: "draft", type: "json" }],
  dependencies: [],
  requiresHuman: false,
  riskMarkers: [],
  version: "1.0.0",
  ontologyVersion: "0.1.0",
};

describe("cardDigest — shape", () => {
  it("is sha256: followed by 64 hex characters", () => {
    expect(cardDigest(CARD)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("matches the SHA-256 of the exact canonical payload", () => {
    // Golden vector: the canonical JSON below hashed by an independent SHA-256.
    // It fails if the identity payload ever changes shape, which is the point.
    //
    // Recomputed when `phase` and `spec` became required fields (doc 3 §2, doc 1 §3.2).
    // The digest necessarily moved: `cardDigest` spreads the whole card, so two new
    // required fields are two new facts about what the node does, and doc 1 §4 wants a
    // card that says something different to hash differently.
    expect(canonicalJson({ ...CARD })).toBe(
      '{"action":"Draft a candidate solution for the sub-task","dependencies":[],' +
        '"id":"solver-a","inputs":[{"name":"task","type":"text"}],"name":"Solver A",' +
        '"ontologyVersion":"0.1.0","outputs":[{"name":"draft","type":"json"}],"params":{},' +
        '"phase":"implementation","requiresHuman":false,"riskMarkers":[],' +
        '"spec":"Read the sub-task, draft one candidate solution, and return it as JSON on the draft port.",' +
        '"tools":[],"type":"agent","version":"1.0.0"}',
    );
    expect(cardDigest(CARD)).toBe(
      "sha256:e1bd7cc71de6de1e43ebfdf0718dab60af9b4cc57afe148f75cef77d7afe40e4",
    );
  });

  it("does not mutate the card it is given", () => {
    const card: NodeCard = { ...CARD, author: "berti", provenance: "github.com/berti" };
    cardDigest(card);
    expect(card.author).toBe("berti");
    expect(card.provenance).toBe("github.com/berti");
  });
});

describe("cardDigest — excluded fields", () => {
  it("ignores author", () => {
    expect(cardDigest({ ...CARD, author: "berti" })).toBe(cardDigest(CARD));
    expect(cardDigest({ ...CARD, author: "someone-else" })).toBe(
      cardDigest({ ...CARD, author: "berti" }),
    );
  });

  it("ignores provenance", () => {
    expect(cardDigest({ ...CARD, provenance: "https://example.test/a" })).toBe(cardDigest(CARD));
  });

  it("ignores both at once — the §4 dedup case, same node from two contributors", () => {
    const mine: NodeCard = { ...CARD, author: "berti", provenance: "local" };
    const yours: NodeCard = { ...CARD, author: "ada", provenance: "imported" };
    expect(cardDigest(mine)).toBe(cardDigest(yours));
  });

  it("treats an explicitly undefined author like an absent one", () => {
    expect(cardDigest({ ...CARD, author: undefined })).toBe(cardDigest(CARD));
  });
});

describe("cardDigest — included fields", () => {
  const changed: ReadonlyArray<[string, NodeCard]> = [
    ["id", { ...CARD, id: "solver-b" }],
    ["name", { ...CARD, name: "Solver B" }],
    ["type", { ...CARD, type: "tool" }],
    ["action", { ...CARD, action: "Draft a candidate solution for the subtask" }],
    ["model", { ...CARD, model: "claude-opus" }],
    ["agent", { ...CARD, agent: "runner" }],
    ["tools", { ...CARD, tools: ["web-search"] }],
    ["params", { ...CARD, params: { retries: 3 } }],
    ["inputs", { ...CARD, inputs: [{ name: "task", type: "prompt" }] }],
    ["outputs", { ...CARD, outputs: [{ name: "draft", type: "report" }] }],
    ["dependencies", { ...CARD, dependencies: ["planner"] }],
    ["requiresHuman", { ...CARD, requiresHuman: true }],
    ["riskMarkers", { ...CARD, riskMarkers: ["pii-handling"] }],
    ["notes", { ...CARD, notes: "watch the token budget" }],
    ["version", { ...CARD, version: "1.0.1" }],
    ["ontologyVersion", { ...CARD, ontologyVersion: "1.1.0" }],
  ];

  it.each(changed)("changes when %s changes", (_field, card) => {
    expect(cardDigest(card)).not.toBe(cardDigest(CARD));
  });

  it("gives every variant a distinct digest", () => {
    const digests = new Set(changed.map(([, card]) => cardDigest(card)));
    expect(digests.size).toBe(changed.length);
  });

  it("notices a port becoming optional", () => {
    expect(cardDigest({ ...CARD, inputs: [{ name: "task", type: "text", required: false }] })).not.toBe(
      cardDigest(CARD),
    );
  });
});

describe("cardDigest — key order does not matter", () => {
  it("collapses two cards written with the keys in different order", () => {
    const a: NodeCard = {
      id: "solver-a",
      name: "Solver A",
      type: "agent",
      phase: "implementation",
      action: "Draft a candidate solution for the sub-task",
      spec: "Read the sub-task and write one candidate solution to the draft port.",
      tools: ["web-search"],
      params: { retries: 3, backoff: { kind: "exponential", factor: 1.5 } },
      inputs: [{ name: "task", type: "text" }],
      outputs: [{ name: "draft", type: "json" }],
      dependencies: [],
      requiresHuman: false,
      riskMarkers: [],
      version: "1.0.0",
      ontologyVersion: "0.1.0",
    };
    const b: NodeCard = {
      ontologyVersion: "0.1.0",
      version: "1.0.0",
      riskMarkers: [],
      requiresHuman: false,
      dependencies: [],
      outputs: [{ type: "json", name: "draft" }],
      inputs: [{ type: "text", name: "task" }],
      params: { backoff: { factor: 1.5, kind: "exponential" }, retries: 3 },
      tools: ["web-search"],
      spec: "Read the sub-task and write one candidate solution to the draft port.",
      action: "Draft a candidate solution for the sub-task",
      phase: "implementation",
      type: "agent",
      name: "Solver A",
      id: "solver-a",
    };
    expect(cardDigest(a)).toBe(cardDigest(b));
  });

  it("still distinguishes array order, which is content and not formatting", () => {
    const reordered: NodeCard = {
      ...CARD,
      inputs: [
        { name: "task", type: "text" },
        { name: "context", type: "json" },
      ],
    };
    const swapped: NodeCard = {
      ...CARD,
      inputs: [
        { name: "context", type: "json" },
        { name: "task", type: "text" },
      ],
    };
    expect(cardDigest(reordered)).not.toBe(cardDigest(swapped));
  });
});

describe("bundleDigest", () => {
  const dot = "digraph G { a -> b }";

  it("is sha256: followed by 64 hex characters", () => {
    expect(bundleDigest({ dot, cardDigests: [] })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("matches the SHA-256 of its canonical payload", () => {
    expect(bundleDigest({ dot, cardDigests: ["sha256:aaa", "sha256:bbb"] })).toBe(
      "sha256:a782449a8d73091a4350e69e8d6fad6b9fa94dd2ac46dd6c5ebd7a79b3c06465",
    );
  });

  it("ignores the order the card digests arrived in", () => {
    const one = bundleDigest({ dot, cardDigests: ["sha256:aaa", "sha256:bbb", "sha256:ccc"] });
    const two = bundleDigest({ dot, cardDigests: ["sha256:ccc", "sha256:aaa", "sha256:bbb"] });
    expect(one).toBe(two);
  });

  it("does not mutate the array it is given", () => {
    const cardDigests = ["sha256:ccc", "sha256:aaa"];
    bundleDigest({ dot, cardDigests });
    expect(cardDigests).toEqual(["sha256:ccc", "sha256:aaa"]);
  });

  it("changes when the DOT source changes", () => {
    expect(bundleDigest({ dot: "digraph G { a -> c }", cardDigests: [] })).not.toBe(
      bundleDigest({ dot, cardDigests: [] }),
    );
  });

  it("notices whitespace in the DOT source — the source is stored verbatim", () => {
    expect(bundleDigest({ dot: "digraph G {a -> b}", cardDigests: [] })).not.toBe(
      bundleDigest({ dot, cardDigests: [] }),
    );
  });

  it("changes when a card digest changes", () => {
    expect(bundleDigest({ dot, cardDigests: ["sha256:aaa"] })).not.toBe(
      bundleDigest({ dot, cardDigests: ["sha256:aab"] }),
    );
  });

  it("does not deduplicate: pinning a card twice is a different bundle", () => {
    expect(bundleDigest({ dot, cardDigests: ["sha256:aaa", "sha256:aaa"] })).not.toBe(
      bundleDigest({ dot, cardDigests: ["sha256:aaa"] }),
    );
  });

  it("keeps the two fields apart — no digest can be smuggled in through the DOT", () => {
    expect(bundleDigest({ dot: "", cardDigests: ["x"] })).not.toBe(
      bundleDigest({ dot: "x", cardDigests: [] }),
    );
  });
});

describe("shortDigest", () => {
  it("keeps the algorithm prefix and eight hex characters", () => {
    expect(shortDigest(`sha256:${"ab12cd34".padEnd(64, "0")}`)).toBe("sha256:ab12cd34");
  });

  it("shortens a real card digest to 15 characters", () => {
    const short = shortDigest(cardDigest(CARD));
    expect(short).toBe("sha256:e1bd7cc7");
    expect(short).toHaveLength("sha256:".length + 8);
  });

  it("truncates a bare hash with no prefix", () => {
    expect(shortDigest("ab12cd34ef56")).toBe("ab12cd34");
  });

  it("returns short input unchanged instead of padding or throwing", () => {
    expect(shortDigest("sha256:ab")).toBe("sha256:ab");
    expect(shortDigest("")).toBe("");
  });

  it("is idempotent", () => {
    const once = shortDigest(cardDigest(CARD));
    expect(shortDigest(once)).toBe(once);
  });
});
