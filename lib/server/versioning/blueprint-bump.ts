/* ============================================================
   DarkPrint backend — versioning: blueprint bump inference
   backend.md T025. A blueprint's diff is its DOT plus the set of
   card refs it pins; nothing else moves a blueprint's version.
   ============================================================ */

import type { BumpAnalysis } from "@/lib/core";
import { declaredBump, parseCardRef } from "@/lib/core";

import { summarize, type Reason } from "./reasons";

/** The two fields that decide a blueprint's version, per backend.md T025. */
export interface BlueprintSnapshot {
  dot: string;
  cardRefs: readonly string[];
}

/** First occurrence wins, mirroring lib/core/version/bump.ts's `portsByName`. */
function pinsById(refs: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const ref of refs) {
    const parsed = parseCardRef(ref);
    // A malformed ref is the validator's problem, not this comparison's: it
    // cannot be attributed to an id, so it cannot be repinned, added or removed.
    if (parsed === undefined) continue;
    if (!map.has(parsed.id)) map.set(parsed.id, parsed.version);
  }
  return map;
}

/**
 * Which bump a blueprint release demands (backend.md T025). Repinning a
 * pinned card id to a new version carries that version's own bump size — a
 * major repin is itself major. Losing a pinned card id entirely breaks
 * anything that depended on the node it named, so that is major too; pinning
 * a new one grows the graph without breaking what was already there, so that
 * is minor. Everything else the DOT text can change — labels, comments, a
 * reorder of the same pins — is a patch, the safety net that mirrors
 * `lib/core/version/bump.ts`'s "patch otherwise": "the set of card refs it
 * pins" is the whole structural surface this function is told to read, so a
 * reorder of that set carries no meaning of its own.
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
    // A downgrade or an unparseable pair declares no bump of its own; the
    // repin itself still changed something, so it falls to "patch otherwise".
    const level = declaredBump(version, updated);
    push(level === "none" ? "patch" : level, `card \`${id}\` repinned: ${version} → ${updated}`);
  }
  for (const [id, version] of after) {
    if (!before.has(id)) push("minor", `card \`${id}\` was pinned at ${version}`);
  }

  if (previous.dot !== next.dot) {
    push("patch", "topology text changed");
  }

  return summarize(reasons);
}
