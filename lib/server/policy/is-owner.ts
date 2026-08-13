/* ============================================================
   DarkPrint backend — the ownership and operator checks shared by
   can() and visibleTo()
   Two 2026-08-14 rulings, both about what counts as an identity:
   an empty-string id never matches an empty-string id ("" is what an
   unset column and a half-built session row both look like), and
   possession of the `operator` discriminant is not authority — an
   operator must carry a non-empty `accountId` to be one. Centralised
   here so both callers apply the same rule the same way.
   ============================================================ */

import type { Actor } from "./types";

export function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isOwner(actor: Actor, ownerId: unknown): boolean {
  return actor.kind === "account" && isId(actor.accountId) && isId(ownerId) && actor.accountId === ownerId;
}

export function isOperator(actor: Actor): boolean {
  return actor.kind === "operator" && isId(actor.accountId);
}
