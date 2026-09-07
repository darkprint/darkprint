import { describe, expect, it } from "vitest";

import type { NodeCard } from "../card/schema";
import { bumpSatisfies, declaredBump, inferBump, type BumpLevel } from "./bump";

const BASE: NodeCard = {
  id: "solver-a",
  name: "Solver A",
  type: "agent",
  phases: ["implementation"],
  action: "Draft a candidate solution for the sub-task",
  spec: "Read the sub-task on `task` and write one candidate solution to `draft`.",
  tools: ["web-search"],
  mcp: ["filesystem"],
  params: { retries: 3 },
  inputs: [{ name: "task", type: "text" }],
  outputs: [{ name: "draft", type: "json" }],
  dependencies: ["planner"],
  cannot: [],
  willNot: [],
  riskMarkers: [],
  version: "1.0.0",
};

/** `next` differs from BASE only by the given patch. */
function next(patch: Partial<NodeCard>): NodeCard {
  return { ...BASE, ...patch };
}

describe("inferBump, no change", () => {
  it("is none for an identical card", () => {
    expect(inferBump(BASE, { ...BASE })).toEqual({ level: "none", reasons: [] });
  });

  it("ignores the version itself, that is the thing being decided", () => {
    expect(inferBump(BASE, next({ version: "9.9.9" })).level).toBe("none");
  });

  it("ignores author and provenance, exactly as cardDigest does", () => {
    expect(inferBump(BASE, next({ author: "ada", provenance: "imported" })).level).toBe("none");
  });

  it("ignores the order of params keys", () => {
    const before = next({ params: { retries: 3, timeout: 30 } });
    const after = next({ params: { timeout: 30, retries: 3 } });
    expect(inferBump(before, after).level).toBe("none");
  });
});

describe("inferBump, major", () => {
  it.each<[string, NodeCard, RegExp]>([
    [
      "an input is removed",
      next({ inputs: [] }),
      /input `task` was removed/,
    ],
    [
      "an output is removed",
      next({ outputs: [] }),
      /output `draft` was removed/,
    ],
    [
      "an input is renamed",
      next({ inputs: [{ name: "job", type: "text" }] }),
      /input `task` was removed/,
    ],
    [
      "an input type changes",
      next({ inputs: [{ name: "task", type: "markdown" }] }),
      /input `task` changed type: text → markdown/,
    ],
    [
      "an output type changes",
      next({ outputs: [{ name: "draft", type: "report" }] }),
      /output `draft` changed type: json → report/,
    ],
    [
      "a new required input is added",
      next({
        inputs: [
          { name: "task", type: "text" },
          { name: "context", type: "json" },
        ],
      }),
      /required input `context` was added/,
    ],
    /* Staffing a node is priced here, and only here. There used to be a second row for
       `requires_human` flipping false → true, major because it invalidated every autonomy
       score computed against the card. The field is gone and the answer comes off `type`,
       so this row now carries both consequences: a re-typed card breaks the wiring a
       blueprint pinned AND moves whether a person acts at the node. */
    ["the node type changes", next({ type: "tool" }), /node type changed: agent → tool/],
    [
      "the node type becomes a human gate",
      next({ type: "human-gate" }),
      /node type changed: agent → human-gate/,
    ],
    ["the card id changes", next({ id: "solver-b" }), /card id changed: solver-a → solver-b/],
  ])("is major when %s", (_name, candidate, reason) => {
    const analysis = inferBump(BASE, candidate);
    expect(analysis.level).toBe("major");
    expect(analysis.reasons.join(" | ")).toMatch(reason);
  });

  it("is major when an optional input becomes required", () => {
    const before = next({ inputs: [{ name: "task", type: "text", required: false }] });
    const after = next({ inputs: [{ name: "task", type: "text", required: true }] });
    const analysis = inferBump(before, after);
    expect(analysis.level).toBe("major");
    expect(analysis.reasons).toContain("input `task` is now required");
  });

  it("treats an input that was explicitly optional as optional, not merely absent", () => {
    const before = next({ inputs: [{ name: "task", type: "text", required: false }] });
    const after = next({ inputs: [{ name: "task", type: "text" }] });
    // `required` defaults to true, so leaving it out makes the input required again.
    expect(inferBump(before, after).level).toBe("major");
  });

  it("falls back to a patch when only the written form of a default changes", () => {
    // `required: true` is what an absent `required` already meant, so nothing
    // breaks, but the bytes differ, so the safety net still demands a bump.
    const after = next({ inputs: [{ name: "task", type: "text", required: true }] });
    expect(inferBump(BASE, after)).toEqual({ level: "patch", reasons: ["card content changed"] });
  });

  it("reports a rename as both halves of the diff", () => {
    const analysis = inferBump(BASE, next({ inputs: [{ name: "job", type: "text" }] }));
    expect(analysis.reasons).toEqual([
      "input `task` was removed",
      "required input `job` was added",
    ]);
  });

  it("puts the strongest reasons first", () => {
    const analysis = inferBump(
      BASE,
      next({ name: "Solver B", tools: ["web-search", "http-fetch"], inputs: [] }),
    );
    expect(analysis.level).toBe("major");
    expect(analysis.reasons[0]).toBe("input `task` was removed");
    expect(analysis.reasons).toEqual([
      "input `task` was removed",
      "tool `http-fetch` was added",
      '`name` changed: "Solver A" → "Solver B"',
    ]);
  });
});

