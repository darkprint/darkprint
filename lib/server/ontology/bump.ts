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

   **T025 has merged**, so this is now the real call: infer the
   bump between the previously published terms and the candidate's,
   hand both the inference and the declared version to
   `checkDeclaredBump("ontology", …)`, and return what it says. The
   inference and the refusal are still T025's; this file only knows
   which two term lists to compare and that the subject is an
   ontology.

   Four of `inferOntologyBump`'s behaviours are not obvious from its
   signature and are depended on here, confirmed by T025's own
   adversary: duplicate term ids collapse **first-wins**, which is
   set semantics and deliberately unlike the blueprint half's
   multiset; cutting a middle `broader` link propagates major to
   **every** descendant rather than the edited term alone; a
   `broader` pointing at a term that does not exist reads as a
   gained ancestor and so minor, because a dangling pointer is
   `lib/core`'s to catch and not this path's; and deprecating a term
   is never a removal, while deprecating *and* removing it is
   major.
   ============================================================ */

import type { Diagnostic, OntologyTerm } from "@/lib/core";
import { checkDeclaredBump, inferOntologyBump } from "@/lib/server/versioning";

/**
 * Whether `declaredVersion` is a large enough bump for what changed between `previous` and
 * `next`. Empty means it is; otherwise the diagnostics say why, and
 * `ontology/version-bump-too-small` is the code AC6 names.
 *
 * The arguments are the ones the real call always needed, which is why the seam survived
 * T025's absence as a body change rather than a signature change.
 */
export function checkOntologyBump(input: {
  previous: readonly OntologyTerm[];
  next: readonly OntologyTerm[];
  declaredVersion: string;
  previousVersion: string;
}): Diagnostic[] {
  const inferred = inferOntologyBump(input.previous, input.next);
  return checkDeclaredBump("ontology", input.previousVersion, input.declaredVersion, inferred);
}
