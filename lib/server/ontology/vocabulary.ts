/* ============================================================
   DarkPrint backend — turning stored rows back into an `Ontology`
   `ontologyView(base: Ontology, extensions?)` is the merge and is
   consumed, never reimplemented. It takes an `Ontology`, which is
   `{ version, title, terms }`.

   **The schema has no title column.** `ontology_version` is
   `id, version, digest, created_at`; `OntologyVersionRecord` has no
   `title`; `addOntologyVersion`'s input has no `title`. So the one
   field `Ontology` requires and storage does not hold has to come
   from somewhere, and the somewhere is this constant.

   It is a constant rather than a guess because `lib/db/schema.ts`
   says the table is "one row per published version of the *core*,
   shared vocabulary" — every row is that one vocabulary, so its
   title is not per-row data. The literal is kept here rather than
   imported from `CORE_ONTOLOGY` so the store does not take a
   507-line vocabulary as a runtime dependency for one string, and
   so this gap stays visible at the site that has it.

   Duplicating a literal is how `bundle_owner_slug_key` drifted, so
   `vocabulary.test.ts` asserts this equals `CORE_ONTOLOGY.title` —
   a test imports freely without putting the dependency in the
   module, and the drift is caught the day someone edits either one.

   **The day a non-core vocabulary is versioned, this constant is
   the thing that has to become a column.**
   ============================================================ */

import type { Ontology, OntologyTerm } from "@/lib/core";

/** Must equal `CORE_ONTOLOGY.title`; `vocabulary.test.ts` is what holds the two together. */
export const CORE_VOCABULARY_TITLE = "DarkPrint core vocabulary";

/**
 * The version `validateVocabulary` labels its throwaway `Ontology` with.
 *
 * `validate()` never reads `Ontology.version` — it reports on terms — so this value cannot
 * reach a diagnostic or any caller. It exists because the type requires a string, and it is
 * named rather than inlined so it is obviously not a real version anybody stored.
 */
export const UNVERSIONED = "0.0.0";

/** Assemble the `Ontology` shape `ontologyView` consumes from what storage actually holds. */
export function asOntology(version: string, terms: readonly OntologyTerm[]): Ontology {
  return { version, title: CORE_VOCABULARY_TITLE, terms };
}