describe("inferBump, minor", () => {
  it.each<[string, NodeCard, RegExp]>([
    [
      "an optional input is added",
      next({
        inputs: [
          { name: "task", type: "text" },
          { name: "context", type: "json", required: false },
        ],
      }),
      /optional input `context` was added/,
    ],
    [
      "an output is added",
      next({
        outputs: [
          { name: "draft", type: "json" },
          { name: "trace", type: "report" },
        ],
      }),
      /output `trace` was added/,
    ],
    ["a tool is added", next({ tools: ["web-search", "http-fetch"] }), /tool `http-fetch` was added/],
    [
      "a param key is added",
      next({ params: { retries: 3, timeout: 30 } }),
      /parameter `timeout` was added/,
    ],
    [
      "risk markers grow",
      next({ riskMarkers: ["secret-access"] }),
      /risk marker `secret-access` was declared/,
    ],
    // Doc 1 §3.2: rewriting the instruction the agent runs changes behaviour, and leaves
    // every port, type and param a blueprint declared against exactly where it was.
    [
      "the spec is rewritten",
      next({ spec: "Read the sub-task and write a solution. Never open the criteria." }),
      /`spec` changed, the instruction handed to the agent is different/,
    ],
    [
      "a dependency is added",
      next({ dependencies: ["planner", "router"] }),
      /dependency `router` was added/,
    ],
  ])("is minor when %s", (_name, candidate, reason) => {
    const analysis = inferBump(BASE, candidate);
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons.join(" | ")).toMatch(reason);
  });

  it("does not let a minor change hide behind a patch one", () => {
    const analysis = inferBump(BASE, next({ notes: "careful", tools: ["web-search", "sql"] }));
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual(["tool `sql` was added", "`notes` changed"]);
  });

  it("ranks a rewritten `spec` above a reworded `action`", () => {
    // The two live in the same §3.2 block and are easy to confuse: `action` is a label
    // for the operation (patch), `spec` is the operation (minor).
    const analysis = inferBump(
      BASE,
      next({ action: "Draft a solution", spec: "Write one candidate solution for the sub-task you are given." }),
    );
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual([
      "`spec` changed, the instruction handed to the agent is different",
      "`action` wording changed",
    ]);
  });

  it("does not quote the spec text into the reason", () => {
    const analysis = inferBump(BASE, next({ spec: "x".repeat(4000) }));
    expect(analysis.reasons[0]).not.toContain("xxx");
    expect(analysis.reasons[0].length).toBeLessThan(80);
  });
});

