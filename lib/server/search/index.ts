/* ============================================================
   DarkPrint backend — lib/server/search public surface
   `lib/core/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   `lib/server/search` should reach for one (T000 contract, D-01).
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   Four verbs and two shapes, which is the task's published block
   with D-200-08's correction applied: the two searchers over the
   registry answer `BlueprintSummary` and `CardSummary` — T080's
   multi-owner records — and NOT `lib/core`'s `BlueprintRecord` and
   `CardVersionRecord`, which are the index of a single-owner
   archive and carry no owner at all.

   `BlueprintSummary`, `CardSummary` and `OntologyTerm` are NOT
   re-exported here. They belong to T080 and to `lib/core`, and
   republishing them would make this module look like the author of
   shapes it only returns — `lib/server/lineage/index.ts`'s rule
   about `BundleRecord`, applied to the same situation.

   The message literal is NOT exported. A test that imports its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.
   ============================================================ */

export type { Hit, Results } from "./types";

/* D-13's boundary. One class, because this module authors no refusal of its own: every
   absent, empty or unrecognised answer in the surface below is a VALUE. The reasoning and
   the properties that keep it true are in `errors.ts`. */
export { SearchStoreError } from "./errors";
export { withSearchStore } from "./store";

/* The transport boundary. Here rather than beside the routes because `app/api/**` holds
   route handlers and nothing else (D-01); T080, T050 and T110 put theirs in the same place. */
export { withSearchErrors } from "./http";

/* Also transport, and also this task's own rather than the published block's: D-200-16
   publishes three routes and all three have to turn a query string into the
   `Record<string, string>` the searchers take. Published here rather than repeated in each
   handler, because three copies of a first-wins rule is three places for it to stop being
   first-wins. */
export { searchParams } from "./params";

export { searchBlueprints } from "./blueprints";
export { searchCards } from "./cards";
export { searchTerms } from "./terms";
export { reembedRelease } from "./reembed";
