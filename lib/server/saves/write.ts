/* ============================================================
   DarkPrint backend — saves: the three writers
   All three return `Promise<void>`, and **that is why this module
   has a decision at all** (D-140-02). A reader can answer a denial
   with a value because "nothing to show" and "not yours" are the
   same sentence to a caller. A writer cannot: `void` carries no
   room for *denied*, so a silent no-op would tell a caller its
   save succeeded when nothing was stored. A write failing silently
   is a different thing from a read declining to distinguish, and
   only the second is what B-03 asks for.

   So each of the three throws `NotAccountOwnerError` — the class
   consumed from `@/lib/server/accounts`, never minted here.

   ── Authorization first, and inside the wrapper ──
   `requireSaveOwner` is the first statement in each `work`, so no
   statement is built for a caller who may not write. It sits
   inside `withStore` rather than before it so the decision travels
   the pass-through arm on the path a caller actually takes, which
   is what gives that arm a witness rather than leaving it a branch
   nothing reaches.

   ── `migrateLocalSaves` shares a statement, it does not call
   `saveTarget` ──
   AC5 describes the migration as `saveTarget` applied N times, and
   that is its SEMANTICS rather than its implementation. Calling
   the published function N times would nest `withStore` inside
   `withStore`, and a sealed fault re-entering the wrapper is the
   relabel `store.ts` exists to refuse — a rendering naming
   `saveTarget` for a failure a caller reached through
   `migrateLocalSaves`. It would also authorise N times and issue N
   statements where one does.

   Both go through `insertSaves`, so the idempotence is one
   `ON CONFLICT DO NOTHING` against `save_account_target_key` in
   both directions and there is no second code path to keep in
   step.
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { requireSaveOwner } from "./guards";
import { deleteSave, insertSaves, withStore } from "./store";
import type { SaveTarget } from "./types";

/**
 * Bookmarks one target for an account. Saving the same target twice stores one row (AC2).
 *
 * Idempotent at the DATABASE rather than by a prior read: `save_account_target_key` is what
 * refuses the second row, and a select-then-insert would pass every sequential test and
 * lose under two concurrent callers. T005's suite holds that discriminating fact, because
 * nothing reachable from this module can tell the two shapes apart.
 */
export async function saveTarget(
  db: Db,
  actor: Actor,
  accountId: string,
  target: SaveTarget,
): Promise<void> {
  return await withStore("saveTarget", async () => {
    requireSaveOwner("saveTarget", actor, accountId, "write");
    await insertSaves(db, accountId, [target]);
  });
}

/**
 * Removes one target from an account's set.
 *
 * Removing something that is not saved is not an error — the caller asked for a state and
 * that state holds either way. A refusal there would make the un-save the one half of the
 * pair that is not idempotent.
 *
 * Note what this does NOT consult: a target that has gone private or been deleted is still
 * removable, because the row is the owner's own and AC3 keeps it. Filtering an un-save
 * through visibility would strand exactly the bookmarks a reader most wants to clear.
 */
export async function unsaveTarget(
  db: Db,
  actor: Actor,
  accountId: string,
  target: SaveTarget,
): Promise<void> {
  return await withStore("unsaveTarget", async () => {
    requireSaveOwner("unsaveTarget", actor, accountId, "delete");
    await deleteSave(db, accountId, target);
  });
}

/**
 * Folds a browser-local favourite set into an account's saves (AC5).
 *
 * **Idempotent across repeated sign-ins**, and by the same constraint rather than by a
 * comparison this function performs: a second sign-in carrying an overlapping set adds only
 * what the first did not, because every row that already exists conflicts and is skipped.
 * Signing in with the identical set a third time stores nothing new.
 *
 * `targets` arrives ALREADY TRANSLATED into `(kind, refId)`. The browser's own key space is
 * a different thing — compound strings whose grain does not match this column, carrying a
 * card version B-10 forbids here and a bare slug that cannot resolve to a bundle at all —
 * and D-140-04 rules that translation into a route surface that is not published yet. This
 * function is deliberately not the place for it: a translation here would be a second
 * naming of the three kinds inside the module that owns the first.
 */
export async function migrateLocalSaves(
  db: Db,
  actor: Actor,
  accountId: string,
  targets: readonly SaveTarget[],
): Promise<void> {
  return await withStore("migrateLocalSaves", async () => {
    requireSaveOwner("migrateLocalSaves", actor, accountId, "write");
    await insertSaves(db, accountId, targets);
  });
}
