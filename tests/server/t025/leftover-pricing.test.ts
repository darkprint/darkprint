/* ============================================================
   T025 — closing a gap in the leftover-pricing tests

   Not an acceptance criterion of its own: this covers the round-6
   defect T025's own adversary found and fixed, for which the only
   guards live in `lib/server/versioning/**` (the implementer's own
   tree). Reverting that fix reds three tests there and zero here —
   this file gives `tests/server/t025/**` an equivalent it owns.

   backend.md §T025, round 6: "Every term [of the leftover pricing]
   is a maximum over its own admissible choices." The pair term was
   already a true maximum; deletions and additions took a
   sorted-tail slice instead, so the most expensive residue-free
   explanation did not always win.

   Three things are covered:

   1. The worst-candidate defect itself — a stranded item must be
      the most expensive admissible choice, not whichever sorts last.
   2. Monotonicity, in its exact per-value form: adding a pin to
      `next` cannot lower the level unless the added value had a
      surplus on the `before` side. This is a theorem about the
      shape of a maximum (backend.md, round 6, "the per-value
      predicate is exact rather than merely unfalsified"), asserted
      here as an invariant over an exhaustive, deterministic sweep —
      not sampled, so it cannot quietly weaken if a generator seed
      changes.
   3. The carve-out's class, not its first mechanism. It was
      discovered from a forced-deletion example and first written
      narrowly enough to miss a repin instance of the same class —
      "the addition removes a forced explanation" — which is why
      both are tested here, plus controls where the shape must not
      fire at all.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { bumpSatisfies, compareSemver, declaredBump, parseSemver, type BumpLevel } from "@/lib/core";

import { asBumpAnalysis, inferBlueprintBump } from "./contract";
import { BASE_DOT, snapshot } from "./fixtures";

const WHERE = "inferBlueprintBump";
const ID = "solver";

function refsFor(versions: readonly string[]): string[] {
  return versions.map((v) => `${ID}@${v}`);
}

async function levelOf(before: readonly string[], after: readonly string[]): Promise<BumpLevel> {
  const fn = await inferBlueprintBump();
  return asBumpAnalysis(fn(snapshot(BASE_DOT, refsFor(before)), snapshot(BASE_DOT, refsFor(after))), WHERE).level;
}

function countOf(list: readonly string[], value: string): number {
  return list.filter((v) => v === value).length;
}

/** Every multiset of length 0..maxLength drawable from `pool`, order-independent. */
function multisetsUpTo(pool: readonly string[], maxLength: number): string[][] {
  const results: string[][] = [[]];
  function build(start: number, current: string[]): void {
    if (current.length > 0) results.push([...current]);
    if (current.length === maxLength) return;
    for (let i = start; i < pool.length; i += 1) {
      current.push(pool[i]);
      build(i, current);
      current.pop();
    }
  }
  build(0, []);
  return results;
}

/* ============================================================
   1. The worst-candidate defect: a residue-free explanation strands
   the item that makes the level most expensive, not the one a sort
   happens to put last.
   ============================================================ */
describe("leftover pricing: a stranded item is the worst admissible choice, not the last-sorting one", () => {
  it("[1.0.0, 1.0.1, 1.0.1] -> [1.0.1, 1.0.2] is major: pairing 1.0.1->1.0.2 (patch) strands 1.0.0", async () => {
    expect(await levelOf(["1.0.0", "1.0.1", "1.0.1"], ["1.0.1", "1.0.2"])).toBe("major");
  });

  it("gained side, same defect shape, different level: [1.0.1, 1.0.2] -> [1.0.0, 1.0.1, 1.0.1] is minor", async () => {
    // Not "also major": the mechanism is symmetric (a sorted slice standing in for a
    // maximum on both sides) but the level is not. A genuinely removed pin is breaking;
    // a genuinely added one is not. Stranding 1.0.0 (absent from the full original before
    // list [1.0.1, 1.0.2]) prices minor; stranding 1.0.1 (present there, only its count
    // changed) prices patch. The maximum over that choice is minor, not major.
    expect(await levelOf(["1.0.1", "1.0.2"], ["1.0.0", "1.0.1", "1.0.1"])).toBe("minor");
  });

  it("control: [1.0.0, 1.0.1] -> [1.0.1] stays major", async () => {
    expect(await levelOf(["1.0.0", "1.0.1"], ["1.0.1"])).toBe("major");
  });

  it("control: [1.0.0, 1.0.1, 1.0.1] -> [1.0.1, 1.0.1] stays major", async () => {
    expect(await levelOf(["1.0.0", "1.0.1", "1.0.1"], ["1.0.1", "1.0.1"])).toBe("major");
  });
});

