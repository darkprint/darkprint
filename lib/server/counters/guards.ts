/* ============================================================
   DarkPrint backend — counters: who is acting
   One check, and it DELEGATES rather than compares.

   ── The composition is T230's, not a new one ──
   `lib/server/limits/keys.ts:204` (`revokeKey`) asks exactly this
   question — *is this caller acting as an account it actually
   is* — and answers it by reading the claimed id off the actor
   and putting it through `can(actor, "write", { kind: "account",
   accountId })`. That is followed here rather than reinvented.

   ── Why not `actor.kind !== "anonymous"` on its own ──
   T140's `guards.ts` records what separates delegating from
   re-implementing, and it is not what a reader guesses. Of seven
   non-owner actor shapes, exactly ONE reds under an identity check
   written by hand: an actor that INHERITS `accountId` from a
   prototype rather than carrying it as its own property. `can`
   reads every field through `Object.hasOwn` (T060's never-inherit
   ruling), so a polluted or `Object.create`-built actor reads as
   absent; a bare discriminant test reads whatever the prototype
   supplies and grants.

   **That is also what makes the returned id safe to write into
   `target_actor.account_id`.** The grant is the proof, not the
   read: `can` reaches a grant only through `isOwner` (which
   requires `Object.hasOwn(actor, "accountId")` and an exact match
   against the id passed in) or through `isOperatorGrant` (which
   requires the same `hasOwn` and a non-empty id). So an inherited
   id never survives to the insert — it fails the check that was
   handed the very value it would have written.

   ── The resource kind, and the stretch, stated rather than hidden
      ──
   `Resource` has five members and none of them is a star or a
   target (`lib/server/policy/types.ts`), and `lib/server/policy`
   is not this task's to extend. So the question is asked about the
   actor's OWN account row, which is the same question `revokeKey`
   asks and the same one it means: authority over an account is
   what a star is written under. **It is deliberately not a
   visibility check** — B-10 makes a star public and the counters
   with it, and `recordDownload` takes no actor at all by AC6's
   ruling, so nothing in this module discriminates on who may see
   the thing being counted.
   ============================================================ */

import { can, type Actor } from "@/lib/server/policy";
import { NotSignedInError } from "./errors";

/**
 * The account `actor` is acting as, or AC3's refusal.
 *
 * Called INSIDE `withStore` by the toggle, not before it. That placement is T140's and
 * deliberate: it puts the decision through the wrapper's pass-through arm on the path a
 * caller actually takes, so the arm has a witness instead of being a branch nothing
 * reaches. `withStore` opens no connection of its own, so the refusal still happens before
 * any statement is built.
 */
export function actingAccountId(operation: string, actor: Actor): string {
  const claimed = actor.kind === "anonymous" ? null : actor.accountId;
  if (claimed === null || !can(actor, "write", { kind: "account", accountId: claimed })) {
    throw new NotSignedInError(operation);
  }
  return claimed;
}

/**
 * The account `actor` is acting as, or `null` — the same question with no refusal in it.
 *
 * `getSignals` answers every caller, so an anonymous reader is not an error here: it is a
 * reader whose `starredByCaller` is `false`. Answering `null` rather than throwing is what
 * makes AC4's *`false` rather than absent* true by construction on the read path.
 */
export function actingAccountIdOrNull(actor: Actor): string | null {
  const claimed = actor.kind === "anonymous" ? null : actor.accountId;
  if (claimed === null || !can(actor, "write", { kind: "account", accountId: claimed })) {
    return null;
  }
  return claimed;
}
