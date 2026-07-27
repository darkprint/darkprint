import { describe, expect, it } from "vitest";

import type { NodeCard } from "../card/schema";
import { bumpSatisfies, declaredBump, inferBump, type BumpLevel } from "./bump";

const BASE: NodeCard = {
  id: "solver-a",
  name: "Solver A",
  type: "agent",
  phase: "implementation",
  action: "Draft a candidate solution for the sub-task",
  spec: "Read the sub-task on `task` and write one candidate solution to `draft`.",
  tools: ["web-search"],
  params: { retries: 3 },
  inputs: [{ name: "task", type: "text" }],
  outputs: [{ name: "draft", type: "json" }],
  dependencies: ["planner"],
  requiresHuman: false,
  riskMarkers: [],
  version: "1.0.0",
  ontologyVersion: "0.1.0",
};

/** `next` differs from BASE only by the given patch. */
function next(patch: Partial<NodeCard>): NodeCard {
  return { ...BASE, ...patch };
}

describe("inferBump — no change", () => {
  it("is none for an identical card", () => {
    expect(inferBump(BASE, { ...BASE })).toEqual({ level: "none", reasons: [] });
  });

  it("ignores the version itself — that is the thing being decided", () => {
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

describe("inferBump — major", () => {
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
    [
      "requires_human flips false to true",
      next({ requiresHuman: true }),
      /`requires_human` changed false → true/,
    ],
    ["the node type changes", next({ type: "tool" }), /node type changed: agent → tool/],
    ["the card id changes", next({ id: "solver-b" }), /card id changed: solver-a → solver-b/],
    // Doc 3 §2 via the spec's §3 note: the phase is what phase coverage buckets by, so
    // moving it changes a published property of every blueprint that pinned this card.
    [
      "the phase changes",
      next({ phase: "testing" }),
      /phase changed: implementation → testing/,
    ],
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
    // breaks — but the bytes differ, so the safety net still demands a bump.
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

describe("inferBump — minor", () => {
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
      /`spec` changed — the instruction handed to the agent is different/,
    ],
    [
      "a dependency is added",
      next({ dependencies: ["planner", "router"] }),
      /dependency `router` was added/,
    ],
    [
      "requires_human flips true to false",
      { ...next({ requiresHuman: false }) },
      /`requires_human` changed true → false/,
    ],
  ])("is minor when %s", (name, candidate, reason) => {
    const previous = name.includes("true to false") ? next({ requiresHuman: true }) : BASE;
    const analysis = inferBump(previous, candidate);
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
      "`spec` changed — the instruction handed to the agent is different",
      "`action` wording changed",
    ]);
  });

  it("does not quote the spec text into the reason", () => {
    const analysis = inferBump(BASE, next({ spec: "x".repeat(4000) }));
    expect(analysis.reasons[0]).not.toContain("xxx");
    expect(analysis.reasons[0].length).toBeLessThan(80);
  });
});

describe("inferBump — patch", () => {
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
    [
      "the ontology version changes",
      next({ ontologyVersion: "0.2.0" }),
      "`ontology_version` changed: 0.1.0 → 0.2.0",
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
    [
      "the model changes",
      next({ model: "claude-opus" }),
      '`model` changed: (none) → "claude-opus"',
    ],
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

describe("inferBump — combinations and edge cases", () => {
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

  it("takes the phase over everything else it also found", () => {
    // A phase move is major; nothing weaker may bury it, however much else changed.
    const analysis = inferBump(
      BASE,
      next({ phase: "debugging", spec: "Read the failure evidence and produce a targeted fix.", notes: "n" }),
    );
    expect(analysis.level).toBe("major");
    expect(analysis.reasons[0]).toContain("phase changed: implementation → debugging");
    expect(analysis.reasons).toHaveLength(3);
  });

  it("survives a card with empty everything", () => {
    // Structurally empty, not validator-clean: `action`, `spec` and the ports would all
    // be rejected upstream. `inferBump` is asked to compare, not to judge.
    const empty: NodeCard = {
      id: "x",
      name: "X",
      type: "tool",
      phase: "planning",
      action: "",
      spec: "",
      tools: [],
      params: {},
      inputs: [],
      outputs: [],
      dependencies: [],
      requiresHuman: false,
      riskMarkers: [],
      version: "0.0.1",
      ontologyVersion: "0.1.0",
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

  it("accepts a major bump on a trivial change — stronger is always allowed", () => {
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
