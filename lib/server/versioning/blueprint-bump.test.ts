import { describe, expect, it } from "vitest";

import { inferBlueprintBump, type BlueprintSnapshot } from "./blueprint-bump";

const BASE: BlueprintSnapshot = {
  dot: 'digraph { solver [card="solver-a@1.0.0"]; }',
  cardRefs: ["solver-a@1.0.0"],
};

function next(patch: Partial<BlueprintSnapshot>): BlueprintSnapshot {
  return { ...BASE, ...patch };
}

describe("inferBlueprintBump, no change", () => {
  it("is none for an identical snapshot", () => {
    expect(inferBlueprintBump(BASE, { ...BASE })).toEqual({ level: "none", reasons: [] });
  });

  it("is none for a pure reorder of the same pins", () => {
    const before = next({ cardRefs: ["a@1.0.0", "b@1.0.0"] });
    const after = next({ cardRefs: ["b@1.0.0", "a@1.0.0"] });
    expect(inferBlueprintBump(before, after).level).toBe("none");
  });
});

describe("inferBlueprintBump, major", () => {
  it("repinning a card to a new major version is itself major", () => {
    const after = next({
      dot: 'digraph { solver [card="solver-a@2.0.0"]; }',
      cardRefs: ["solver-a@2.0.0"],
    });
    const result = inferBlueprintBump(BASE, after);
    expect(result.level).toBe("major");
    expect(result.reasons.join(" ")).toMatch(/solver-a.*1\.0\.0.*2\.0\.0/);
  });

  it("losing a pinned card is major", () => {
    const after = next({ dot: "digraph { }", cardRefs: [] });
    expect(inferBlueprintBump(BASE, after).level).toBe("major");
  });
});

describe("inferBlueprintBump, minor", () => {
  it("repinning a card to a new minor version is minor", () => {
    const after = next({ cardRefs: ["solver-a@1.1.0"] });
    expect(inferBlueprintBump(BASE, after).level).toBe("minor");
  });

  it("pinning an additional card is minor", () => {
    const after = next({ cardRefs: ["solver-a@1.0.0", "reviewer-b@1.0.0"] });
    expect(inferBlueprintBump(BASE, after).level).toBe("minor");
  });
});

describe("inferBlueprintBump, patch", () => {
  it("repinning a card to a new patch version is patch", () => {
    const after = next({ cardRefs: ["solver-a@1.0.1"] });
    expect(inferBlueprintBump(BASE, after).level).toBe("patch");
  });

  it("a DOT-only change with the same pins is patch", () => {
    const after = next({ dot: 'digraph { solver [card="solver-a@1.0.0", label="Solves it"]; }' });
    expect(inferBlueprintBump(BASE, after).level).toBe("patch");
  });
});

describe("inferBlueprintBump, determinism", () => {
  it("infers the same level for the same two inputs every time", () => {
    const after = next({
      dot: 'digraph { solver [card="solver-a@2.0.0"]; extra [card="reviewer-b@1.0.0"]; }',
      cardRefs: ["solver-a@2.0.0", "reviewer-b@1.0.0"],
    });
    const first = inferBlueprintBump(BASE, after);
    const second = inferBlueprintBump(BASE, after);
    expect(first).toEqual(second);
  });
});
