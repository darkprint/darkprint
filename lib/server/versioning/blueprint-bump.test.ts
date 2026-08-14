import { describe, expect, it } from "vitest";

import { bumpSatisfies } from "@/lib/core";

import { inferBlueprintBump, type BlueprintSnapshot } from "./blueprint-bump";
import { checkDeclaredBump } from "./declared-bump";

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

  it("does not fabricate a repin when a duplicate ahead of an untouched larger pin drops out", () => {
    // Sorted: before = [1.0.0, 1.0.0, 1.0.0, 5.0.0], after = [1.0.0, 1.0.0, 5.0.0].
    // A naive positional walk aligns index 2 as "1.0.0 -> 5.0.0", a repin that
    // never happened — 5.0.0 was never touched, one duplicate 1.0.0 pin was.
    const before = next({ dot: "digraph {}", cardRefs: ["a@1.0.0", "a@1.0.0", "a@1.0.0", "a@5.0.0"] });
    const after = next({ dot: "digraph {}", cardRefs: ["a@1.0.0", "a@1.0.0", "a@5.0.0"] });
    const result = inferBlueprintBump(before, after);
    expect(result.level).toBe("patch");
    expect(result.reasons.join(" ")).not.toMatch(/repinned/);
  });

  it("does not fabricate a repin when the whole list shrinks by one duplicate at the front", () => {
    const before = next({ dot: "digraph {}", cardRefs: ["a@1.0.0", "a@1.0.0", "a@2.0.0", "a@3.0.0"] });
    const after = next({ dot: "digraph {}", cardRefs: ["a@1.0.0", "a@2.0.0", "a@3.0.0"] });
    const result = inferBlueprintBump(before, after);
    expect(result.level).toBe("patch");
    expect(result.reasons.join(" ")).not.toMatch(/repinned/);
  });
});