describe("inferBump, the phase set (the documented reversal)", () => {
  // `inferBump` used to call any phase change MAJOR: phase coverage re-buckets, and a
  // blueprint that covered five phases would silently cover four. That reasoning rested on
  // the phase being a required, exactly-one field. The author's ruling withdrew it, the
  // five phases describe the factory, not every node in it, so the field is optional and
  // repeatable, coverage is a description of scope rather than a figure anyone pinned, and
  // a phase edit breaks no wiring and invalidates no published score. Minor, both ways.
  it("is minor when the phase moves", () => {
    const analysis = inferBump(BASE, next({ phases: ["testing"] }));
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual([
      "phase `implementation` was withdrawn",
      "phase `testing` was declared",
    ]);
  });

  it("is minor when a second phase is added", () => {
    const analysis = inferBump(BASE, next({ phases: ["implementation", "debugging"] }));
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual(["phase `debugging` was declared"]);
  });

  it("is minor when the only phase is dropped, not patch", () => {
    // Deliberately not folded into `compareList`, whose convention makes a removal a patch
    // because "the card claims less" and nothing a blueprint wired against moved. A phase
    // is not a wiring claim, so dropping one is the same size of edit as adding one, and
    // treating it as a patch would let the sixteen cards the content sweep unphases ship
    // as bugfix releases.
    const analysis = inferBump(BASE, next({ phases: [] }));
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual(["phase `implementation` was withdrawn"]);
  });

  it("is minor when a card that had none declares one", () => {
    const before = next({ phases: [] });
    const analysis = inferBump(before, next({ phases: ["planning"] }));
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual(["phase `planning` was declared"]);
  });

  it("is none when neither version declares a phase", () => {
    const before = next({ phases: [] });
    expect(inferBump(before, next({ phases: [] }))).toEqual({ level: "none", reasons: [] });
  });

  it("is patch for a pure reorder, which restates the same set", () => {
    const before = next({ phases: ["implementation", "debugging"] });
    const after = next({ phases: ["debugging", "implementation"] });
    const analysis = inferBump(before, after);
    expect(analysis.level).toBe("patch");
    expect(analysis.reasons).toEqual(["`phase` entries were reordered"]);
  });

  it("reports both halves of a swap", () => {
    const before = next({ phases: ["planning", "implementation"] });
    const after = next({ phases: ["implementation", "testing"] });
    const analysis = inferBump(before, after);
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual([
      "phase `planning` was withdrawn",
      "phase `testing` was declared",
    ]);
  });
});

describe("inferBump, `cannot`, whose two directions are inverted", () => {
  // Every other list on the card is a claim, so `compareList` makes growth minor and
  // shrinkage patch. A prohibition constrains what may be wired *into* the node, so both
  // directions turn over: adding narrows the contract and can start failing a graph
  // nobody touched, withdrawing widens what the node accepts and fails nothing.
  it("is major when a prohibition is declared", () => {
    const analysis = inferBump(BASE, next({ cannot: ["acceptance-criteria"] }));
    expect(analysis.level).toBe("major");
    expect(analysis.reasons).toEqual([
      "prohibition `acceptance-criteria` was declared, which narrows what the node accepts",
    ]);
  });

  it("is major whatever the term is, since every entry here is one the resolver reads", () => {
    /* This cell used to assert the same level for `cannot: ["never opens a shell"]`, on the
       ground that the bump could not depend on whether the vocabulary happened to define
       the entry today. That reasoning belonged to the conflated field. A sentence is a
       `card/unknown-term` in `cannot` now, so the case it described is unreachable, and the
       question it was really asking — does the level depend on which entry it is — is what
       this asks against a second real term. */
    const analysis = inferBump(BASE, next({ cannot: ["plan"] }));
    expect(analysis.level).toBe("major");
    expect(analysis.reasons[0]).toContain("`plan` was declared");
  });

  it("is minor when a prohibition is withdrawn", () => {
    const before = next({ cannot: ["acceptance-criteria"] });
    const analysis = inferBump(before, BASE);
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual(["prohibition `acceptance-criteria` was withdrawn"]);
  });

  it("is not symmetric: declaring breaks a pinned blueprint, withdrawing does not", () => {
    const strict = next({ cannot: ["acceptance-criteria"] });
    expect(inferBump(BASE, strict).level).toBe("major");
    expect(inferBump(strict, BASE).level).toBe("minor");
  });

  it("is patch for a pure reorder, which prohibits the same set", () => {
    const before = next({ cannot: ["acceptance-criteria", "plan"] });
    const after = next({ cannot: ["plan", "acceptance-criteria"] });
    expect(inferBump(before, after)).toEqual({
      level: "patch",
      reasons: ["`cannot` entries were reordered"],
    });
  });

  it("reports both halves of a swap and takes the stronger one", () => {
    const before = next({ cannot: ["acceptance-criteria"] });
    const after = next({ cannot: ["plan"] });
    const analysis = inferBump(before, after);
    expect(analysis.level).toBe("major");
    expect(analysis.reasons).toEqual([
      "prohibition `plan` was declared, which narrows what the node accepts",
      "prohibition `acceptance-criteria` was withdrawn",
    ]);
  });

  it("does not split entries on a space when deciding a reorder", () => {
    // The separator has to be a character the values exclude. `will_not` entries really are
    // free text, so joining on a space would read ["a b"] and ["a", "b"] as one list and
    // call this a reorder. It is not one: "no shell" is gone and two other undertakings
    // arrived. Pinned to `major` rather than merely "not patch" so the cell still fails if
    // the reorder branch swallows it, and fails differently if D-108's withdrawal level
    // moves. The withdrawal dominates the two additions, which is what `major` records.
    const before = next({ willNot: ["no shell"] });
    const after = next({ willNot: ["no", "shell"] });
    expect(inferBump(before, after).level).toBe("major");
  });

  it("is none when neither version prohibits anything", () => {
    expect(inferBump(BASE, next({ cannot: [] }))).toEqual({ level: "none", reasons: [] });
  });
});

