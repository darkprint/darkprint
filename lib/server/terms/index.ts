/* ============================================================
   DarkPrint backend — lib/server/terms public surface
   Three readers, the shapes they answer, and the fault path all
   three share. Deep paths are internal; nothing outside this
   module should reach for one (T000 contract, D-01). Re-exports
   are written out by name rather than `export *` so this file
   doubles as the inventory of what the module promises.

   **`refreshUsage` is deliberately absent.** D-210-01 withdrew it
   with the stored projection: the index is computed at read time,
   so there is nothing to refresh, and D-210-09 makes shipping a
   withdrawn verb chargeable — a verb nobody ruled back in is a
   shape nobody ruled on. Its absence is the design, not an
   omission, which is why it is named here rather than left to be
   noticed missing.

   `usage` is the third reader and it was NOT on the published
   block. D-210-09 rules `GET /api/ontology-usage` as every counted
   term and no published reader can answer that — `usageOf` takes
   one id, `candidates` is local-only — so the surface the ruled
   route needs is added here and reported, rather than reached
   around from the handler.

   The message literal is NOT exported. A test importing its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.
   ============================================================ */

export type { PromotionCandidate, TermUsage } from "./types";

/* D-13's boundary. One class, because this module authors no refusal of its own: every
   answer it publishes is a VALUE — zeros for a term nothing names, an empty list for an
   archive with no local terms — so there is no decision for the wrapper to pass through. */
export { TermStoreError } from "./errors";
export { withTermStore } from "./store";
export { withTermErrors } from "./http";

export { usageOf } from "./usage-of";
export { candidates, usage } from "./readers";
