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

describe("inferBlueprintBump, a ref the write-site validator would refuse is still a set member", () => {
  it("prices a repin by semver even when the id fails CARD_ID's grammar", () => {
    const before = next({ dot: "digraph {}", cardRefs: ["café-solver@1.0.0"] });
    const after = next({ dot: "digraph {}", cardRefs: ["café-solver@2.0.0"] });
    expect(inferBlueprintBump(before, after).level).toBe("major");
  });

  it("never answers none for a pin that vanished without parsing", () => {
    const before = next({ dot: "digraph {}", cardRefs: ["not-a-ref"] });
    const after = next({ dot: "digraph {}", cardRefs: [] });
    expect(inferBlueprintBump(before, after).level).not.toBe("none");
  });

  it("never answers none for an added empty-string pin", () => {
    const before = next({ dot: "digraph {}", cardRefs: [] });
    const after = next({ dot: "digraph {}", cardRefs: [""] });
    expect(inferBlueprintBump(before, after).level).not.toBe("none");
  });

  it("does not collapse a same-id pin added at a conflicting version", () => {
    const before = next({ dot: "digraph {}", cardRefs: ["intake@1.0.0", "solver@1.2.0"] });
    const after = next({ dot: "digraph {}", cardRefs: ["intake@1.0.0", "solver@1.2.0", "solver@9.0.0"] });
    expect(inferBlueprintBump(before, after).level).not.toBe("none");
  });

  it("reads a repin against an unparseable previous version as a change, not a fresh pin", () => {
    const before = next({ dot: "digraph {}", cardRefs: ["solver@latest"] });
    const after = next({ dot: "digraph {}", cardRefs: ["solver@2.0.0"] });
    const result = inferBlueprintBump(before, after);
    expect(result.level).not.toBe("none");
    expect(result.reasons.join(" ")).toMatch(/solver.*repinned/);
  });
});

describe("inferBlueprintBump, the pin collection is a multiset, compared order-independently", () => {
  it("prices a second node's repin across a major, even though the first node's pin is unchanged", () => {
    const before = next({ dot: "digraph {}", cardRefs: ["solver@1.0.0", "solver@2.0.0"] });
    const after = next({ dot: "digraph {}", cardRefs: ["solver@1.0.0", "solver@3.0.0"] });
    expect(inferBlueprintBump(before, after).level).toBe("major");
  });

  it("infers the same level from the same multiset regardless of node order", () => {
    const before = next({ dot: "digraph {}", cardRefs: ["a@1.0.0"] });
    const forward = next({ dot: "digraph {}", cardRefs: ["a@1.0.0", "a@2.0.0"] });
    const reversed = next({ dot: "digraph {}", cardRefs: ["a@2.0.0", "a@1.0.0"] });

    const forwardResult = inferBlueprintBump(before, forward);
    const reversedResult = inferBlueprintBump(before, reversed);
    expect(forwardResult).toEqual(reversedResult);
    expect(forwardResult.level).not.toBe("none");
  });

  it("prices a pure multiplicity change (same version, more or fewer pins) as at least a patch", () => {
    const before = next({ dot: "digraph {}", cardRefs: ["a@1.0.0"] });
    const after = next({ dot: "digraph {}", cardRefs: ["a@1.0.0", "a@1.0.0"] });
    const result = inferBlueprintBump(before, after);
    expect(result.level).not.toBe("none");
  });
});

describe("inferBlueprintBump, a version move is priced by magnitude, not direction", () => {
  it.each([
    ["major", "2.0.0", "1.0.0"],
    ["minor", "1.1.0", "1.0.0"],
    ["patch", "1.0.1", "1.0.0"],
    // compareSemver ranks a prerelease below its release, so this pair is a
    // patch move in either direction — never major, which the wrong
    // shortcut ("major whenever declaredBump says none") would give.
    ["patch", "1.0.0", "1.0.0-rc.1"],
  ] as const)("prices a %s rollback the same as the matching forward move", (level, higher, lower) => {
    const forward = inferBlueprintBump(
      next({ dot: "digraph {}", cardRefs: [`solver@${lower}`] }),
      next({ dot: "digraph {}", cardRefs: [`solver@${higher}`] }),
    );
    const rollback = inferBlueprintBump(
      next({ dot: "digraph {}", cardRefs: [`solver@${higher}`] }),
      next({ dot: "digraph {}", cardRefs: [`solver@${lower}`] }),
    );
    expect(forward.level).toBe(level);
    expect(rollback.level).toBe(level);
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