/* ============================================================
   1b. A brute-force oracle over the leftover pricing rule, so the
   defect is caught for a whole domain rather than four points in it.

   Built from the rule as it was ultimately stated, not guessed and
   not narrated from memory — the exact per-item contribution table
   was confirmed against a worked example that contradicted this
   file's first draft (backend.md §T025, round 6, the correction
   recorded at `2d0f728`):

     stranded on      | its value in the FULL original opposite list | price
     before (deleted) | absent — genuinely gone                      | major
     before (deleted) | present — only its count changed             | patch
     after  (added)   | absent — genuinely new                       | minor
     after  (added)   | present — only its count changed             | patch

   "Full original opposite list", never the leftover: a value can be
   stranded by the by-value cancellation and still have existed on
   the other side before cancellation ran. Getting this wrong in the
   isolated-pair-price direction is exactly what produced seventeen
   false findings for T025's own adversary building the same kind of
   oracle — pair and stranding prices are context-dependent on the
   *original* lists, never on an isolated call.

   Verified against six hand-worked cases before being run against
   the real function — see the unit tests immediately below.
   ============================================================ */
function maxLevel(a: BumpLevel, b: BumpLevel): BumpLevel {
  return bumpSatisfies(a, b) ? a : b;
}

/** `declaredBump` ordered by magnitude, never by which side was "previous" —
 *  the same recipe `blueprint-bump.test.ts` already exercises for a single repin. */
function pairPrice(a: string, b: string): BumpLevel {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa === undefined || pb === undefined) return "major"; // not exercised by this oracle's domain
  const [lower, higher] = compareSemver(pa, pb) <= 0 ? [a, b] : [b, a];
  return declaredBump(lower, higher);
}

function strandedPrice(value: string, side: "before" | "after", fullOppositeList: readonly string[]): BumpLevel {
  const stillPresent = fullOppositeList.includes(value);
  if (side === "before") return stillPresent ? "patch" : "major";
  return stillPresent ? "patch" : "minor";
}

/** Independent implementation of the per-id leftover pricing rule. Not the module under
 *  test's algorithm reimplemented from having read it — `lib/server/versioning/**` is
 *  Forbidden here and unread — but the rule as `backend.md` states it, worked out and
 *  checked by hand against six examples before it is trusted against anything else. */
function oracleLevel(before: readonly string[], after: readonly string[]): BumpLevel {
  const beforeLeftover = [...before];
  const afterLeftover = [...after];
  for (const value of new Set([...before, ...after])) {
    let cancel = Math.min(countOf(beforeLeftover, value), countOf(afterLeftover, value));
    while (cancel > 0) {
      beforeLeftover.splice(beforeLeftover.indexOf(value), 1);
      afterLeftover.splice(afterLeftover.indexOf(value), 1);
      cancel -= 1;
    }
  }

  if (beforeLeftover.length === 0 && afterLeftover.length === 0) return "none";

  let best: BumpLevel = "none";

  // The pair term: a true maximum over every cross pair. Always achievable in a real
  // matching — pair the single worst cross-pair first, then match whatever remains
  // arbitrarily, per the round-6 argument for why this term costs no more than a slice.
  for (const b of beforeLeftover) {
    for (const a of afterLeftover) best = maxLevel(best, pairPrice(a, b));
  }

  // The deletion term: a maximum over the WHOLE surplus-side leftover set, forced only
  // where the counts require it, priced against the full original opposite list.
  if (beforeLeftover.length > afterLeftover.length) {
    for (const b of beforeLeftover) best = maxLevel(best, strandedPrice(b, "before", after));
  }
  if (afterLeftover.length > beforeLeftover.length) {
    for (const a of afterLeftover) best = maxLevel(best, strandedPrice(a, "after", before));
  }

  return best;
}

