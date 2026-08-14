/* ============================================================
   DarkPrint backend — the ownership and operator checks shared by
   can() and visibleTo()
   Three 2026-08-14 rulings, all about what counts as an identity:
   an empty-string id never matches an empty-string id ("" is what an
   unset column and a half-built session row both look like);
   possession of the `operator` discriminant is not authority — an
   operator must carry a non-empty `accountId` to be one; and
   authority is never inherited — `kind` and `accountId` are read
   with `Object.hasOwn` so a prototype-polluted or `Object.create`-d
   actor cannot borrow either field from something it does not own.
   Centralised here so both callers apply every rule the same way.
   ============================================================ */

import type { Actor } from "./types";

export function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isOwner(actor: Actor, ownerId: unknown): boolean {
  return (
    Object.hasOwn(actor, "kind") &&
    actor.kind === "account" &&
    Object.hasOwn(actor, "accountId") &&
    isId(actor.accountId) &&
    isId(ownerId) &&
    actor.accountId === ownerId
  );
}

export function isOperator(actor: Actor): boolean {
  return (
    Object.hasOwn(actor, "kind") &&
    actor.kind === "operator" &&
    Object.hasOwn(actor, "accountId") &&
    isId(actor.accountId)
  );
}