describe("inferBump, `will_not`, which breaks in the opposite direction from `cannot`", () => {
  /* D-108, owner ruling of 2026-08-30. The field nothing in the engine reads, which is why
     it is priced on the way OUT rather than the way in: because no resolver will ever tell a
     reader that a published undertaking disappeared, the version number is the only witness
     they get. `compareWillNot` carries the argument. These cells hold BOTH directions,
     because an asymmetry that is deliberate and one that is a leftover look identical until
     one side moves. */
  it("is minor when an undertaking is stated", () => {
    const analysis = inferBump(BASE, next({ willNot: ["never opens a shell"] }));
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual(["promise `never opens a shell` was added"]);
  });

  it("is major when an undertaking is withdrawn, since nothing else reports the loss", () => {
    const before = next({ willNot: ["never opens a shell"] });
    const analysis = inferBump(before, BASE);
    expect(analysis.level).toBe("major");
    expect(analysis.reasons).toEqual([
      "promise `never opens a shell` was withdrawn (nothing checks this automatically)",
    ]);
  });

  it("inverts `cannot`: one is major on the way in, the other on the way out", () => {
    // All four corners, so neither field can quietly drift onto the other's schedule.
    // `cannot` narrows what the node accepts and can break a graph nobody touched, so it is
    // major when it GAINS an entry. `will_not` binds nothing and can only disappoint a
    // reader, so it is major when it LOSES one.
    const withCannot = next({ cannot: ["acceptance-criteria"] });
    const withWillNot = next({ willNot: ["acceptance criteria in prose"] });

    expect(inferBump(BASE, withCannot).level).toBe("major");
    expect(inferBump(withCannot, BASE).level).toBe("minor");
    expect(inferBump(BASE, withWillNot).level).toBe("minor");
    expect(inferBump(withWillNot, BASE).level).toBe("major");
  });

  it("is patch for a pure reorder, which undertakes the same set", () => {
    const before = next({ willNot: ["no shell", "no network"] });
    const after = next({ willNot: ["no network", "no shell"] });
    expect(inferBump(before, after)).toEqual({
      level: "patch",
      reasons: ["`will_not` entries were reordered"],
    });
  });
});

