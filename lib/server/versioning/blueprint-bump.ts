/* ============================================================
   DarkPrint backend — versioning: blueprint bump inference
   A blueprint's diff is its DOT plus the MULTISET
   of card refs it pins; nothing else moves a blueprint's version.

   Multiset, not set: `lib/core/hash/digest.ts`'s `bundleDigest`
   sorts `cardDigests` (so order never matters) but never
   deduplicates them (so multiplicity always does) — `lib/db/schema.ts`
   states it outright, pinning one card twice is a different digest
   from pinning it once. `cardRefs` is one entry per DOT node, so two
   nodes pinning different versions of one id is an ordinary graph,
   not a degenerate input. If identity distinguishes two releases,
   inference has to as well, or a release whose bytes moved would not
   be required to move its version.

   A ref the write-site validator would refuse is still a member of
   that multiset: "never answer `none` for input you could not read".
   So a ref is read two ways, not one — an id
   parses out where it can, for a repin priced by semver, and the raw
   refs are always compared by count on top, so a member cannot
   vanish just because it did not parse.

   `cardRefs` carries no node identity, so once more than one node
   pins one id, which before-version became which after-version is
   genuinely unknowable — and B-04's "never answer less than you can
   justify" resolves that ambiguity toward the most expensive
   plausible reading, never the cheapest. `worstPairing` takes the
   largest bump any pairing the leftover versions permit could
   justify, rather than assuming one arbitrary pairing; see its own
   comment for why this also fixes a real monotonicity bug a flat
   positional pairing had (adding a pin to `next` could *lower* the
   inferred bump).
   ============================================================ */

import type { BumpAnalysis, BumpLevel } from "@/lib/core";
import { compareSemver, compareVersionStrings, declaredBump, parseSemver } from "@/lib/core";

import { LEVEL_RANK, summarize, type Reason } from "./reasons";

/** The two fields that decide a blueprint's version. */
export interface BlueprintSnapshot {
  dot: string;
  cardRefs: readonly string[];
}

/**
 * Split "id@version" the same way `@/lib/core`'s `parseCardRef` does —
 * everything up to the last "@" is the id, everything after is the version —
 * but without `CARD_ID`/`REF_VERSION` grammar validation. `parseCardRef`
 * exists to decide whether a ref may be *written*; this exists to decide
 * whether two refs are talking about the same thing, and a ref the write
 * site would refuse can still be the same id one version apart from another
 * ref the write site would also refuse. Grammar-checking here is what made
 * `["café-solver@1.0.0"] → ["café-solver@2.0.0"]` and
 * `["Solver@1.0.0"] → ["Solver@2.0.0"]` infer `none`: neither id is
 * `CARD_ID`-legal, so the strict parse rejected both sides equally and the
 * repin disappeared before the comparison ran.
 */
function splitRef(ref: string): { id: string; version: string } | undefined {
  const trimmed = ref.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return undefined;
  return { id: trimmed.slice(0, at), version: trimmed.slice(at + 1) };
}

/** Every parseable ref's version, grouped by id. Order and duplicates preserved as given. */
function versionsById(refs: readonly string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const ref of refs) {
    const parsed = splitRef(ref);
    if (parsed === undefined) continue;
    const versions = map.get(parsed.id);
    if (versions) versions.push(parsed.version);
    else map.set(parsed.id, [parsed.version]);
  }
  return map;
}

/** Every raw ref, counted — the membership safety net over refs `splitRef` could not read at all. */
function refCounts(refs: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ref of refs) counts.set(ref, (counts.get(ref) ?? 0) + 1);
  return counts;
}

function sameCounts(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, count] of a) if (b.get(key) !== count) return false;
  return true;
}

/**
 * `compareVersionStrings` orders by semver *precedence*, and two distinct
 * strings can carry equal precedence — build metadata is excluded from it
 * by spec, so `"1.0.0"` and `"1.0.0+build"` compare equal. A comparator
 * that returns 0 for two unequal strings is not a total order over the
 * strings themselves, only over what they mean; pairing depends on a
 * genuinely canonical order, so a code-unit tiebreak (which never fires
 * between two versions `compareVersionStrings` already tells apart) breaks
 * the tie deterministically regardless of which one a node happened to
 * write first.
 */
