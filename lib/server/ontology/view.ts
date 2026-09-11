/* ============================================================
   DarkPrint backend — opening a merged view
   The verb is `open`, not `get`, and the difference is AC5.

   `isA` memoizes per view instance (`resolve.ts:196`, the `chains`
   map), and two bundles' scores are only comparable when they were
   resolved against the *same* instance
   (`lib/content/read.ts:104-154`). So the caller opens one view and
   reuses it for a whole resolution batch; a function that built a
   fresh view per call could not satisfy AC5 however it was tested.

   ── There is no version to open against ──
   This used to take a `Db` and a version string, read the terms of
   that published version out of `ontology_version` / `ontology_term`,
   and refuse a version nobody had published. **Nothing consumed the
   resolution.** A release stores its whole scorecard when it is
   published (`release.autonomy`, `release.security`,
   `release.phase_coverage`), so a published score is a fact written
   once and never recomputed against an older vocabulary — which is
   the only thing reading a historical version could have been for.
   Two further facts settled it: `deprecated: {since, replacedBy}`
   already lets the one living vocabulary add and retire terms
   without minting a version, and half of what a score depends on
   was never versioned at all (`DARKPRINT_CONFIG.security.weights`
   has no version and never had one), so a resolvable vocabulary
   version could not have made a score reproducible even in
   principle.

   What survives is the part that was doing work: the OVERLAY merge.
   `extensions` is a bundle's own local vocabulary, supplied per
   bundle by the caller from the release that declares it, and it is
   the reason this function exists at all rather than every caller
   naming `CORE_ONTOLOGY` itself. An overlay term sharing an id
   replaces the core term *in place*, keeping its position, and the
   shadowing is reported by `validate()` as
   `bundle/ontology-mismatch` — both are `ontologyView`'s behaviour,
   consumed here rather than reimplemented.

   It is synchronous, and that is the whole visible shape of the
   change at every call site.
   ============================================================ */

import { CORE_ONTOLOGY, ontologyView } from "@/lib/core";
import type { OntologyTerm, OntologyView } from "@/lib/core";

/**
 * Open one merged view over the living vocabulary, with a bundle's local overlay layered on.
 *
 * The merged view keeps the **core's** version (AC1), which is what a score records as the
 * vocabulary it was computed under: `BlueprintAnalysis.ontologyVersion` reads
 * `bp.ontology.ontology.version` and is stored on the release beside the score.
 */
export function openView(extensions?: readonly OntologyTerm[]): OntologyView {
  return ontologyView(CORE_ONTOLOGY, extensions);
}
