/* ============================================================
   DarkPrint backend — saves: who may
   One check, and it DELEGATES rather than compares.

   `can` rather than `actor.accountId === accountId`: T060 owns the
   decision, it grants a genuine operator the same access, and
   reimplementing "is this the owner" here would be a second answer
   free to disagree with the first. T050's `requireAccountOwner`
   gives the same reasoning for the same choice.

   **T140's blind author measured what separates the two**, and it
   is worth recording because it is not what a reader guesses. Of
   seven non-owner actor shapes, exactly ONE reds under an
   ownership check re-implemented as an id comparison: an actor
   that INHERITS the owner's id from a prototype rather than
   carrying it as its own property. `can` reads every field through
   `Object.hasOwn` (T060's never-inherit ruling), so a polluted or
   `Object.create`-built actor reads as absent; a bare `===`
   compares whatever the prototype supplies and grants.

   So the discriminator between delegating and re-implementing is
   only demonstrable with an actor whose identity is REAL BUT NOT
   ITS OWN — which is precisely the shape nobody writes a fixture
   for by accident.

   ── `NotAccountOwnerError`, consumed and not minted ──
   D-140-02. The class is `@/lib/server/accounts`', sealed and
   published, and it is exactly this decision. A locally minted
   class of the same name passes every check that compares NAMES
   and fails the one that compares identity — the blind suite's
   mutation reds 21 cells across all three writers by `instanceof`
   against the imported class.

   The message is T050's published form, written out as a literal
   because `notAccountOwnerError` is a factory that barrel does not
   export — only the class is. **That is a second copy of a
   published constant and it is the shape D-50-03 charges**, so it
   is flagged here rather than left to look deliberate: if the
   factory is ever exported, this literal is the thing to delete.
   ============================================================ */

import { NotAccountOwnerError } from "@/lib/server/accounts";
import { can, type Action, type Actor } from "@/lib/server/policy";

/**
 * Whether `actor` may read `accountId`'s save set at all.
 *
 * A predicate rather than a throw, because the readers answer a VALUE for a denial
 * (D-140-01) — B-03's 404-over-403 rule one layer down, where "not yours" and "no such
 * account" have to be one answer.
 */
export function maySeeSaves(actor: Actor, accountId: string): boolean {
  return can(actor, "read", { kind: "save", ownerId: accountId });
}

/**
 * Throws unless `actor` may perform `action` on `accountId`'s save set.
 *
 * Called INSIDE `withStore` by every writer, not before it. That placement is deliberate:
 * it puts the decision through the wrapper's pass-through arm on the path a caller takes,
 * so the arm has a witness instead of being a branch nothing reaches. `withStore` opens no
 * connection of its own, so authorization still runs before any statement.
 */
export function requireSaveOwner(
  operation: string,
  actor: Actor,
  accountId: string,
  action: Action,
): void {
  if (!can(actor, action, { kind: "save", ownerId: accountId })) {
    throw new NotAccountOwnerError(`${operation}: not this account's owner.`);
  }
}
