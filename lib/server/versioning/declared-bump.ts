/* ============================================================
   DarkPrint backend — versioning: declared-vs-inferred bump check
   backend.md T025. The shared refusal all three stores use when a
   release's declared semver bump is smaller than the change
   actually requires.
   ============================================================ */

import type { BumpAnalysis, BumpLevel, Diagnostic, DiagnosticCode } from "@/lib/core";
import { bumpSatisfies, declaredBump, error, formatSemver, parseSemver } from "@/lib/core";

/** What kind of release is being checked; picks the diagnostic's namespace. */
export type BumpSubject = "card" | "bundle" | "ontology";

const CODE_BY_SUBJECT: Record<BumpSubject, DiagnosticCode> = {
  card: "card/version-bump-too-small",
  bundle: "bundle/version-bump-too-small",
  ontology: "ontology/version-bump-too-small",
};

/** The lowest version that would satisfy `level`, mirroring `lib/core/card/validate.ts`'s `nextVersionFor`. */
function nextVersionFor(previousVersion: string, level: BumpLevel): string | undefined {
  const v = parseSemver(previousVersion);
  if (v === undefined) return undefined;
  switch (level) {
    case "major":
      return formatSemver({ major: v.major + 1, minor: 0, patch: 0 });
    case "minor":
      return formatSemver({ major: v.major, minor: v.minor + 1, patch: 0 });
    case "patch":
      return formatSemver({ major: v.major, minor: v.minor, patch: v.patch + 1 });
    default:
      return undefined;
  }
}

/**
 * Refuses a release whose declared semver bump is smaller than `inferred`
 * demands; returns `[]` when the declared version is at least as strong.
 * `subject` picks the diagnostic's namespace — the caller states what it is
 * checking, and this function alone owns the code that names it, so two
 * callers can never label the same refusal differently. Mirrors
 * `lib/core/card/validate.ts`'s private `checkVersionBump`, generalized past
 * `NodeCard` to the two version strings and the `BumpAnalysis` every subject
 * already has to compute for itself.
 */
export function checkDeclaredBump(
  subject: BumpSubject,
  previous: string,
  declared: string,
  inferred: BumpAnalysis,
): Diagnostic[] {
  const declaredLevel = declaredBump(previous, declared);
  if (bumpSatisfies(declaredLevel, inferred.level)) return [];

  const target = nextVersionFor(previous, inferred.level);
  const what =
    declaredLevel === "none"
      ? `Version \`${declared}\` is unchanged from \`${previous}\``
      : `Version \`${declared}\` is only a ${declaredLevel} bump on \`${previous}\``;
  const reasons = inferred.reasons.length > 0 ? ` ${inferred.reasons.join("; ")}.` : "";

  return [
    error(CODE_BY_SUBJECT[subject], `${what}, but the changes require a ${inferred.level} bump.`, {
      hint: target ? `Publish \`${target}\` or higher.${reasons}` : reasons.trim(),
    }),
  ];
}