function compareVersionsCanonical(a: string, b: string): number {
  const byPrecedence = compareVersionStrings(a, b);
  if (byPrecedence !== 0) return byPrecedence;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The size of the change between two version strings, independent of which
 * one is `a` and which is `b`. `declaredBump` is asymmetric by design — it
 * prices what a *declared* release may claim, and a downgrade declares
 * nothing (`bump.ts`'s `compareSemver(after, before) <= 0` branch returns
 * `"none"`), which is right for deciding whether an author's own version
 * bump is big enough and wrong for pricing an arbitrary pair a multiset
 * comparison happened to line up. An author repinning back to a known-good
 * older card still moves `cardDigests` and the bundle digest exactly as
 * much as repinning forward would, so the pair is ordered by
 * `compareSemver` first and `declaredBump` is asked for the magnitude,
 * never handed a direction to declare against.
 */
function repinMagnitude(a: string, b: string): BumpLevel {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (parsedA === undefined || parsedB === undefined) return declaredBump(a, b);
  return compareSemver(parsedA, parsedB) <= 0 ? declaredBump(a, b) : declaredBump(b, a);
}

/**
 * One id's before/after version lists, reduced to what actually moved.
 *
 * A naive "sort both lists and compare position by position" breaks the
 * moment a *duplicate* count changes anywhere but the very end of the
 * sorted range: dropping one of three `1.0.0` pins while a `5.0.0` pin sits
 * untouched shifts `5.0.0` from index 3 to index 2, and a positional
 * comparison reads that shift as `5.0.0` having been repinned *from*
 * `1.0.0` — a repin that never happened, priced at whatever `declaredBump`
 * says about a pair neither side actually pinned.
 *
 * So values are matched by count first, per distinct version string, and
 * only the leftover — what could not be cancelled out — is paired for
 * repin pricing. `matched = min(before-count, after-count)` for each
 * version leaves each side with only the copies the other side cannot
 * account for; a version can never have leftover on both sides at once,
 * since one side's leftover is exactly what the smaller count could not
 * match. This is also what makes the whole comparison count-based rather
 * than order-based, so it needs no sort of its own to be order-independent
 * — only the two leftover lists need a canonical order, to pair
 * deterministically for magnitude pricing.
 */
function leftoverVersions(
  beforeVersions: readonly string[],
  afterVersions: readonly string[],
): { beforeLeftover: string[]; afterLeftover: string[] } {
  const beforeCounts = refCounts(beforeVersions);
  const afterCounts = refCounts(afterVersions);
  const allVersions = new Set([...beforeCounts.keys(), ...afterCounts.keys()]);

  const beforeLeftover: string[] = [];
  const afterLeftover: string[] = [];
  for (const version of allVersions) {
    const before = beforeCounts.get(version) ?? 0;
    const after = afterCounts.get(version) ?? 0;
    const matched = Math.min(before, after);
    for (let i = matched; i < before; i++) beforeLeftover.push(version);
    for (let i = matched; i < after; i++) afterLeftover.push(version);
  }
  beforeLeftover.sort(compareVersionsCanonical);
  afterLeftover.sort(compareVersionsCanonical);
  return { beforeLeftover, afterLeftover };
}

/**
 * What a single leftover version prices at if it turns out this pairing is
 * wrong and the two sides are unrelated — `before` genuinely lost (still
 * pinned somewhere else in the full `after` list is only a patch;
 * genuinely gone is major) or `after` genuinely gained (still present
 * somewhere in the full `before` list is only a patch; genuinely new is
 * at least minor). Used to floor a pair `repinMagnitude` could not read.
 */
function unpairedFloor(version: string, seenElsewhere: boolean, kind: "lost" | "gained"): Exclude<BumpLevel, "none"> {
  if (seenElsewhere) return "patch";
  return kind === "lost" ? "major" : "minor";
}

/**
 * The worst price any single item in `leftover` could carry if it turned
 * out to be the one a residue-free explanation left genuinely unpaired,
 * and which item that is — checked against the *full* original
 * opposite-side list (a value cancelled out earlier by an exact match is
 * still "present" there). Only meaningful, and only ever called, when the
 * counts *force* at least one item on this side to go unpaired: a
 * residue-free explanation strands exactly `|thisSide| − |otherSide|`
 * items when that is positive, and *which* ones is a free choice — any
 * single item can be among the stranded ones (strand it, pair the
 * remainder arbitrarily, however many pairing steps or further strandings
 * that takes), so the worst explanation strands whichever item prices
 * highest over the *whole* leftover list, not whichever one happens to
 * sort last. A version cancelled out by count already never reaches here;
 * a version this function is checking is by construction not present
 * elsewhere on its *own* side, only possibly on the opposite one.
 */
function worstStranded(
  leftover: readonly string[],
  presentOnOtherSide: ReadonlySet<string>,
  kind: "lost" | "gained",
): { level: Exclude<BumpLevel, "none">; version: string } | undefined {
  let worst: { level: Exclude<BumpLevel, "none">; version: string } | undefined;
  for (const version of leftover) {
    const level = unpairedFloor(version, presentOnOtherSide.has(version), kind);
    if (worst === undefined || LEVEL_RANK[level] > LEVEL_RANK[worst.level]) {
      worst = { level, version };
    }
  }
  return worst;
}

/**
 * The worst repin size a `beforeLeftover`/`afterLeftover` pairing could
 * justify, over every `(before, after)` pair the leftovers permit —
 * `cardRefs` carries no node identity, so which specific before-version
 * became which specific after-version is genuinely unknowable, and B-04's
 * "never answer less than you can justify" settles the ambiguity toward
 * the most expensive plausible reading rather than the cheapest.
 *
 * This is a maximum over the full cross product, not a search over
 * assignments: taking the single worst `(b, a)` pair is always achievable
 * by *some* valid pairing (pair that one, then pair whatever is left of
 * both lists arbitrarily — pairing the remainder can only add reasons at
 * or below that same worst level, never remove it), so the cross-product
 * max is exactly the maximum level any full pairing could reach, computed
 * in O(n·m) with no permutation search. `undefined` when either leftover
 * list is empty — there is no pair to price, only the structural
 * gained/lost leftover `compareVersions` handles on its own.
 *
 * A pair `repinMagnitude` cannot read (one side is not semver at all, e.g.
 * `@latest`) is not floored at a flat `patch`: with nothing to measure a
 * distance against, "these two happen to be unrelated" is exactly as
 * plausible a reading as "this is a repin", so the floor is the worse of
 * `patch` and what each side would price as genuinely lost/gained on its
 * own (`unpairedFloor`, checked against the *full* original opposite-side
 * list). Skipping this for a pair `repinMagnitude` *can* read is what
 * keeps an ordinary minor or patch repin from being inflated to major just
 * because it is, definitionally, a leftover — that escalation is reserved
 * for pairs with no measured distance to trust instead.
 */
function worstPairing(
  beforeLeftover: readonly string[],
  afterLeftover: readonly string[],
  beforeSet: ReadonlySet<string>,
  afterSet: ReadonlySet<string>,
): { level: Exclude<BumpLevel, "none">; before: string; after: string } | undefined {
  let worst: { level: Exclude<BumpLevel, "none">; before: string; after: string } | undefined;
  for (const before of beforeLeftover) {
    for (const after of afterLeftover) {
      const raw = repinMagnitude(before, after);
      const level =
        raw === "none"
          ? [
              "patch" as const,
              unpairedFloor(before, afterSet.has(before), "lost"),
              unpairedFloor(after, beforeSet.has(after), "gained"),
            ].reduce((a, b) => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a))
          : raw;
      if (worst === undefined || LEVEL_RANK[level] > LEVEL_RANK[worst.level]) {
        worst = { level, before, after };
      }
    }
  }
  return worst;
}