describe("inferBump, `mcp`, `skill` and `model`", () => {
  it("is minor when an MCP server is added, exactly as for a tool", () => {
    const analysis = inferBump(BASE, next({ mcp: ["filesystem", "github"] }));
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual(["MCP server `github` was added"]);
  });

  it("is patch when an MCP server is removed, the card asks for less", () => {
    const analysis = inferBump(BASE, next({ mcp: [] }));
    expect(analysis.level).toBe("patch");
    expect(analysis.reasons).toEqual(["MCP server `filesystem` was removed"]);
  });

  it("is patch when the MCP list is only reordered", () => {
    const before = next({ mcp: ["filesystem", "github"] });
    const after = next({ mcp: ["github", "filesystem"] });
    expect(inferBump(before, after)).toEqual({
      level: "patch",
      reasons: ["`mcp` entries were reordered"],
    });
  });

  it("is minor when a skill is pointed at for the first time", () => {
    const analysis = inferBump(BASE, next({ skill: "skills/solver.md" }));
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual([
      '`skill` changed: (none) → "skills/solver.md"',
    ]);
  });

  it("is minor when the skill is repointed", () => {
    const before = next({ skill: "skills/solver.md" });
    const after = next({ skill: "skills/solver-v2.md" });
    const analysis = inferBump(before, after);
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual([
      '`skill` changed: "skills/solver.md" → "skills/solver-v2.md"',
    ]);
  });

  it("is minor when the skill pointer is withdrawn", () => {
    // Same size of edit in the other direction: the definition of the node's behaviour
    // moved, and no port, type or param a blueprint declared against did.
    const before = next({ skill: "skills/solver.md" });
    const analysis = inferBump(before, BASE);
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual(['`skill` changed: "skills/solver.md" → (none)']);
  });

  it("is minor when the model is named for the first time", () => {
    // Engine spec §2.6 makes `llm_model` overridable by the graph's stylesheet and §8.5
    // resolves it from the node attribute, the sheet and the graph default in that order,
    // so the field is the default the card was written against. Naming one changes what
    // the node runs on and moves no port, type, param or prohibition with it.
    const analysis = inferBump(BASE, next({ model: "claude-opus-5" }));
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual(['`model` changed: (none) → "claude-opus-5"']);
  });

  it("is minor when the model is swapped", () => {
    const before = next({ model: "claude-sonnet-5" });
    const after = next({ model: "claude-opus-5" });
    const analysis = inferBump(before, after);
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual([
      '`model` changed: "claude-sonnet-5" → "claude-opus-5"',
    ]);
  });

  it("is minor when the model is withdrawn, since the node falls back to the graph", () => {
    const before = next({ model: "claude-opus-5" });
    const analysis = inferBump(before, BASE);
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual(['`model` changed: "claude-opus-5" → (none)']);
  });

  it("stays under a declared prohibition, which is the contrast the level rests on", () => {
    // The two edits in one diff: an overridable default moved, and an entry was added to
    // `cannot`, which can fail a graph nobody touched. Only the second is major.
    const analysis = inferBump(
      BASE,
      next({ model: "claude-opus-5", cannot: ["acceptance-criteria"] }),
    );
    expect(analysis.level).toBe("major");
    expect(analysis.reasons).toEqual([
      "prohibition `acceptance-criteria` was declared, which narrows what the node accepts",
      '`model` changed: (none) → "claude-opus-5"',
    ]);
  });

  it("outranks `agent`, which no runner reads", () => {
    const analysis = inferBump(BASE, next({ model: "claude-opus-5", agent: "Solver A" }));
    expect(analysis.level).toBe("minor");
    expect(analysis.reasons).toEqual([
      '`model` changed: (none) → "claude-opus-5"',
      '`agent` changed: (none) → "Solver A"',
    ]);
  });

  it("ranks a declared prohibition above everything else in the same diff", () => {
    const analysis = inferBump(
      BASE,
      next({ cannot: ["acceptance-criteria"], mcp: [], skill: "skills/solver.md" }),
    );
    expect(analysis.level).toBe("major");
    expect(analysis.reasons).toEqual([
      "prohibition `acceptance-criteria` was declared, which narrows what the node accepts",
      '`skill` changed: (none) → "skills/solver.md"',
      "MCP server `filesystem` was removed",
    ]);
  });
});

