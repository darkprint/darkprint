/* ============================================================
   DarkPrint backend — validating a vocabulary before it is stored
   `validate()` on a view built by `ontologyView` is the whole
   check; this file only chooses which channel the terms arrive
   through, and that choice decides what the result can contain.
   ============================================================ */

import { hasErrors, ontologyView } from "@/lib/core";
import type { Diagnostic, OntologyTerm } from "@/lib/core";
import { asOntology, UNVERSIONED } from "./vocabulary";

/**
 * Structural diagnostics for a term set: `ontology/dangling-pointer` and
 * `ontology/cyclic-broader`.
 *
 * **Its silence on doc 3 §7's local-term rules is deliberate, not a gap.** `terms` goes in as
 * `ontologyView`'s `base`, not as its `extensions`, because `resolve.ts:151-153` states that a
 * term is local "because it arrived through the extension channel, not because of how its id
 * is spelled". This function takes one array and cannot distinguish the two channels, so
 * partitioning by namespace and feeding the namespaced half in as extensions would contradict
 * the core module's own semantics — and would report `ontology/local-term-unrooted` against a
 * curated core term that merely has a slash in its id.
 *
 * The consequence, stated so a later reader does not read it as a bug: `phase-not-extensible`,
 * `local-term-unrooted`, `local-marker-unweighted` and `local-marker-bad-weight` are reported
 * by `openView(db, version, extensions).validate()`, which is where a local overlay actually
 * arrives. This function answers the narrower, honest question — is this term set structurally
 * sound on its own.
 */
export function validateVocabulary(terms: readonly OntologyTerm[]): Diagnostic[] {
  return ontologyView(asOntology(UNVERSIONED, terms)).validate();
}

/** True when `validateVocabulary` found something that must stop a write. */
export function vocabularyIsUnstorable(diagnostics: readonly Diagnostic[]): boolean {
  return hasErrors(diagnostics);
}
