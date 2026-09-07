/* ============================================================
   DarkPrint backend — blueprint bump: brute-force oracle

   `worstPairing` and `worstStranded` both
   claim exactness by an "any single choice is achievable" argument
   rather than an exhaustive search — this file is the exhaustive
   search, kept as a permanent regression test rather than one
   round's throwaway evidence, per the round-6 ruling: "take the
   oracle as a permanent regression test, not just as this round's
   evidence."

   The oracle enumerates every residue-free explanation of one id's
   leftover versions directly: every way to choose which
   `|before| - |after|` (or `|after| - |before|`) items are
   genuinely stranded, and every permutation pairing the rest, and
   takes the worst level over all of them. It is deliberately
   independent of `worstPairing`/`worstStranded`/`unpairedFloor` —
   it does not import them, only the same public `@/lib/core`
   primitives they are built from — so a shared bug in those
   private helpers cannot also be baked into the check.

   ── why counts, not two disjoint pools ──
   The round-6 defect only shows up when one leftover list holds a
   *mix* of a value that is patch-eligible (still pinned somewhere
   in the full opposite list, because it also matched some — but not
   all — of its occurrences there) and a value that is genuinely
   gone: `[1.0.0, 1.0.1, 1.0.1] → [1.0.1, 1.0.2]` needs `1.0.1` to
   appear on both sides (two on the left, one on the right, so one
   copy cancels and one is left over) *and* `1.0.0` to appear only on
   the left. Two disjoint pools can never produce that — nothing on
   one side would ever equal anything on the other — so generation
   here draws counts (0, 1 or 2) per value from one shared pool for
   each side independently, and mirrors `leftoverVersions`' own
   by-value cancellation (round 4, independently re-verified,
   untouched this round) to know what leftover that produces before
   handing the raw, expanded refs to `inferBlueprintBump`.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { compareSemver, declaredBump, type BumpLevel, parseSemver } from "@/lib/core";

import { inferBlueprintBump, type BlueprintSnapshot } from "./blueprint-bump";

const LEVEL_RANK: Record<BumpLevel, number> = { none: 0, patch: 1, minor: 2, major: 3 };

function strongest(levels: readonly BumpLevel[]): BumpLevel {
  return levels.reduce((worst, level) => (LEVEL_RANK[level] > LEVEL_RANK[worst] ? level : worst), "none");
}

/** The size of a repin, direction-independent — mirrors the production rule, not its code. */
function magnitude(a: string, b: string): BumpLevel {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa === undefined || pb === undefined) return "none";
  return compareSemver(pa, pb) <= 0 ? declaredBump(a, b) : declaredBump(b, a);
}

/** What one before/after pair prices at, unreadable pairs floored by genuinely-lost/gained. */
function pairPrice(before: string, after: string, beforeFull: ReadonlySet<string>, afterFull: ReadonlySet<string>): BumpLevel {
  const raw = magnitude(before, after);
  if (raw !== "none") return raw;
  return strongest([
    "patch",
    afterFull.has(before) ? "patch" : "major",
    beforeFull.has(after) ? "patch" : "minor",
  ]);
}

/** What one stranded (unpaired) item prices at, checked against the full opposite-side list. */
function strandedPrice(version: string, presentOnOtherSide: boolean, kind: "lost" | "gained"): BumpLevel {
  if (presentOnOtherSide) return "patch";
  return kind === "lost" ? "major" : "minor";
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const perm of permutations(rest)) out.push([items[i], ...perm]);
  }
  return out;
}

/** Every size-`k` subset of `0..n-1`, as index arrays. */
function indexCombinations(n: number, k: number): number[][] {
  if (k === 0) return [[]];
  if (k > n) return [];
  const out: number[][] = [];
  function go(start: number, chosen: number[]): void {
    if (chosen.length === k) {
      out.push(chosen.slice());
      return;
    }
    for (let i = start; i < n; i++) {
      chosen.push(i);
      go(i + 1, chosen);
      chosen.pop();
    }
  }
  go(0, []);
  return out;
}

/**
 * The exhaustive answer for one id's before/after leftover, over every
 * residue-free explanation: choose which items on the longer side are
 * stranded, permute the rest against the shorter side, price each
 * explanation as the strongest reason it contains, and take the worst
 * explanation found. `O(n! * C(n,k))` — fine for the small lists this test
 * generates, wrong for production, which is the whole reason `worstPairing`
 * and `worstStranded` exist as closed-form maxima instead.
 */