/**
 * One id's version lists, before and after. Reduced to the leftover only
 * `leftoverVersions` could not cancel out, then priced two ways, both
 * maxima over every explanation the leftover counts admit rather than one
 * assumed explanation.
 *
 * First, the pairable portion — `worstPairing` over the *whole* leftover
 * cross product, not a positional walk. A flat "sort both lists and
 * compare position by position" was tried and failed a monotonicity
 * check: adding a pin to `next` can insert itself into the sorted middle
 * and shift every later position, so which before-version a given
 * after-version was compared against depended on how many *other* pins
 * happened to exist, and a bigger `next` could make the inferred bump
 * *smaller*. The cross-product maximum does not have that failure mode —
 * adding a pin only ever adds more candidate pairs, and a maximum over a
 * superset of pairs cannot go down.
 *
 * Second, whatever pairing structurally cannot consume: when the leftover
 * counts differ, a residue-free explanation strands exactly
 * `|beforeLeftover.length − afterLeftover.length|` items on the longer
 * side, no matter how the rest are paired — but *which* items are the
 * stranded ones is still a free choice, and a positional "whichever ones
 * sort last" answer (tried, and wrong) can pick the cheapest candidate
 * over and over while a *more* expensive one, sitting earlier in sorted
 * order, goes unpriced: `[1.0.0,1.0.1,1.0.1] → [1.0.1,1.0.2]` sorts its
 * before-leftover as `[1.0.0,1.0.1]` and a tail slice of length one always
 * strands `1.0.1` (pinned nowhere in `after`, still only a patch) instead
 * of `1.0.0` (pinned nowhere in `after` at all, major). `worstStranded`
 * takes the max over the *entire* surplus-side leftover instead of a
 * slice of it — exactness by the same argument as `worstPairing`: any one
 * item can be the stranded one, so trying all of them and keeping the
 * worst is exact, not an over-estimate. When the leftover counts are
 * equal, nothing is stranded at all: a residue-free bijection exists with
 * no leftover residue to explain away, and `worstPairing` alone already
 * covers every pairing that bijection could choose. An id absent from one
 * side supplies an empty leftover list on that side, which this same
 * logic reads correctly as "every occurrence gained" or "every occurrence
 * lost" with no extra branch.
 */
