/* ============================================================
   DarkPrint backend — AC6's call site, and only its call site
   AC6: "publishing an ontology version that removes a term is
   inferred major and refused if declared minor."

   **This criterion is red on purpose, and the red is the honest
   answer.** Inferring the bump is `inferOntologyBump(previous,
   next)` and refusing a too-small declaration is
   `checkDeclaredBump("ontology", …)`, both T025's published
   surface, both in `lib/server/versioning/**`, which is Forbidden
   to this task and has not merged. Unlike the card path, neither
   exists in `lib/core` — `ontology/version-bump-too-small` is a
   declared diagnostic code that nothing computes for ontologies
   yet.

   Reimplementing the inference here to turn the criterion green is
   the one thing that must not happen: two implementations of one
   rule is precisely the defect the partition exists to prevent,
   and a green criterion that lies costs more than a red one that
   does not. So this file is a single named function that reports
   the absent dependency and nothing else.

   **When T025 merges**, this becomes: infer the bump between the
   latest stored version's terms and the candidate's, then hand
   both the inference and the declared version to
   `checkDeclaredBump`, and refuse on
   `ontology/version-bump-too-small`. The call belongs in
   `addOntologyVersion`, after `validateVocabulary` and before the
   digest.
   ============================================================ */

import type { OntologyTerm } from "@/lib/core";

import { VersioningUnavailableError } from "./errors";

/**
 * Refuse a declared version whose bump is smaller than the terms imply.
 *
 * Throws `VersioningUnavailableError` until T025 ships. It takes the arguments it will need
 * so the shape of the call site is fixed now and the seam is a body change rather than a
 * signature change — and so a caller wiring it today fails loudly rather than silently
 * skipping the check.
 */
export function checkOntologyBump(input: {
  previous: readonly OntologyTerm[];
  next: readonly OntologyTerm[];
  declaredVersion: string;
  previousVersion: string;
}): never {
  // Referenced rather than prefixed with `_`: this repo's eslint warns on an unused argument
  // whatever it is named, and the argument has to stay so the seam is a body change later.
  void input;
  throw new VersioningUnavailableError(
    "Ontology bump inference is T025's `lib/server/versioning/**`, which has not shipped. AC6 cannot be satisfied from this module, and inferring the bump here would be a second implementation of one rule.",
  );
}
