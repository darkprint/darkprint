/* ============================================================
   DarkPrint backend — archive: published record shapes
   Mirrors what `addRelease` stores (second amendment, backend.md,
   T010): the only door T080, T090 and T100 have to a release's
   content, since none of them own `lib/db/schema.ts` and the
   layering rule forbids reaching past this module's own barrel.
   ============================================================ */

import type { AutonomyResult, BundleManifest, PhaseCoverage, SecurityResult } from "@/lib/server/types";

/**
 * The published shape of `release.local_vocabulary` (D-133-01). `null` is the other legal
 * column value, and `toReleaseRecord` turns it into an absent field rather than a `null` one.
 *
 * **Derived, not invented.** Every clause already had a merged reader enforcing it and nobody
 * had written it down, which is the whole defect T133 exists to close: `storedVocabulary`
 * (`lib/server/export/vocabulary.ts`) and `parseOntologyTerms`
 * (`lib/content/ontology-file.ts`) jointly determine this shape, and until now the only place
 * in the tree that stated an interpretation was a comment in `lib/db/schema.ts` that stated
 * the **refused** one — which is what directed T130's blind author to a bare array.
 *
 * `terms` is `readonly unknown[]` rather than `readonly OntologyTerm[]` on purpose. What a
 * term is belongs to T030's grammar and is checked by `parseOntologyTerms`; typing the
 * element here would be this module taking a second opinion on it. The division is real
 * rather than an omission: the type admits `terms: [42]` and the write still refuses it,
 * because the write runs that parser (D-133-03).
 */
export interface StoredVocabulary {
  /** The vocabulary file, byte for byte, so `exportBundle` can write it out unaltered (D-90-03). */
  text: string;
  /** Absent or `null` means "this release adds nothing to the core"; present means a list of term mappings. */
  terms?: readonly unknown[] | null;
}

/**
 * 0007_drafts: the bundle's own details, present before any release exists and
 * still readable afterward. Optional and never `null` on this record — `null`
 * is the column's "not written" value and `toBundleRecord` turns it into an
 * absent field, the same convention `PublicAuthor.bio` uses and for the same
 * reason (D-50-09): an absent key is what a caller checking `"title" in record`
 * or serializing to JSON both agree means "no title", where a `null` would be
 * a second spelling of the same fact.
 */
export interface BundleRecord {
  id: string;
  ownerId: string;
  slug: string;
  visibility: "public" | "private";
  lineage?: { ownerId: string; slug: string; version: string };
  title?: string;
  summary?: string;
  description?: string;
  category?: string;
  tags?: readonly string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseRecord {
  id: string;
  bundleId: string;
  version: string;
  digest: string;
  createdAt: Date;
  dot: string;
  manifest: BundleManifest;
  cardRefs: readonly string[];
  cardDigests: readonly string[];
  /**
   * Typed rather than `unknown` (D-133-02 F5): this was the exact line the contract quoted as
   * the defect, because every reader took `unknown` off the barrel and re-derived the shape.
   * The cast in `toReleaseRecord` is a claim about a row, and a row can reach a refused shape
   * without passing `addRelease` — so the readers keep refusing, and this type is a
   * convenience for them rather than a guarantee to them.
   */
  vocabulary?: StoredVocabulary;
  analysis?: { autonomy: AutonomyResult; security: SecurityResult; phaseCoverage: PhaseCoverage };
}
