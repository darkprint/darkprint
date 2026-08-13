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

/**
 * `subject`'s mapping to a code, as an exhaustive switch rather than an
 * object index. A diagnostic's `code` must always be classifiable
 * (backend.md §T025) — unreachable from a typed caller since `subject` is a
 * closed union, but an untyped one (plain JS, an `as` cast) can still call
 * this with a value outside it, and an object index would silently answer
 * `undefined` rather than a `DiagnosticCode` nothing could then filter by.
 * Throwing is the loud, safe answer instead.
 */
function codeFor(subject: BumpSubject): DiagnosticCode {
  switch (subject) {
    case "card":
      return "card/version-bump-too-small";
    case "bundle":
      return "bundle/version-bump-too-small";
    case "ontology":
      return "ontology/version-bump-too-small";
    default: {
      const invalid: never = subject;
      throw new Error(`checkDeclaredBump: "${String(invalid)}" is not a subject this contract names`);
    }
  }
}

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
  // Resolved first and unconditionally: an unclassifiable subject is a
  // programming error regardless of what the bump math below would decide.
  const code = codeFor(subject);

  const declaredLevel = declaredBump(previous, declared);
  if (bumpSatisfies(declaredLevel, inferred.level)) return [];

  const target = nextVersionFor(previous, inferred.level);
  const what =
    declaredLevel === "none"
      ? `Version \`${declared}\` is unchanged from \`${previous}\``
      : `Version \`${declared}\` is only a ${declaredLevel} bump on \`${previous}\``;
  const reasons = inferred.reasons.length > 0 ? ` ${inferred.reasons.join("; ")}.` : "";

  return [
    error(code, `${what}, but the changes require a ${inferred.level} bump.`, {
      hint: target ? `Publish \`${target}\` or higher.${reasons}` : reasons.trim(),
    }),
  ];
}
