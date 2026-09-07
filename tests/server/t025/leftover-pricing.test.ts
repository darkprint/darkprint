/* ============================================================
   T025 — closing a gap in the leftover-pricing tests

   Not an acceptance criterion of its own: this covers the round-6
   defect T025's own adversary found and fixed, for which the only
   guards live in `lib/server/versioning/**` (the implementer's own
   tree). Reverting that fix reds three tests there and zero here —
   this file gives `tests/server/t025/**` an equivalent it owns.

   T025's contract, round 6: "Every term [of the leftover pricing]
   is a maximum over its own admissible choices." The pair term was
   already a true maximum; deletions and additions took a
   sorted-tail slice instead, so the most expensive residue-free
   explanation did not always win.

   Three things are covered:

   1. The worst-candidate defect itself — a stranded item must be
      the most expensive admissible choice, not whichever sorts last.
   2. Monotonicity, exact and stated as the union it actually is:
      adding a pin to `next` cannot lower the level unless EITHER the
      added value had a surplus on the `before` side, OR the addition
      erased the last forced before-stranding (`|bl| = |al| + 1`
      exactly, before the addition). The per-value predicate alone
      is only half the licence — it covers the pair term's monotonicity
      but not the stranded term's, which drops when growing `al`
      toward `bl` deletes a forced stranding outright. Asserted here
      as an invariant over an exhaustive, deterministic sweep — not
      sampled, so it cannot quietly weaken if a generator seed changes.
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
   file's first draft (the round-6 correction recorded at `2d0f728`):

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

/**
 * By-value cancellation: exact matches are free and removed from both sides first. Shared
 * between the oracle and the monotonicity licence below so the two never see two
 * independent (and possibly drifting) copies of the same cancellation logic.
 */
function cancel(before: readonly string[], after: readonly string[]): [string[], string[]] {
  const beforeLeftover = [...before];
  const afterLeftover = [...after];
  for (const value of new Set([...before, ...after])) {
    let toCancel = Math.min(countOf(beforeLeftover, value), countOf(afterLeftover, value));
    while (toCancel > 0) {
      beforeLeftover.splice(beforeLeftover.indexOf(value), 1);
      afterLeftover.splice(afterLeftover.indexOf(value), 1);
      toCancel -= 1;
    }
  }
  return [beforeLeftover, afterLeftover];
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
 *  Forbidden here and unread — but the rule as the contract states it, worked out and
 *  checked by hand against six examples before it is trusted against anything else. */
function oracleLevel(before: readonly string[], after: readonly string[]): BumpLevel {
  const [beforeLeftover, afterLeftover] = cancel(before, after);

  if (beforeLeftover.length === 0 && afterLeftover.length === 0) return "none";

  let best: BumpLevel = "none";

  // The pair term: a true maximum over every cross pair. Always achievable in a real
  // matching — pair the single worst cross-pair first, then match whatever remains
  // arbitrarily, per the round-6 argument for why this term costs no more than a slice.
  //
  // One pairing is not a legitimate explanation on its own: equal semver precedence but a
  // different exact string (build metadata is the only way to reach this) prices "none",
  // which asserts nothing changed when the digest still moved. A residue-free explanation
  // is always free to strand that specific pair instead — each side priced against the
  // full original opposite list — so that alternative is folded into the same maximum
  // rather than treated as the only reading of a "none" pairing.
  for (const b of beforeLeftover) {
    for (const a of afterLeftover) {
      const price = pairPrice(a, b);
      best = maxLevel(best, price);
      if (price === "none" && a !== b) {
        best = maxLevel(best, maxLevel(strandedPrice(b, "before", after), strandedPrice(a, "after", before)));
      }
    }
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
    // Equal-precedence-different-string (build metadata): a duplicate leaves a leftover
    // "1.0.0" still pinned in the full after list (patch), and "1.0.0+b" is genuinely new
    // (minor) — maximum minor. Without the duplicate, the lost half masks it at major.
    { before: ["1.0.0", "1.0.0"], after: ["1.0.0", "1.0.0+b"], want: "minor" },
    { before: ["1.0.0"], after: ["1.0.0+b"], want: "major" },
  ])("oracle($before, $after) = $want", ({ before, after, want }) => {
    expect(oracleLevel(before, after)).toBe(want);
  });
});

