/* ============================================================
   DarkPrint backend — the counting rule
   An owner's blueprint and card counts include the private half and
   a visitor's never do (T060 contract, components/profile/load.ts:
   192-200) — this is what a listing/count query filters by so the
   rule is honoured in one place instead of every query reinventing
   it.
   ============================================================ */

import type { Actor } from "./types";
import { isOperator, isOwner } from "./is-owner";

/**
 * `"all"` for the resource owner and a genuine operator, `"public"` for everyone else — the
 * exact split the profile tab strip states in words. Pure: same actor and owner, same
 * answer. Never throws: a malformed `actor` (not an object, `null`) answers `"public"`, the
 * least-privileged of the two values, rather than raising (2026-08-14 ruling). `isOwner` and
 * `isOperator` both apply the empty-string and discriminant-vs-identity rulings, so a
 * half-built session row (an operator tag or an account id that is `""`) never widens past
 * what an anonymous caller sees.
 */
export function visibleTo(actor: Actor, ownerId: string): "all" | "public" {
  if (typeof actor !== "object" || actor === null) return "public";
  if (isOperator(actor)) return "all";
  if (isOwner(actor, ownerId)) return "all";
  return "public";
}
