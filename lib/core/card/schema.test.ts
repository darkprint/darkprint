import { describe, expect, it } from "vitest";

import { cardRef, parseCardRef, type NodeCard } from "./schema";

describe("cardRef", () => {
  it("joins id and version with @", () => {
    expect(cardRef("solver-a", "1.2.0")).toBe("solver-a@1.2.0");
  });

  it("leaves a namespaced id intact", () => {
    expect(cardRef("berti/solver-a", "0.1.0")).toBe("berti/solver-a@0.1.0");
  });
});

describe("parseCardRef round-trips", () => {
  const valid = [
    { id: "a", version: "1.0.0" },
    { id: "solver-a", version: "1.2.0" },
    { id: "solver-a-2", version: "0.0.1" },
    { id: "berti/solver-a", version: "1.2.0-beta.1" },
    { id: "ns2/x9", version: "10.20.30" },
    { id: "solver", version: "1.0.0+build.5" },
  ];

  it.each(valid)("$id@$version survives cardRef -> parseCardRef", ({ id, version }) => {
    expect(parseCardRef(cardRef(id, version))).toEqual({ id, version });
  });

  it("splits on the last @, so a stray one invalidates the ref", () => {
    expect(parseCardRef("solver-a@1.0.0@2.0.0")).toBeUndefined();
  });

  it("tolerates surrounding whitespace from hand-written DOT attributes", () => {
    expect(parseCardRef("  solver-a@1.2.0\n")).toEqual({ id: "solver-a", version: "1.2.0" });
  });
});

describe("parseCardRef rejections", () => {
  it.each([
    ["empty string", ""],
    ["whitespace only", "   "],
    ["no version — the §4 unpinned case", "solver-a"],
    ["trailing @ with no version", "solver-a@"],
    ["leading @ with no id", "@1.0.0"],
    ["empty both sides", "@"],
    ["double @", "solver-a@@1.0.0"],
    ["floating version", "solver-a@latest"],
    ["range instead of a pin", "solver-a@^1.0.0"],
    ["v prefix", "solver-a@v1.0.0"],
    ["uppercase id", "Solver-A@1.0.0"],
    ["underscore id", "solver_a@1.0.0"],
    ["trailing hyphen id", "solver-@1.0.0"],
    ["leading hyphen id", "-solver@1.0.0"],
    ["double hyphen id", "solver--a@1.0.0"],
    ["empty namespace", "/solver-a@1.0.0"],
    ["double slash namespace", "ns//solver-a@1.0.0"],
    ["nested namespace", "a/b/c@1.0.0"],
    ["space inside id", "solver a@1.0.0"],
    ["space inside version", "solver-a@1.0 .0"],
    ["dot in id", "solver.a@1.0.0"],
  ])("rejects %s", (_name, ref) => {
    expect(parseCardRef(ref)).toBeUndefined();
  });

  it("does not accept a ref that cardRef built from an illegal id", () => {
    expect(parseCardRef(cardRef("Solver A", "1.0.0"))).toBeUndefined();
  });
});

describe("NodeCard shape", () => {
  // Compile-time contract check: the minimal card of §4 with every default applied.
  const minimal: NodeCard = {
    id: "solver-a",
    name: "Solver A",
    type: "agent",
    // Doc 3 §1 makes `phase` a first-level dimension beside `type`, and doc 1 §3.2 makes
    // `spec` the payload the agent is handed. Neither is optional, so neither can be
    // absent from the minimal card.
    phases: ["implementation"],
    action: "Draft a candidate solution for the sub-task",
    spec: "Read the sub-task, draft one candidate solution, and return it as JSON on the draft port.",
    tools: [],
    // `mcp` and `cannot` default to `[]` on the wire and are required on the model, the
    // way `tools` and `risk_markers` are: an empty list is the answer for a node that
    // needs no server and declares no prohibition, and it is not an absent one.
    mcp: [],
    params: {},
    inputs: [{ name: "task", type: "text" }],
    outputs: [{ name: "draft", type: "json" }],
    dependencies: [],
    cannot: [],
    requiresHuman: false,
    riskMarkers: [],
    version: "1.0.0",
    ontologyVersion: "0.1.0",
  };

  it("accepts the minimal card and refs it", () => {
    expect(cardRef(minimal.id, minimal.version)).toBe("solver-a@1.0.0");
    expect(parseCardRef(cardRef(minimal.id, minimal.version))).toEqual({
      id: "solver-a",
      version: "1.0.0",
    });
  });

  it("holds nested JSON in params", () => {
    const card: NodeCard = {
      ...minimal,
      params: { retries: 3, backoff: { kind: "exponential", factor: 1.5 }, tags: ["a", null] },
    };
    expect(JSON.parse(JSON.stringify(card.params))).toEqual(card.params);
  });

  it("carries the three fields the paradigm needs, with `skill` optional", () => {
    const card: NodeCard = {
      ...minimal,
      mcp: ["filesystem", "github"],
      skill: "skills/solver.md",
      cannot: ["acceptance-criteria", "never opens a shell"],
    };
    expect(card.mcp).toEqual(["filesystem", "github"]);
    expect(card.skill).toBe("skills/solver.md");
    // Both spellings of a `cannot` entry live in the same list. The first names an
    // ontology `data-type` and `bundle/resolve.ts` checks it against the edges; the second
    // names no term and is read by a person. Neither is a lesser entry.
    expect(card.cannot).toEqual(["acceptance-criteria", "never opens a shell"]);
    // `skill` is the only one of the three that may be absent.
    expect(minimal.skill).toBeUndefined();
  });

  it("keeps `mcp` and `tools` as separate questions", () => {
    // `tools` holds `tool` capability terms and says what the node may do; `mcp` names the
    // concrete servers that supply it. A node can carry either without the other, so the
    // two are never merged and neither implies the other.
    const serverOnly: NodeCard = { ...minimal, tools: [], mcp: ["filesystem"] };
    const capabilityOnly: NodeCard = { ...minimal, tools: ["file-io"], mcp: [] };
    expect(serverOnly.tools).toEqual([]);
    expect(capabilityOnly.mcp).toEqual([]);
  });
});