describe("leftover pricing: PROPERTY — the oracle and the real function agree over a bounded, exhaustive domain", () => {
  // `1.0.0+b` is not one more point — it is a witness for a different equivalence class of
  // the comparator this domain has to cover: equal precedence, different exact string, only
  // reachable through build metadata. A pool of only-distinct-precedence plain semvers can
  // never reach it at any length, however many points it has — the exhaustive multiset
  // generator supplies the required duplicate ("1.0.0" appears twice) for free.
  const POOL = ["1.0.0", "1.0.0+b", "1.0.1", "1.0.2", "2.0.0", "9.0.0"] as const;
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
   1c. A "none"-magnitude pairing between two different exact
   strings (equal semver precedence, reachable only through build
   metadata) is not a free explanation: the digest still moved even
   though the declared magnitude did not. Named explicitly because
   the equivalence class it belongs to is invisible to any pool of
   distinct-precedence plain semvers, at any length or size — the
   generator needs a witness for it, not more points.
   ============================================================ */
describe("leftover pricing: a none-magnitude pairing between different strings is not free", () => {
  it("[1.0.0, 1.0.0] -> [1.0.0, 1.0.0+b] is minor: the duplicate leaves 1.0.0 still pinned in after (patch), 1.0.0+b is genuinely new (minor)", async () => {
    expect(await levelOf(["1.0.0", "1.0.0"], ["1.0.0", "1.0.0+b"])).toBe("minor");
  });

  it("control: [1.0.0] -> [1.0.0+b] is major — with no duplicate, the lost half masks the gained half", async () => {
    // Without the duplicate, 1.0.0 is genuinely gone (absent from the full after list
    // ["1.0.0+b"]), which prices major and dominates the gained half's minor.
    expect(await levelOf(["1.0.0"], ["1.0.0+b"])).toBe("major");
  });

  it("control: [1.0.0, 1.0.0] -> [1.0.0, 1.0.1] never produces an equal-precedence pair at all", async () => {
    // 1.0.1 has strictly higher precedence than 1.0.0, so this never reaches the special
    // case — a plain sanity check that the ordinary path is undisturbed.
    expect(await levelOf(["1.0.0", "1.0.0"], ["1.0.0", "1.0.1"])).toBe("patch");
  });
});

/* ============================================================
   2. Monotonicity, exact, asserted as an invariant over an
   exhaustive sweep rather than sampled — and stated as the union it
   turned out to be, not the per-value half this file shipped first.

   That first version reds against a CORRECT implementation — the
   dispatch's own best possible outcome for a blind suite, since it
   is the sweep finding a defect in the licence itself within
   minutes of landing. The theorem argument held that if `before`
   has no surplus of `V` then `bl` is unchanged and `al` grows, so
   both terms are monotone non-decreasing. True of the pair term.
   False of the stranded term: `al` growing toward `bl` reduces the
   forced-stranding count `max(0, |bl| − |al|)` and can delete an
   expensive stranding outright, even with no surplus of the
   specific value added. So a drop is licensed if EITHER the added
   value had a before-surplus, OR the addition erased the last
   forced before-stranding — `|bl| = |al| + 1` exactly, before the
   addition. Stated at exactly one, not `|bl| > |al|`: above a
   deficit of one the before-stranding still fires afterward, over
   the same `bl`, so no drop is mechanically possible there, and a
   loose `>` would license a class of drop that cannot occur — an
   over-broad licence that fails open.
   ============================================================ */
describe("leftover pricing: PROPERTY — adding a pin cannot lower the level without a licence", () => {
  const POOL = ["1.0.0", "1.0.1", "2.0.0", "9.0.0"] as const;
  const MAX_LENGTH = 2;

  it("holds for every (before, after, added) triple in a bounded, exhaustive, deterministic sweep", async () => {
    const fn = await inferBlueprintBump();
    const multisets = multisetsUpTo(POOL, MAX_LENGTH);
    let unlicensedChecks = 0;
    let licensedChecks = 0;

    for (const before of multisets) {
      for (const after of multisets) {
        const levelBefore = asBumpAnalysis(
          fn(snapshot(BASE_DOT, refsFor(before)), snapshot(BASE_DOT, refsFor(after))),
          WHERE,
        ).level;
        // Independent of `added`: whether the addition can erase a forced before-stranding
        // depends only on the leftover counts of the pair being compared.
        const [bl, al] = cancel(before, after);
        const erasesLastStranding = bl.length === al.length + 1;

        for (const added of POOL) {
          const hadSurplus = countOf(before, added) > countOf(after, added);
          const licensed = hadSurplus || erasesLastStranding;
          const levelAfter = asBumpAnalysis(
            fn(snapshot(BASE_DOT, refsFor(before)), snapshot(BASE_DOT, refsFor([...after, added]))),
            WHERE,
          ).level;

          if (licensed) {
            licensedChecks += 1;
            continue; // licensed to drop, but not required to — nothing to assert here
          }
          unlicensedChecks += 1;
          expect(
            bumpSatisfies(levelAfter, levelBefore),
            `before=${JSON.stringify(before)} after=${JSON.stringify(after)} added=${added}: ` +
              `level went from "${levelBefore}" to "${levelAfter}" with no licence (no before-surplus of ` +
              `${added}, and |bl|=${bl.length} |al|=${al.length} is not a deficit of exactly one)`,
          ).toBe(true);
        }
      }
    }

    // The sweep must exercise every branch, or this test would be vacuous in one of them —
    // exactly how the per-value-only version above shipped without ever hitting the
    // deficit-licence branch at all.
    expect(unlicensedChecks, "the sweep never hit the unlicensed branch").toBeGreaterThan(0);
    expect(licensedChecks, "the sweep never hit the licensed branch — the domain is too narrow to matter").toBeGreaterThan(0);
  });

  it("executed case (surplus licence): before=[1.0.0], after=[2.0.0,1.0.1], adding 1.0.0 licenses major -> minor", async () => {
    const withoutAddition = await levelOf(["1.0.0"], ["2.0.0", "1.0.1"]);
    const withAddition = await levelOf(["1.0.0"], ["2.0.0", "1.0.1", "1.0.0"]);

    expect(withoutAddition, "1.0.0 must be explained as a repin against 2.0.0").toBe("major");
    expect(withAddition, "before held a surplus of 1.0.0, so the addition cancels the forced repin").toBe("minor");
  });

  it("executed case (deficit licence): before=[1.0.0], after=[] is major, after=[1.0.1] is patch", async () => {
    // The half the per-value predicate alone missed: 1.0.1 has no before-surplus (it never
    // appeared in before at all), yet the drop is correct. With `after` empty, bl=1, al=0 —
    // a deficit of exactly one. Adding 1.0.1 brings al to 1, matching bl, so the forced
    // before-stranding (which priced major, since 1.0.0 was genuinely gone) disappears
    // entirely and only the pair term is left: declaredBump(1.0.0, 1.0.1) = patch.
    const withoutAddition = await levelOf(["1.0.0"], []);
    const withAddition = await levelOf(["1.0.0"], ["1.0.1"]);

    expect(withoutAddition, "with after empty, 1.0.0 is genuinely gone").toBe("major");
    expect(
      withAddition,
      "the deficit of exactly one is erased by the addition, even though 1.0.1 has no before-surplus",
    ).toBe("patch");
  });

  it("the original defect stays a defect: [1.0.0]->[9.0.0] vs [1.0.0]->[1.0.1,9.0.0] has no licence", async () => {
    // Neither licence applies: no before-surplus of 1.0.1 (never appeared in before), and
    // bl=1, al=1 before the addition — a deficit of zero, not one, so the deficit licence
    // does not apply either. The carve-out must not license this drop.
    const withoutAddition = await levelOf(["1.0.0"], ["9.0.0"]);
    const withAddition = await levelOf(["1.0.0"], ["1.0.1", "9.0.0"]);

    expect(withoutAddition).toBe("major");
    expect(
      bumpSatisfies(withAddition, withoutAddition),
      `level went from "${withoutAddition}" to "${withAddition}" with no licence`,
    ).toBe(true);
  });

  it("addition term in isolation: two unmoved pins plus a genuinely new one is minor, not none", async () => {
    // Isolates the "gained" contribution specifically: before and after already agree on
    // two pins (bl=0 after cancellation), so nothing is left to pair against, and the
    // entire answer has to come from a stranded addition being priced rather than
    // silently defaulting to `none`.
    const level = await levelOf(["1.0.0", "1.0.1"], ["1.0.0", "1.0.1", "9.0.0"]);
    expect(level, "9.0.0 is genuinely new and stranded, with nothing left to pair against").toBe("minor");
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