function compareVersions(
  id: string,
  beforeVersions: readonly string[],
  afterVersions: readonly string[],
  push: (level: Reason["level"], message: string) => void,
): void {
  const { beforeLeftover, afterLeftover } = leftoverVersions(beforeVersions, afterVersions);
  const beforeSet = new Set(beforeVersions);
  const afterSet = new Set(afterVersions);

  const worst = worstPairing(beforeLeftover, afterLeftover, beforeSet, afterSet);
  if (worst !== undefined) {
    push(worst.level, `card \`${id}\` may have repinned: ${worst.before} → ${worst.after}`);
  }

  if (beforeLeftover.length > afterLeftover.length) {
    const stranded = worstStranded(beforeLeftover, afterSet, "lost");
    if (stranded !== undefined) {
      push(
        stranded.level,
        stranded.level === "major"
          ? `card \`${id}\`'s pin at ${stranded.version} is gone`
          : `card \`${id}\`'s pin count at \`${stranded.version}\` changed`,
      );
    }
  } else if (afterLeftover.length > beforeLeftover.length) {
    const stranded = worstStranded(afterLeftover, beforeSet, "gained");
    if (stranded !== undefined) {
      push(
        stranded.level,
        stranded.level === "minor"
          ? `card \`${id}\` gained a pin at ${stranded.version}`
          : `card \`${id}\`'s pin count at \`${stranded.version}\` changed`,
      );
    }
  }
}

/**
 * Which bump a blueprint release demands. Every id ever
 * pinned on either side is checked by `compareVersions` above. On top of
 * that, the raw pinned refs are compared by count regardless of whether
 * they parsed, and the DOT text is compared byte for byte — three checks
 * whose reasons are pooled and whose strongest wins, `none` only when none
 * of the three found anything.
 */
export function inferBlueprintBump(previous: BlueprintSnapshot, next: BlueprintSnapshot): BumpAnalysis {
  const reasons: Reason[] = [];
  const push = (level: Reason["level"], message: string): void => {
    reasons.push({ level, message });
  };

  const before = versionsById(previous.cardRefs);
  const after = versionsById(next.cardRefs);
  const ids = new Set([...before.keys(), ...after.keys()]);
  for (const id of ids) {
    compareVersions(id, before.get(id) ?? [], after.get(id) ?? [], push);
  }

  // The membership safety net: whatever the id-keyed pairing above could not
  // price, a raw-count difference still means the pinned refs did not
  // survive unchanged. Redundant with a reason already pushed above and
  // harmless when it is — `summarize` takes the strongest reason, not the
  // first.
  if (!sameCounts(refCounts(previous.cardRefs), refCounts(next.cardRefs))) {
    push("patch", "the pinned card refs changed");
  }

  if (previous.dot !== next.dot) {
    push("patch", "topology text changed");
  }

  return summarize(reasons);
}
