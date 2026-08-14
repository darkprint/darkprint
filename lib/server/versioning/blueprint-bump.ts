/* ============================================================
   DarkPrint backend — versioning: blueprint bump inference
   backend.md T025. A blueprint's diff is its DOT plus the MULTISET
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
   that multiset: "never answer `none` for input you could not read"
   (backend.md §T025). So a ref is read two ways, not one — an id
   parses out where it can, for a repin priced by semver, and the raw
   refs are always compared by count on top, so a member cannot
   vanish just because it did not parse.
   ============================================================ */

import type { BumpAnalysis, BumpLevel } from "@/lib/core";
import { compareSemver, compareVersionStrings, declaredBump, parseSemver } from "@/lib/core";

import { summarize, type Reason } from "./reasons";

/** The two fields that decide a blueprint's version, per backend.md T025. */
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
 * One id's version lists, before and after. Reduced to the leftover only
 * `leftoverVersions` could not cancel out, then compared position by
 * position up to the shorter leftover length — a version that moved
 * there, priced by `repinMagnitude` — and then whatever the longer
 * leftover has left over still: a version that also appears anywhere in
 * the *full* list on the other side is a pure multiplicity change (a
 * second node now pinning, or no longer pinning, what another node
 * already pins) and is at least a `patch`, since the bytes and the digest
 * both moved even though the declared surface did not; a version that
 * appears nowhere on the other side, at any count, is a pin genuinely
 * gained (minor) or genuinely lost (major). An id absent from one side
 * supplies an empty list here, which this same logic reads correctly as
 * "every occurrence gained" or "every occurrence lost" with no extra
 * branch.
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

  const n = Math.min(beforeLeftover.length, afterLeftover.length);
  for (let i = 0; i < n; i++) {
    if (beforeLeftover[i] === afterLeftover[i]) continue;
    // A version half that is not semver at all (`@latest`) prices no
    // magnitude of its own; the repin itself still changed something, so it
    // falls to "patch otherwise" rather than going unreported.
    const level = repinMagnitude(beforeLeftover[i], afterLeftover[i]);
    push(level === "none" ? "patch" : level, `card \`${id}\` repinned: ${beforeLeftover[i]} → ${afterLeftover[i]}`);
  }
  for (let i = n; i < afterLeftover.length; i++) {
    const version = afterLeftover[i];
    if (beforeSet.has(version)) {
      push("patch", `card \`${id}\`'s pin count at \`${version}\` changed`);
    } else {
      push("minor", `card \`${id}\` gained a pin at ${version}`);
    }
  }
  for (let i = n; i < beforeLeftover.length; i++) {
    const version = beforeLeftover[i];
    if (afterSet.has(version)) {
      push("patch", `card \`${id}\`'s pin count at \`${version}\` changed`);
    } else {
      push("major", `card \`${id}\`'s pin at ${version} is gone`);
    }
  }
}

/**
 * Which bump a blueprint release demands (backend.md T025). Every id ever
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
