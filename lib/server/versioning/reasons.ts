/* ============================================================
   DarkPrint backend — shared bump-reason bookkeeping
   inferBlueprintBump collects a list of {level, message} reasons
   and reports the strongest, mirroring lib/core/version/bump.ts's
   inferBump for cards. Factored out when inferOntologyBump shared
   the sort; that function went with ontology versioning (§11.0
   Q26) and this stayed, because the ranking is the one place the
   order of levels is written down and blueprint-bump.ts is not
   where a second copy belongs.
   ============================================================ */

import type { BumpAnalysis, BumpLevel } from "@/lib/core";

export interface Reason {
  level: Exclude<BumpLevel, "none">;
  message: string;
}

/** Exported so a caller that has to find the strongest of several *candidate* levels
 * before it has reasons to attach to them (e.g. a worst-case pairing search) can rank
 * them the same way `summarize` ranks finished reasons, without a second rank table. */
export const LEVEL_RANK: Record<BumpLevel, number> = { none: 0, patch: 1, minor: 2, major: 3 };

/** Strongest reason wins; ties keep the order they were pushed in. */
export function summarize(reasons: readonly Reason[]): BumpAnalysis {
  if (reasons.length === 0) return { level: "none", reasons: [] };
  const ordered = reasons
    .map((reason, index) => ({ reason, index }))
    .sort((a, b) => LEVEL_RANK[b.reason.level] - LEVEL_RANK[a.reason.level] || a.index - b.index)
    .map((entry) => entry.reason);
  return { level: ordered[0].level, reasons: ordered.map((r) => r.message) };
}
