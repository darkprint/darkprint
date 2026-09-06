/* ============================================================
   DarkPrint backend — lib/server/ballot, and nothing in it

   This folder holds no code. It is a placeholder with one job:
   `tests/error-hygiene.test.ts` builds its domain from
   `git ls-tree -d backend lib/server/` and THROWS on a module that
   ref lists with no importable barrel, so a folder `backend` still
   names cannot leave the working tree ahead of the commit that
   takes it off `backend`. Deleting it early does not fail the
   equality it is exempt from; it fails with `absent from this
   checkout: ballot`, which tells every session sharing this tree to
   merge `backend`, and merging does not fix it.

   **Delete this directory in the commit that lands §11.0 Q34.** The
   equality does not move: T160's two error classes came off at Q14
   and this barrel has published none since.

   ── What was here ──
   T160 published five shapes and two functions. Q14 deleted
   `castBallot`, `getAggregate`, `aggregateFrom`, `withBallotErrors`
   and both error classes with the route above them, on the owner's
   ruling that the ballot came off the blueprint page. Two TYPES
   outlived them, kept only because `lib/content/view.ts` named them
   for its `live.aggregate` input; they are declared in that file
   now, beside their one reader (§11.0 Q34).

   The `ballot` TABLE is a separate question and stays:
   `lib/server/lifecycle/bundle-deletion.ts` and `deletion.ts`
   cascade through it, so dropping it would break deletion.
   ============================================================ */

export {};
