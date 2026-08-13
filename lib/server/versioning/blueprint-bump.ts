/* ============================================================
   DarkPrint backend — versioning: blueprint bump inference
   backend.md T025. A blueprint's diff is its DOT plus the set of
   card refs it pins; nothing else moves a blueprint's version.

   A ref the write-site validator would refuse is still a member of
   that set: "never answer `none` for input you could not read"
   (backend.md §T025). So a ref is read two ways, not one — an id
   parses out where it can, for a repin priced by semver, and the
   raw refs are always compared as a set on top, so a member cannot
   vanish just because it did not parse.
   ============================================================ */

import type { BumpAnalysis } from "@/lib/core";
import { declaredBump } from "@/lib/core";

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

/** First occurrence wins, mirroring lib/core/version/bump.ts's `portsByName`. */
function pinsById(refs: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const ref of refs) {
    const parsed = splitRef(ref);
    if (parsed === undefined) continue;
    if (!map.has(parsed.id)) map.set(parsed.id, parsed.version);
  }
  return map;
}

/**
 * `previous.cardRefs`/`next.cardRefs` as sets, per the contract's own word for
 * them: "nothing else moves a blueprint's version" than "the set of card refs
 * it pins" — a set, not a multiset, so a ref repeated a different number of
 * times either side is not itself a change (`pinsById`'s map already reads
 * one occurrence as the whole story for repin pricing; this is the
 * membership half, over the raw strings, so an id that never parsed cannot
 * silently drop out of the comparison).
 */
function refSet(refs: readonly string[]): Set<string> {
  return new Set(refs);
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/**
 * Which bump a blueprint release demands (backend.md T025). Repinning a
 * pinned card id to a new version carries that version's own bump size — a
 * major repin is itself major. Losing a pinned card id entirely breaks
 * anything that depended on the node it named, so that is major too; pinning
 * a new one grows the graph without breaking what was already there, so that
 * is minor. Everything else the DOT text or the pinned-ref set can change —
 * labels, comments, a reorder of the same pins, a ref that does not parse
 * into an id and a version at all — is a patch, the safety net that mirrors
 * `lib/core/version/bump.ts`'s "patch otherwise": something in the
 * contract's whole unit (the DOT plus the set of card refs) moved, so
 * `none` is never the right answer for it, even when nothing here can say
 * exactly how large the move was.
 */
export function inferBlueprintBump(previous: BlueprintSnapshot, next: BlueprintSnapshot): BumpAnalysis {
  const reasons: Reason[] = [];
  const push = (level: Reason["level"], message: string): void => {
    reasons.push({ level, message });
  };

  const before = pinsById(previous.cardRefs);
  const after = pinsById(next.cardRefs);

  for (const [id, version] of before) {
    const updated = after.get(id);
    if (updated === undefined) {
      push("major", `card \`${id}\` is no longer pinned`);
      continue;
    }
    if (updated === version) continue;
    // A downgrade, or a version half that is not semver at all (`@latest`),
    // declares no bump of its own; the repin itself still changed something,
    // so it falls to "patch otherwise" rather than going unreported.
    const level = declaredBump(version, updated);
    push(level === "none" ? "patch" : level, `card \`${id}\` repinned: ${version} → ${updated}`);
  }
  for (const [id, version] of after) {
    if (!before.has(id)) push("minor", `card \`${id}\` was pinned at ${version}`);
  }

  // The membership safety net: whatever the id-keyed pairing above could not
  // price, a raw-set difference still means the pinned refs did not survive
  // unchanged. Redundant with a reason already pushed above and harmless
  // when it is — `summarize` takes the strongest reason, not the first.
  if (!sameSet(refSet(previous.cardRefs), refSet(next.cardRefs))) {
    push("patch", "the pinned card refs changed");
  }

  if (previous.dot !== next.dot) {
    push("patch", "topology text changed");
  }

  return summarize(reasons);
}
