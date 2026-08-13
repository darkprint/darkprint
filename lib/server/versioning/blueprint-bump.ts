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

import type { BumpAnalysis } from "@/lib/core";
import { compareVersionStrings, declaredBump } from "@/lib/core";

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

/**
 * Every parseable ref's version, grouped by id and sorted. Sorted so that
 * which node happened to come first in the DOT cannot change the answer —
 * comparing two id-keyed lists position by position is only order-independent
 * once both are in the same canonical order — and never deduplicated, because
 * two nodes pinning one id at one version are two entries, the same reason
 * `bundleDigest` never deduplicates `cardDigests`.
 */
function versionsById(refs: readonly string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const ref of refs) {
    const parsed = splitRef(ref);
    if (parsed === undefined) continue;
    const versions = map.get(parsed.id);
    if (versions) versions.push(parsed.version);
    else map.set(parsed.id, [parsed.version]);
  }
  for (const versions of map.values()) versions.sort(compareVersionStrings);
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
 * One id's sorted version list, before and after, compared position by
 * position up to the shorter length — a version that moved there, priced by
 * `declaredBump` — and then whatever the longer list has left over: a
 * version that also appears somewhere on the shorter side is a pure
 * multiplicity change (a second node now pinning, or no longer pinning,
 * what another node already pins) and is at least a `patch`, since the
 * bytes and the digest both moved even though the declared surface did not;
 * a version that appears nowhere on the other side is a pin genuinely
 * gained (minor) or genuinely lost (major). An id absent from one side
 * supplies an empty list here, which this same logic reads correctly as
 * "every occurrence gained" or "every occurrence lost" with no extra branch.
 */
function compareVersions(
  id: string,
  beforeVersions: readonly string[],
  afterVersions: readonly string[],
  push: (level: Reason["level"], message: string) => void,
): void {
  const n = Math.min(beforeVersions.length, afterVersions.length);
  const beforeSet = new Set(beforeVersions);
  const afterSet = new Set(afterVersions);

  for (let i = 0; i < n; i++) {
    if (beforeVersions[i] === afterVersions[i]) continue;
    // A downgrade, or a version half that is not semver at all (`@latest`),
    // declares no bump of its own; the repin itself still changed something,
    // so it falls to "patch otherwise" rather than going unreported.
    const level = declaredBump(beforeVersions[i], afterVersions[i]);
    push(level === "none" ? "patch" : level, `card \`${id}\` repinned: ${beforeVersions[i]} → ${afterVersions[i]}`);
  }
  for (let i = n; i < afterVersions.length; i++) {
    const version = afterVersions[i];
    if (beforeSet.has(version)) {
      push("patch", `card \`${id}\`'s pin count at \`${version}\` changed`);
    } else {
      push("minor", `card \`${id}\` gained a pin at ${version}`);
    }
  }
  for (let i = n; i < beforeVersions.length; i++) {
    const version = beforeVersions[i];
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
