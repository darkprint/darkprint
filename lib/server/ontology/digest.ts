/* ============================================================
   DarkPrint backend — ontology version identity
   `sha256:<64 hex>` over the canonical JSON of the vocabulary, the
   same shape `cardDigest` and `bundleDigest` produce.

   **`version` is inside the digest.** `lib/core/hash/digest.ts:26`
   states the repo's rule outright — everything but `author` and
   `provenance` is in the identity, "`version` and `ontologyVersion`
   among them" — so a vocabulary's identity includes which version
   it is. The competing reading, terms only, would let the digest
   answer "is this the same set of terms" instead; that question is
   `inferOntologyBump`'s (T025), which compares term arrays and
   never consults a digest.

   Terms are sorted by id before hashing, so the order they arrived
   in cannot change the result. They are *not* deduplicated: the
   store rejects a duplicate `(version, term_id)` at the unique
   index, and silently collapsing one here would hide that.

   Computed in `lib/server/ontology/**` rather than added to
   `lib/core/hash/digest.ts`, which is not this task's to extend.
   ============================================================ */

import { canonicalJson, sha256Hex } from "@/lib/core";
import type { OntologyTerm } from "@/lib/core";

const ALGORITHM = "sha256";

/** Code-unit order — a digest must not depend on the host locale. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The digest stored on `ontology_version.digest`.
 *
 * Assumes a vocabulary that has already been through `findUnrepresentable`: a non-finite
 * number or a circular structure throws out of `canonicalJson`, which is why the store
 * refuses both before it reaches here.
 */
export function ontologyDigest(input: {
  version: string;
  terms: readonly OntologyTerm[];
}): string {
  const terms = input.terms.slice().sort((a, b) => byCodeUnit(a.id, b.id));
  return `${ALGORITHM}:${sha256Hex(canonicalJson({ terms, version: input.version }))}`;
}