function oracleLevel(
  beforeLeftover: readonly string[],
  afterLeftover: readonly string[],
  beforeFull: ReadonlySet<string>,
  afterFull: ReadonlySet<string>,
): BumpLevel {
  const n = beforeLeftover.length;
  const m = afterLeftover.length;
  if (n === 0 && m === 0) return "none";

  const explanations: BumpLevel[] = [];

  if (n >= m) {
    for (const strandedIdx of indexCombinations(n, n - m)) {
      const stranded = new Set(strandedIdx);
      const remaining = beforeLeftover.filter((_, i) => !stranded.has(i));
      for (const perm of permutations(afterLeftover)) {
        const pairLevels = remaining.map((b, i) => pairPrice(b, perm[i], beforeFull, afterFull));
        const strandLevels = strandedIdx.map((i) => strandedPrice(beforeLeftover[i], afterFull.has(beforeLeftover[i]), "lost"));
        explanations.push(strongest([...pairLevels, ...strandLevels]));
      }
    }
  } else {
    for (const strandedIdx of indexCombinations(m, m - n)) {
      const stranded = new Set(strandedIdx);
      const remaining = afterLeftover.filter((_, i) => !stranded.has(i));
      for (const perm of permutations(beforeLeftover)) {
        const pairLevels = remaining.map((a, i) => pairPrice(perm[i], a, beforeFull, afterFull));
        const strandLevels = strandedIdx.map((i) => strandedPrice(afterLeftover[i], beforeFull.has(afterLeftover[i]), "gained"));
        explanations.push(strongest([...pairLevels, ...strandLevels]));
      }
    }
  }

  return strongest(explanations);
}

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

/** Independent reimplementation of `leftoverVersions`' by-value cancellation — not imported. */
function cancel(beforeCounts: ReadonlyMap<string, number>, afterCounts: ReadonlyMap<string, number>): { beforeLeftover: string[]; afterLeftover: string[] } {
  const beforeLeftover: string[] = [];
  const afterLeftover: string[] = [];
  const allVersions = new Set([...beforeCounts.keys(), ...afterCounts.keys()]);
  for (const version of allVersions) {
    const b = beforeCounts.get(version) ?? 0;
    const a = afterCounts.get(version) ?? 0;
    const matched = Math.min(b, a);
    for (let i = matched; i < b; i++) beforeLeftover.push(version);
    for (let i = matched; i < a; i++) afterLeftover.push(version);
  }
  return { beforeLeftover, afterLeftover };
}

/**
 * Random counts (0, 1 or 2) per value from one shared pool, independently
 * for each side — the shared pool, not two disjoint ones, is what lets
 * cancellation leave a genuine mix of patch-eligible and genuinely-gone
 * leftover in one list. Capped small: the oracle is factorial in the
 * leftover it ends up with, not in the pool size.
 */
function randomCounts(rand: () => number, pool: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const version of pool) {
    const count = Math.floor(rand() * 3); // 0, 1 or 2
    if (count > 0) counts.set(version, count);
  }
  return counts;
}

function toRefs(counts: ReadonlyMap<string, number>): string[] {
  const refs: string[] = [];
  for (const [version, count] of counts) for (let i = 0; i < count; i++) refs.push(`solver@${version}`);
  return refs;
}

function runAgainstOracle(seed: number, trials: number, pool: readonly string[]): void {
  const rand = mulberry32(seed);
  const divergences: string[] = [];
  for (let trial = 0; trial < trials; trial++) {
    const beforeCounts = randomCounts(rand, pool);
    const afterCounts = randomCounts(rand, pool);
    const { beforeLeftover, afterLeftover } = cancel(beforeCounts, afterCounts);
    // Keep the permutation search tractable; the shared-pool generator can
    // occasionally produce more leftover than is worth brute-forcing here.
    if (Math.max(beforeLeftover.length, afterLeftover.length) > 4) continue;

    const before: BlueprintSnapshot = { dot: "digraph {}", cardRefs: toRefs(beforeCounts) };
    const after: BlueprintSnapshot = { dot: "digraph {}", cardRefs: toRefs(afterCounts) };
    const actual = inferBlueprintBump(before, after).level;
    // The *full* original value sets, not the leftover — a value cancelled
    // out entirely by an exact match is still "present" for pricing a
    // stranded item, the same distinction `unpairedFloor` makes in
    // production. Using the leftover sets here undercounts membership and
    // was a real bug in this oracle, caught by checking it against the
    // known-correct implementation before trusting its verdicts.
    const expected = oracleLevel(beforeLeftover, afterLeftover, new Set(beforeCounts.keys()), new Set(afterCounts.keys()));

    if (actual !== expected) {
      divergences.push(
        `beforeCounts=${JSON.stringify([...beforeCounts])} afterCounts=${JSON.stringify([...afterCounts])} ` +
          `leftover=(${JSON.stringify(beforeLeftover)}, ${JSON.stringify(afterLeftover)}): ` +
          `oracle=${expected} actual=${actual}`,
      );
    }
  }
  expect(divergences, divergences.join("\n")).toEqual([]);
}

describe("inferBlueprintBump, brute-force oracle over every residue-free explanation", () => {
  const NARROW_POOL = ["1.0.0", "1.0.1", "1.0.2", "1.1.0", "2.0.0"];
  const WIDE_POOL = [
    "1.0.0",
    "1.0.1",
    "1.0.2",
    "1.1.0",
    "2.0.0",
    "9.0.0",
    "0.10.0",
    "10.0.0",
    "1.0.0-rc.1",
    "1.0.0-rc.2",
    "1.0.0+a",
    "1.0.0+b",
    "latest",
    "not-a-version",
  ];

  it("matches the oracle over a narrow value pool, three seeds", () => {
    for (const seed of [11, 22, 33]) runAgainstOracle(seed, 200, NARROW_POOL);
  });

  it("matches the oracle over a wide value pool (build metadata, prerelease, unparseable), three seeds", () => {
    for (const seed of [44, 55, 66]) runAgainstOracle(seed, 200, WIDE_POOL);
  });
});