describe("leftover pricing: the oracle is verified against known-correct behaviour before it verifies anything else", () => {
  it.each([
    { before: ["1.0.0", "1.0.1", "1.0.1"], after: ["1.0.1", "1.0.2"], want: "major" },
    { before: ["1.0.1", "1.0.2"], after: ["1.0.0", "1.0.1", "1.0.1"], want: "minor" },
    { before: ["1.0.0", "1.0.1"], after: ["1.0.1"], want: "major" },
    { before: ["1.0.0", "1.0.1", "1.0.1"], after: ["1.0.1", "1.0.1"], want: "major" },
    { before: ["1.0.0"], after: ["2.0.0", "1.0.1"], want: "major" },
    { before: ["1.0.0"], after: ["2.0.0", "1.0.1", "1.0.0"], want: "minor" },
  ])("oracle($before, $after) = $want", ({ before, after, want }) => {
    expect(oracleLevel(before, after)).toBe(want);
  });
});

describe("leftover pricing: PROPERTY — the oracle and the real function agree over a bounded, exhaustive domain", () => {
  const POOL = ["1.0.0", "1.0.1", "1.0.2", "2.0.0", "9.0.0"] as const;
  const MAX_LENGTH = 3;

  it("agrees for every (before, after) pair the domain contains", async () => {
    const fn = await inferBlueprintBump();
    const multisets = multisetsUpTo(POOL, MAX_LENGTH);
    let checked = 0;

    for (const before of multisets) {
      for (const after of multisets) {
        const want = oracleLevel(before, after);
        const got = asBumpAnalysis(fn(snapshot(BASE_DOT, refsFor(before)), snapshot(BASE_DOT, refsFor(after))), WHERE)
          .level;
        expect(got, `before=${JSON.stringify(before)} after=${JSON.stringify(after)}: oracle says ${want}`).toBe(
          want,
        );
        checked += 1;
      }
    }

    expect(checked).toBe(multisets.length * multisets.length);
  });
});

/* ============================================================
   2. Monotonicity, exact and per-value, asserted as an invariant
   over an exhaustive sweep rather than sampled.

   Proof sketch (backend.md §T025, round 6): adding a pin at value V
   changes the leftovers in exactly one of two ways. If `before` held
   a surplus of V, the addition cancels one leftover before-item —
   an explanation that was forced stops being forced, and the level
   may drop. If `before` held no surplus of V, nothing cancels: the
   before-leftover is unchanged and the after-leftover grows by one —
   and both the pair term (a maximum over a set that only grew) and
   the stranded-gained term (same) are monotone non-decreasing under
   that. So a drop with no before-surplus is impossible by
   construction, not merely unobserved.
   ============================================================ */