describe("inferBlueprintBump, an ambiguous pairing infers the most expensive plausible reading", () => {
  it("prices a lone repin across a major as major", () => {
    const before = next({ dot: "digraph {}", cardRefs: ["solver@1.0.0"] });
    const after = next({ dot: "digraph {}", cardRefs: ["solver@9.0.0"] });
    expect(inferBlueprintBump(before, after).level).toBe("major");
  });

  it("does not let an extra small pin launder a major repin into a minor", () => {
    // Adding solver@1.0.1 alongside the genuine major jump to 9.0.0 must not
    // lower the answer: cardRefs carries no node identity, so a positional
    // pairing that happens to align 1.0.0 with the nearby 1.0.1 and calls
    // 9.0.0 "merely gained" is one reading, not the only one — and B-04
    // requires the most expensive plausible reading, not the cheapest.
    const before = next({ dot: "digraph {}", cardRefs: ["solver@1.0.0"] });
    const after = next({ dot: "digraph {}", cardRefs: ["solver@1.0.1", "solver@9.0.0"] });
    const result = inferBlueprintBump(before, after);
    expect(result.level).toBe("major");
  });

  it("checkDeclaredBump refuses the same declared bump whether or not the extra pin is present", () => {
    const declared = "1.1.0"; // minor — insufficient either way
    const lone = inferBlueprintBump(
      next({ dot: "digraph {}", cardRefs: ["solver@1.0.0"] }),
      next({ dot: "digraph {}", cardRefs: ["solver@9.0.0"] }),
    );
    const withExtra = inferBlueprintBump(
      next({ dot: "digraph {}", cardRefs: ["solver@1.0.0"] }),
      next({ dot: "digraph {}", cardRefs: ["solver@1.0.1", "solver@9.0.0"] }),
    );
    expect(checkDeclaredBump("bundle", "1.0.0", declared, lone)).toHaveLength(1);
    expect(checkDeclaredBump("bundle", "1.0.0", declared, withExtra)).toHaveLength(1);
  });

  it.each([
    ["solver@1.0.1", "solver@9.0.0"],
    ["solver@1.1.0", "solver@9.0.0"],
    ["solver@2.0.0", "solver@3.0.0"],
    ["solver@9.0.0", "solver@9.0.1"],
  ])("infers the pairing-independent worst case for %s + %s against a lone 1.0.0", (a, b) => {
    // One structural change (lose one pin, gain two), four different nearby
    // decoys. The level must come from the worst pairing available, not from
    // whichever decoy happens to sort next to the original.
    const before = next({ dot: "digraph {}", cardRefs: ["solver@1.0.0"] });
    const after = next({ dot: "digraph {}", cardRefs: [a, b] });
    const result = inferBlueprintBump(before, after);
    expect(result.level, `${a} + ${b} against a lone 1.0.0`).not.toBe("none");
  });

  it("restoring pin-count parity is evidence, not ambiguity, so it can legitimately read cheaper", () => {
    // before has two pins for `solver` (1.1.0, 1.0.0). Losing a pin entirely
    // (2 -> 1) is a fact read off the data, not a guess: some node's pin
    // vanished with nothing replacing it, unconditionally major. Restoring
    // the count (2 -> 2) removes that proof — a complete, self-consistent
    // explanation exists with no residue (both before-pins repinned to
    // `1.0.0-rc.1`, patch and minor respectively) — so nothing licenses
    // assuming a hidden deletion on top of it, the same reasoning AC-3
    // already rests on for an identical before/after pair. This is not the
    // monotonicity defect: the count itself, not merely a pin's presence,
    // is what the multiset proves either way.
    const before = next({ dot: "digraph {}", cardRefs: ["solver@1.1.0", "solver@1.0.0"] });
    const droppedToOne = next({ dot: "digraph {}", cardRefs: ["solver@1.0.0-rc.1"] });
    const restoredToTwo = next({
      dot: "digraph {}",
      cardRefs: ["solver@1.0.0-rc.1", "solver@1.0.0-rc.1"],
    });

    expect(inferBlueprintBump(before, droppedToOne).level).toBe("major");
    expect(inferBlueprintBump(before, restoredToTwo).level).toBe("minor");
  });

  describe("monotonicity, as a property over generated inputs", () => {
    /** Deterministic, seeded — reproducible failures, no external dependency. */
    function mulberry32(seed: number): () => number {
      let state = seed >>> 0;
      return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const POOL = [
      "1.0.0",
      "1.0.1",
      "1.1.0",
      "2.0.0",
      "9.0.0",
      "9.0.1",
      "10.0.0",
      "0.10.0",
      "1.0.0-rc.1",
      "1.0.0+build",
      "latest",
    ];

    function randomPins(rand: () => number, count: number): string[] {
      const pins: string[] = [];
      for (let i = 0; i < count; i++) {
        pins.push(`solver@${POOL[Math.floor(rand() * POOL.length)]}`);
      }
      return pins;
    }

    for (const seed of [1, 2, 3]) {
      it(`adding a genuinely foreign pin to next never lowers the inferred level (seed ${seed})`, () => {
        // "genuinely foreign" is load-bearing: an added pin whose *value* is
        // already in `before` restores evidence rather than adding
        // ambiguity — before=[1.1.0,1.0.1] -> smaller=[1.0.0+build] can
        // rightly be `major` ("1.1.0 has no trace"), while
        // before=[1.1.0,1.0.1] -> smaller+[1.1.0]=[1.0.0+build,1.1.0] can
        // rightly be `patch` (a natural 2-node-to-2-node reading: 1.1.0
        // untouched, 1.0.1 repinned to 1.0.0+build) — going down there is
        // correct, not a monotonicity violation, the same way restoring a
        // pin to make `next` identical to `previous` correctly infers
        // `none` no matter how severe the unrestored diff was. The
        // property under test is narrower and is exactly what the ruling's
        // own example tests: adding *unrelated* content must not be able
        // to launder an existing diff into something smaller.
        //
        // A second, subtler exemption: crossing pin-count parity with
        // `before` (fewer pins than `before` for this id, then exactly as
        // many) is also excluded. `before`'s occurrence count is read
        // directly off the data, not assumed — a strictly smaller count
        // *proves* at least one node's pin vanished with nothing to
        // replace it (major, unconditionally), where an equal count admits
        // a complete, self-consistent explanation with no residue (every
        // before-pin repinned to some after-pin, priced by
        // `worstPairing` alone) and asserting a hidden deletion on top of
        // that would invent structure the multiset does not contain — the
        // same reasoning AC-3 already rests on for the identical-input
        // case. See backend.md §T025's round-5 Log entry for the traced
        // example (`[1.1.0,1.0.0] → [rc.1] major` vs `→ [rc.1,rc.1] minor`).
        const rand = mulberry32(seed);
        for (let trial = 0; trial < 200; trial++) {
          const before = randomPins(rand, 1 + Math.floor(rand() * 3));
          const smaller = randomPins(rand, 1 + Math.floor(rand() * 3));
          const beforeVersions = new Set(before.map((ref) => ref.slice("solver@".length)));
          const foreign = POOL.filter((v) => !beforeVersions.has(v));
          if (foreign.length === 0) continue;
          const extra = `solver@${foreign[Math.floor(rand() * foreign.length)]}`;
          const larger = [...smaller, extra];

          if (before.length > smaller.length && before.length <= larger.length) continue;

          const smallerResult = inferBlueprintBump(
            next({ dot: "digraph {}", cardRefs: before }),
            next({ dot: "digraph {}", cardRefs: smaller }),
          );
          const largerResult = inferBlueprintBump(
            next({ dot: "digraph {}", cardRefs: before }),
            next({ dot: "digraph {}", cardRefs: larger }),
          );

          expect(
            bumpSatisfies(largerResult.level, smallerResult.level),
            `before=${JSON.stringify(before)} smaller=${JSON.stringify(smaller)} (${smallerResult.level}) ` +
              `larger=${JSON.stringify(larger)} (${largerResult.level}): adding a foreign pin lowered the level`,
          ).toBe(true);
        }
      });
    }
  });
});

describe("inferBlueprintBump, sorting is canonical even when precedence ties", () => {
  it("reads the same two build-metadata variants as unchanged regardless of which was written first", () => {
    const forward = next({ dot: "digraph {}", cardRefs: ["a@1.0.0", "a@1.0.0+build"] });
    const reversed = next({ dot: "digraph {}", cardRefs: ["a@1.0.0+build", "a@1.0.0"] });
    expect(inferBlueprintBump(forward, reversed).level).toBe("none");
    expect(inferBlueprintBump(reversed, forward).level).toBe("none");
  });

  it("reads two distinct build tags as unchanged regardless of order", () => {
    const forward = next({ dot: "digraph {}", cardRefs: ["a@1.0.0+x", "a@1.0.0+y"] });
    const reversed = next({ dot: "digraph {}", cardRefs: ["a@1.0.0+y", "a@1.0.0+x"] });
    expect(inferBlueprintBump(forward, reversed).level).toBe("none");
  });

  it("agrees across a rotation of a longer precedence-tied list", () => {
    const base = next({ dot: "digraph {}", cardRefs: ["a@1.0.0", "a@1.0.0+x", "a@2.0.0"] });
    const rotated = next({ dot: "digraph {}", cardRefs: ["a@1.0.0+x", "a@2.0.0", "a@1.0.0"] });
    expect(inferBlueprintBump(base, rotated).level).toBe("none");
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
