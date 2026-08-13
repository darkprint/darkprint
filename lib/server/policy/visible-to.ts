/* ============================================================
   DarkPrint backend — the counting rule
   An owner's blueprint and card counts include the private half and
   a visitor's never do (T060 contract, components/profile/load.ts:
   192-200) — this is what a listing/count query filters by so the
   rule is honoured in one place instead of every query reinventing
   it.
   ============================================================ */

import type { Actor } from "./types";

/**
 * `"all"` for the resource owner and the operator, `"public"` for everyone else — the
 * exact split the profile tab strip states in words. Pure: same actor and owner, same
 * answer.
 */
export function visibleTo(actor: Actor, ownerId: string): "all" | "public" {
  if (actor.kind === "operator") return "all";
  if (actor.kind === "account" && actor.accountId === ownerId) return "all";
  return "public";
}