describe("inferBump, patch", () => {
  it.each<[string, NodeCard, string]>([
    ["the name changes", next({ name: "Solver B" }), '`name` changed: "Solver A" → "Solver B"'],
    ["the action is reworded", next({ action: "Draft a solution" }), "`action` wording changed"],
    ["notes are added", next({ notes: "watch the token budget" }), "`notes` changed"],
    [
      "a param value changes",
      next({ params: { retries: 5 } }),
      "parameter `retries` changed: 3 → 5",
    ],
    [
      "a port description is added",
      next({ inputs: [{ name: "task", type: "text", description: "the sub-task" }] }),
      "input `task` description changed",
    ],
    // §4's minor rule is about the declared surface *growing*; these all shrink it or
    // leave it alone, so "patch otherwise" applies and a legitimate patch release is
    // not rejected by `card/version-bump-too-small`.
    [
      "an input becomes optional",
      next({ inputs: [{ name: "task", type: "text", required: false }] }),
      "input `task` is no longer required",
    ],
    ["a tool is removed", next({ tools: [] }), "tool `web-search` was removed"],
    ["a param key is removed", next({ params: {} }), "parameter `retries` was removed"],
    ["a dependency is removed", next({ dependencies: [] }), "dependency `planner` was removed"],
    ["the agent changes", next({ agent: "runner" }), '`agent` changed: (none) → "runner"'],
  ])("is patch when %s", (_name, candidate, reason) => {
    const analysis = inferBump(BASE, candidate);
    expect(analysis.level).toBe("patch");
    expect(analysis.reasons).toContain(reason);
  });

  it("is patch when a risk marker is withdrawn", () => {
    const before = next({ riskMarkers: ["secret-access"] });
    const analysis = inferBump(before, BASE);
    expect(analysis.level).toBe("patch");
    expect(analysis.reasons).toContain("risk marker `secret-access` was withdrawn");
  });

  it("is patch when ports are only reordered", () => {
    const before = next({
      inputs: [
        { name: "task", type: "text" },
        { name: "context", type: "json" },
      ],
    });
    const after = next({
      inputs: [
        { name: "context", type: "json" },
        { name: "task", type: "text" },
      ],
    });
    expect(inferBump(before, after)).toEqual({
      level: "patch",
      reasons: ["input ports were reordered"],
    });
  });

  it("is patch when a list field is only reordered", () => {
    const before = next({ tools: ["web-search", "http-fetch"] });
    const after = next({ tools: ["http-fetch", "web-search"] });
    expect(inferBump(before, after)).toEqual({
      level: "patch",
      reasons: ["`tools` were reordered"],
    });
  });

  it("elides a long value instead of dumping it into the reason", () => {
    const long = "x".repeat(200);
    const analysis = inferBump(BASE, next({ name: long }));
    expect(analysis.reasons[0]).toContain("…");
    expect(analysis.reasons[0].length).toBeLessThan(80);
  });

  it("compares nested param values structurally, not by reference", () => {
    const before = next({ params: { backoff: { kind: "exponential", factor: 1.5 } } });
    const same = next({ params: { backoff: { factor: 1.5, kind: "exponential" } } });
    const different = next({ params: { backoff: { kind: "exponential", factor: 2 } } });
    expect(inferBump(before, same).level).toBe("none");
    expect(inferBump(before, different).level).toBe("patch");
  });
});

describe("inferBump, combinations and edge cases", () => {
  it("keeps every reason, not just the decisive one", () => {
    const analysis = inferBump(
      BASE,
      next({
        inputs: [{ name: "task", type: "markdown" }],
        tools: [],
        notes: "rewritten",
      }),
    );
    expect(analysis.level).toBe("major");
    expect(analysis.reasons).toHaveLength(3);
  });

  it("does not let a phase move outrank the interface changes beside it", () => {
    // The reversal, stated where it is easiest to get wrong: a phase edit is minor now, so
    // a diff that also removes an output is major *because of the output*, and the phase
    // reason sorts below it rather than deciding the level.
    const analysis = inferBump(
      BASE,
      next({ phases: ["debugging"], outputs: [] }),
    );
    expect(analysis.level).toBe("major");
    expect(analysis.reasons[0]).toBe("output `draft` was removed");
    expect(analysis.reasons.join(" | ")).toContain("phase `debugging` was declared");
  });

  it("survives a card with empty everything", () => {
    // Structurally empty, not validator-clean: `action`, `spec` and the ports would all
    // be rejected upstream. `inferBump` is asked to compare, not to judge.
    const empty: NodeCard = {
      id: "x",
      name: "X",
      type: "tool",
      phases: ["planning"],
      action: "",
      spec: "",
      tools: [],
      mcp: [],
      params: {},
      inputs: [],
      outputs: [],
      dependencies: [],
      cannot: [],
      willNot: [],
      riskMarkers: [],
      version: "0.0.1",
    };
    expect(inferBump(empty, { ...empty })).toEqual({ level: "none", reasons: [] });
    expect(inferBump(empty, { ...empty, outputs: [{ name: "o", type: "any" }] }).level).toBe(
      "minor",
    );
  });

  it("does not throw on params that have no JSON form", () => {
    // `JsonValue` admits Infinity even though JSON does not, so a malformed upload
    // can reach here. The validator must get a diagnostic, never an exception.
    const before = next({ params: { bad: Number.POSITIVE_INFINITY } });
    const after = next({ params: { bad: 1 } });
    expect(() => inferBump(before, after)).not.toThrow();
    expect(inferBump(before, after).level).toBe("patch");
  });

  it("is not symmetric: reversing the diff can change the level", () => {
    const optional = next({ inputs: [{ name: "task", type: "text", required: false }] });
    // Relaxing a requirement breaks nothing; tightening it breaks every caller.
    expect(inferBump(BASE, optional).level).toBe("patch");
    expect(inferBump(optional, BASE).level).toBe("major");
  });

  it("does not mutate either card", () => {
    const before = { ...BASE };
    const after = next({ tools: [] });
    inferBump(before, after);
    expect(before).toEqual(BASE);
    expect(after.tools).toEqual([]);
  });
});

