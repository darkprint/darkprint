/* ============================================================
   DarkPrint backend — lib/server/saves public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   this folder should reach for one (T000 contract, D-01).
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   ── What is published beyond the block, and why ──
   T140's block publishes five functions and `SaveRecord`. Two more
   type names ship here, on the accounts barrel's precedent of
   publishing what a caller cannot branch on without:

   * `SaveTarget` — the shape three of the five take. The block
     writes it inline at each of them, so without a name every
     consumer retypes the union — and **a third naming of the same
     three kinds is one more place for them to drift.**
   * `SaveTargetKind` — the union itself, for a caller narrowing a
     string before it builds a target.

   Neither widens the surface: both are the block's own literals
   given a name, and `SaveRecord`'s key set is unchanged.

   ── What is NOT published here ──
   **`NotAccountOwnerError` is not re-exported**, although the
   three writers raise it. It is `@/lib/server/accounts`', and the
   accounts barrel states the rule in its own header for the two
   naming classes it declines to re-export: publishing another
   module's rejection under this module's name invites the
   re-rendering D-50-08 forbids. A caller branching on an ownership
   denial imports the class from the barrel that owns it, and gets
   the same class this module throws — which is the whole point of
   consuming it rather than minting one.

   It also keeps `tests/error-hygiene.test.ts` honest: that walk
   counts every error class exported from every barrel, so a
   re-export would be counted a second time and the equality would
   move by two for one new class.

   **The message literal is not exported either.** A test that
   imports its expected message from the module under test asserts
   that the module agrees with itself, and passes unchanged the day
   the wording starts interpolating something it should not.
   ============================================================ */

export type { SaveRecord, SaveTarget, SaveTargetKind } from "./types";

/* D-13's boundary. One class, because this module authors exactly one decision and that
   decision is another module's published class (D-140-02). The reasoning, and the
   measurement behind it, are in `errors.ts`. */
export { SaveStoreError } from "./errors";

export { countSaves, listSaves } from "./read";
export { migrateLocalSaves, saveTarget, unsaveTarget } from "./write";

/* The transport boundary, published by D-140-07. Here rather than beside the four route
   files for T050's and T081's reason: handlers that share a wrapper need somewhere shared,
   and `app/api/**` holds route handlers and nothing else. */
export type { SavesView } from "./http";
export { savesViewFor, targetFrom, targetsFrom, withSaveErrors } from "./http";
