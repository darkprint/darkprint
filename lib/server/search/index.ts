/* ============================================================
   DarkPrint backend — lib/server/search public surface
   `lib/core/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   `lib/server/search` should reach for one.
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   The two searchers over the registry answer `BlueprintSummary`
   and `CardSummary`, the registry's multi-owner records, and not
   `lib/core`'s single-owner archive records, which carry no owner.

   `BlueprintSummary`, `CardSummary` and `OntologyTerm` are NOT
   re-exported here. They belong to the registry and to `lib/core`,
   and republishing them would make this module look like the
   author of shapes it only returns.

   The message literal is NOT exported. A test that imports its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.
   ============================================================ */

export type { Hit, Results } from "./types";

/* One error class, because this module authors no refusal of its own: every absent, empty
   or unrecognised answer in the surface below is a VALUE. The reasoning and the properties
   that keep it true are in `errors.ts`. */
export { SearchStoreError } from "./errors";
export { withSearchStore } from "./store";

/* The transport boundary. Here rather than beside the routes because `app/api/**` holds
   route handlers and nothing else. */
export { withSearchErrors } from "./http";

/* Also transport: three routes have to turn a query string into the `Record<string, string>`
   the searchers take. Published here rather than repeated in each handler, because three
   copies of a first-wins rule is three places for it to stop being first-wins. */
export { searchParams } from "./params";

export { searchBlueprints } from "./blueprints";
export { searchCards } from "./cards";
export { searchTerms } from "./terms";
export { reembedRelease, reembedCard, reembedAll } from "./reembed";
export type { ReembedSweep } from "./reembed";

/* Whether this process can encode. Published for the health route, which has to say so
   without running a search; the constants and `embed` itself stay internal. */
export { encoderAvailable, encoderFailure } from "./embed";
