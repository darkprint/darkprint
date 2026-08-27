/* ============================================================
   DarkPrint backend — lib/server/registry public surface
   Nineteen readers, each taking an `Actor`, plus the record shapes
   they return, plus the fault path every one shares. Deep paths
   are internal; nothing outside this module should reach for one
   (T000 contract, D-01).

   Thirteen until T132. The three amendments are all to this task's
   published record and each was ruled rather than proposed:
   `graphsOf` and `scoresFor` are D-132-01's, owed to T260 under
   D-260-14 and D-260-21, and they ship together — a batch scorecard
   reader alone makes a shelf fast at returning nothing while
   D-260-24 stands. `cardsOwnedBy` is D-132-02's reading (a) of
   T130's blocked `counts.cards`: the one card reader deliberately
   outside the pin index, because ownership and indexing are
   different questions and the count has to answer the first.
   `usersOfMany` joined at T260's merge (D-260-31), and `draftBundle`
   / `ownedBundles` at 0007_drafts (T280) — see `owned.ts` for why
   those two read `bundle` directly rather than through the shared
   snapshot every other reader here builds from.

   The message literal is NOT exported. A test that imports its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.
   ============================================================ */

export type {
  BlueprintKey,
  BlueprintSchematic,
  BlueprintSummary,
  CardSummary,
  DraftBundle,
  OwnedBundleSummary,
  Scores,
} from "./types";
/* `BlueprintSchematic.graph` is `lib/types.ts`'s `BlueprintGraph` and is NOT re-exported
   here. `types.ts` says why: a caller binding `graphsOf` reaches it from `@/lib/types`,
   which is where the row component that draws it already reads it, so republishing it
   from a server barrel would put a second address on one type. */

/* D-13's boundary. One class, because this module authors no refusal of its own — every
   absent, invisible or empty answer above is a VALUE, so there is no decision for the
   wrapper to pass through. Measured rather than assumed; the reasoning and the guard that
   keeps it true are in `errors.ts` and `fault-path.test.ts`. */
export { RegistryStoreError } from "./errors";
export { withRegistryStore } from "./store";
export { withRegistryErrors } from "./http";

export { blueprint, blueprints } from "./blueprints";
/* 0007_drafts (T280). Two readers over `bundle` directly — `owned.ts`'s header says why
   they do not go through `loadSnapshot`, and in particular why its release-skip for the
   public archive shelf is untouched by either. */
export { draftBundle, ownedBundles } from "./owned";
export { card, cards, cardsOwnedBy, latestCards, versionsOf } from "./cards";
export { graphsOf } from "./graphs";
export { duplicates, usersOf, usersOfMany } from "./joins";
export { cardsByPhase, categories, phases, tags } from "./facets";
export { scoresFor, scoresOf } from "./scores";

/**
 * The route boundary's `Request` -> `Actor` step. Published here rather than deep-imported
 * by the handlers; it is not part of the query surface, and it moves to T050 when accounts
 * and sessions arrive with somewhere better for it to live.
 */
export { actorFrom } from "./actor";