describe("declaredBump", () => {
  it.each<[string, string, BumpLevel]>([
    ["1.0.0", "2.0.0", "major"],
    ["1.0.0", "1.1.0", "minor"],
    ["1.0.0", "1.0.1", "patch"],
    ["1.0.0", "1.0.0", "none"],
    ["1.9.9", "2.0.0", "major"],
    ["1.0.0", "1.1.1", "minor"],
    ["1.0.0", "2.1.3", "major"],
    ["0.1.0", "0.2.0", "minor"],
    ["1.0.0-rc.1", "1.0.0", "patch"],
    ["1.0.0-rc.1", "1.0.0-rc.2", "patch"],
    ["1.0.0", "2.0.0-rc.1", "major"],
    ["1.0.0", "1.1.0-rc.1", "minor"],
  ])("reads %s → %s as %s", (before, after, expected) => {
    expect(declaredBump(before, after)).toBe(expected);
  });

  it.each([
    ["a downgrade", "2.0.0", "1.0.0"],
    ["a prerelease that is older", "1.0.0", "1.0.0-rc.1"],
    ["an unparseable previous version", "latest", "1.0.0"],
    ["an unparseable next version", "1.0.0", "latest"],
    ["two unparseable versions", "a", "b"],
    ["an empty next version", "1.0.0", ""],
  ])("declares nothing for %s", (_name, before, after) => {
    expect(declaredBump(before, after)).toBe("none");
  });

  it("ignores build metadata", () => {
    expect(declaredBump("1.0.0", "1.0.0+build.2")).toBe("none");
  });
});

describe("bumpSatisfies", () => {
  const levels: BumpLevel[] = ["none", "patch", "minor", "major"];

  it("accepts a declared bump at least as strong as the required one", () => {
    const rank = (l: BumpLevel) => levels.indexOf(l);
    for (const declared of levels) {
      for (const required of levels) {
        expect(bumpSatisfies(declared, required)).toBe(rank(declared) >= rank(required));
      }
    }
  });

  it.each<[BumpLevel, BumpLevel]>([
    ["major", "minor"],
    ["major", "major"],
    ["minor", "patch"],
    ["patch", "patch"],
    ["patch", "none"],
    ["none", "none"],
  ])("accepts %s for a required %s", (declared, required) => {
    expect(bumpSatisfies(declared, required)).toBe(true);
  });

  it.each<[BumpLevel, BumpLevel]>([
    ["minor", "major"],
    ["patch", "major"],
    ["patch", "minor"],
    ["none", "patch"],
    ["none", "major"],
  ])("rejects %s for a required %s", (declared, required) => {
    expect(bumpSatisfies(declared, required)).toBe(false);
  });
});

describe("the §5 version-bump check these three compose into", () => {
  /** What validateCard does: the declared bump must cover the inferred one. */
  function isBigEnough(previous: NodeCard, candidate: NodeCard): boolean {
    return bumpSatisfies(
      declaredBump(previous.version, candidate.version),
      inferBump(previous, candidate).level,
    );
  }

  it("rejects a patch bump on a breaking change", () => {
    expect(isBigEnough(BASE, next({ version: "1.0.1", inputs: [] }))).toBe(false);
  });

  it("accepts a major bump on a breaking change", () => {
    expect(isBigEnough(BASE, next({ version: "2.0.0", inputs: [] }))).toBe(true);
  });

  it("accepts a major bump on a trivial change, stronger is always allowed", () => {
    expect(isBigEnough(BASE, next({ version: "2.0.0", notes: "typo" }))).toBe(true);
  });

  it("rejects republishing the same version with a changed body", () => {
    expect(isBigEnough(BASE, next({ notes: "sneaky edit" }))).toBe(false);
  });

  it("accepts an unchanged card at an unchanged version", () => {
    expect(isBigEnough(BASE, { ...BASE })).toBe(true);
  });

  it("rejects a minor bump when a tool was added and a port retyped", () => {
    expect(
      isBigEnough(
        BASE,
        next({ version: "1.1.0", tools: [], outputs: [{ name: "draft", type: "report" }] }),
      ),
    ).toBe(false);
  });
});
