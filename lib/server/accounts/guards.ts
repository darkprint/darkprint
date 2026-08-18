/* ============================================================
   DarkPrint backend — accounts: who may, and who is finished
   signing up
   Two checks every writer makes, in this order, and the order is
   the point.

   **Authorization first.** A caller who is not this account's
   owner learns nothing else — not whether the account exists, not
   whether a field would have validated. Field validation runs
   after, so a stranger never receives feedback about a value they
   were never going to be allowed to set.

   **Then handle-required, and it is a fact about the ACTOR.**
   AC1 rules a session with `handle: null` signed in and
   incomplete, so an account that has not finished signing up may
   not write its own fields yet. `PATCH /api/account/handle` is
   the single exception (D-50-05): it is the route that allocates
   the first handle, so requiring one to reach it would make AC1
   unreachable. That exception lives in `changeHandle` not calling
   this, rather than in a flag this function takes — a caller that
   can switch a guard off is a guard with a switch.

   Enforced in the module rather than at each of the four routes,
   which is the same argument `withSession` makes one layer up: a
   rule applied at four call sites is a rule with a call site that
   forgot it, and this one has a criterion behind it.
   ============================================================ */

import { can, type Actor } from "@/lib/server/policy";
import { handleRequiredError, notAccountOwnerError } from "./errors";

/**
 * Throws unless `actor` may write `accountId`'s own row.
 *
 * `can` rather than an id comparison: T060 owns the decision, it grants an operator
 * the same write, and reimplementing "is this the owner" here would be a second
 * answer that can disagree with the first. No route can mint an operator today —
 * `SessionPayload` is `{ accountId, handle }` with no `kind`, so every route-built
 * actor is `{ kind: "account", ... }` — which is why that grant is unreachable rather
 * than untested (D-50-13).
 */
export function requireAccountOwner(operation: string, actor: Actor, accountId: string): void {
  if (!can(actor, "write", { kind: "account", accountId })) {
    throw notAccountOwnerError(operation);
  }
}

/**
 * Throws when the actor's own sign-up is unfinished.
 *
 * Scoped to `kind === "account"` deliberately. An operator's `Actor` carries no
 * `handle` field at all, and it is not signing up — reading a missing field as "has
 * no handle yet" would refuse the one actor the rule was never about. Unreachable
 * today for the reason above, and correct on the day a route can build one.
 */
export function requireHandle(operation: string, actor: Actor): void {
  if (actor.kind === "account" && actor.handle === null) {
    throw handleRequiredError(operation);
  }
}