describe("leftover pricing: PROPERTY — adding a pin cannot lower the level without a before-surplus", () => {
  const POOL = ["1.0.0", "1.0.1", "2.0.0", "9.0.0"] as const;
  const MAX_LENGTH = 2;

  it("holds for every (before, after, added) triple in a bounded, exhaustive, deterministic sweep", async () => {
    const fn = await inferBlueprintBump();
    const multisets = multisetsUpTo(POOL, MAX_LENGTH);
    let noSurplusChecks = 0;
    let surplusChecks = 0;

    for (const before of multisets) {
      for (const after of multisets) {
        const levelBefore = asBumpAnalysis(
          fn(snapshot(BASE_DOT, refsFor(before)), snapshot(BASE_DOT, refsFor(after))),
          WHERE,
        ).level;

        for (const added of POOL) {
          const hadSurplus = countOf(before, added) > countOf(after, added);
          const levelAfter = asBumpAnalysis(
            fn(snapshot(BASE_DOT, refsFor(before)), snapshot(BASE_DOT, refsFor([...after, added]))),
            WHERE,
          ).level;

          if (hadSurplus) {
            surplusChecks += 1;
            continue; // licensed to drop, but not required to — nothing to assert here
          }
          noSurplusChecks += 1;
          expect(
            bumpSatisfies(levelAfter, levelBefore),
            `before=${JSON.stringify(before)} after=${JSON.stringify(after)} added=${added}: ` +
              `level went from "${levelBefore}" to "${levelAfter}" with no before-surplus of ${added}`,
          ).toBe(true);
        }
      }
    }

    // The sweep must exercise both branches, or this test would be vacuous in one of them.
    expect(noSurplusChecks, "the sweep never hit the no-surplus branch").toBeGreaterThan(0);
    expect(surplusChecks, "the sweep never hit the surplus branch — the domain is too narrow to matter").toBeGreaterThan(0);
  });

  it("executed case: before=[1.0.0], after=[2.0.0,1.0.1], adding 1.0.0 licenses major -> minor", async () => {
    const withoutAddition = await levelOf(["1.0.0"], ["2.0.0", "1.0.1"]);
    const withAddition = await levelOf(["1.0.0"], ["2.0.0", "1.0.1", "1.0.0"]);

    expect(withoutAddition, "1.0.0 must be explained as a repin against 2.0.0").toBe("major");
    expect(withAddition, "before held a surplus of 1.0.0, so the addition cancels the forced repin").toBe("minor");
  });

  it("the original defect stays a defect: [1.0.0]->[9.0.0] vs [1.0.0]->[1.0.1,9.0.0] has no before-surplus", async () => {
    // No deficit on either side of the pool of leftovers for 1.0.1: before never held it, so
    // nothing was ever cancelled by adding it. The carve-out must not license this drop.
    const withoutAddition = await levelOf(["1.0.0"], ["9.0.0"]);
    const withAddition = await levelOf(["1.0.0"], ["1.0.1", "9.0.0"]);

    expect(withoutAddition).toBe("major");
    expect(
      bumpSatisfies(withAddition, withoutAddition),
      `level went from "${withoutAddition}" to "${withAddition}" with no before-surplus of 1.0.1`,
    ).toBe(true);
  });
});

/* ============================================================
   3. The carve-out's class — "the addition removes a forced
   explanation" — tested with one instance of each mechanism the
   class covers, plus controls where the shape must not fire.
   ============================================================ */
describe("leftover pricing: the carve-out's class, not its first mechanism", () => {
  it("deletion instance: [1.1.0, 1.0.0] -> [1.0.0-rc.1] is major, -> [1.0.0-rc.1, 1.0.0-rc.1] is minor", async () => {
    const withoutAddition = await levelOf(["1.1.0", "1.0.0"], ["1.0.0-rc.1"]);
    const withAddition = await levelOf(["1.1.0", "1.0.0"], ["1.0.0-rc.1", "1.0.0-rc.1"]);

    expect(withoutAddition).toBe("major");
    expect(withAddition, "a forced deletion is one instance of a removed forced explanation").toBe("minor");
  });

  it("repin instance: [1.0.0] -> [2.0.0, 1.0.1] is major, -> [2.0.0, 1.0.1, 1.0.0] is minor", async () => {
    const withoutAddition = await levelOf(["1.0.0"], ["2.0.0", "1.0.1"]);
    const withAddition = await levelOf(["1.0.0"], ["2.0.0", "1.0.1", "1.0.0"]);

    expect(withoutAddition).toBe("major");
    expect(withAddition, "a repin is another instance of a removed forced explanation").toBe("minor");
  });

  it("control: [2.0.0, 1.0.0] -> [0.5.0] stays major, -> [0.5.0, 0.5.0] stays major", async () => {
    // The shape must not fire on unrelated values: neither addition removes a forced
    // explanation here, so neither may license a drop.
    expect(await levelOf(["2.0.0", "1.0.0"], ["0.5.0"])).toBe("major");
    expect(await levelOf(["2.0.0", "1.0.0"], ["0.5.0", "0.5.0"])).toBe("major");
  });
});
