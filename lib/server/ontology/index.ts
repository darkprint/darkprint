/* ============================================================
   DarkPrint backend — lib/server/ontology public surface
   `lib/core/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   `lib/server/ontology` should reach for one. Re-exports are
   written out by name rather than `export *` so this file doubles
   as the inventory of what the module promises.

   ── It promises one thing now ──
   This module used to be a registry of published vocabulary
   versions: a `store` writing `ontology_version` and
   `ontology_term`, a digest over each version's terms, an
   input-shape check, an unrepresentable-content check, a
   structural validator, a semver bump check for a new version, six
   rejection classes, and `openView(db, version, extensions)` on
   top. All of it existed to answer one question — read this
   release against the vocabulary its manifest names — and nothing
   ever asked it. A release stores its own scorecard at publish
   time, so no score is recomputed against a historical vocabulary;
   `deprecated: {since, replacedBy}` retires a term inside the one
   living vocabulary; and the weights half of the score
   (`DARKPRINT_CONFIG.security.weights`) was never versioned at
   all, so a resolvable version could not have made a score
   reproducible even in principle.

   The tables are gone as well as unread.
   `0009_drop_ontology_versioning` dropped `ontology_version`,
   `ontology_term` and the `release.scored_ontology_version_id`
   column that referenced the first, in that dependency order.
   `lib/db/schema.ts` keeps the reasoning where the declarations
   stood.
   ============================================================ */

/* --------------------- the merged view --------------------- */
export { openView } from "./view";
