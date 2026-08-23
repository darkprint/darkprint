/* ============================================================
   DarkPrint backend — ballot: who may, and what is a score
   Two checks, and the first DELEGATES rather than compares.
   ============================================================ */

import { can, type Actor } from "@/lib/server/policy";
import { notSignedIn, outOfRange } from "./errors";
import { METRICS, type Ballot } from "./types";

/**
 * The account a ballot would be written on, or `undefined` if the caller has none.
 *
 * **The extraction below is deliberately naive, because `can` is the gate and not the
 * `typeof`.** T060 owns three rulings about what counts as an identity — an empty-string id
 * never matches, possession of the `operator` discriminant is not authority, and authority
 * is never inherited (`lib/server/policy/is-owner.ts`) — and re-deciding any of them here
 * would be a second answer free to disagree with the first, which is the defect this run has
 * charged more than any other.
 *
 * So the value is read off the actor without ceremony and then submitted to `can` as the
 * account it claims to be. An actor carrying the id on its PROTOTYPE rather than as its own
 * property reads a string here and is refused there, because `isOwner` and `isOperator` both
 * fetch `accountId` through `Object.hasOwn` and see it absent. That is the one shape that
 * separates delegating from re-implementing (T140's blind author measured it: of seven
 * non-owner actor shapes, exactly one reds under an id comparison), and it is the shape this
 * function would get wrong if the `typeof` were the check.
 *
 * **`{ kind: "account" }` as the resource, not a ballot resource.** `Resource` has no
 * `ballot` member and `lib/server/policy/**` is not this task's to extend. What is being
 * asked is "is this actor genuinely this account", and an account's own row is exactly the
 * resource T060 answers that about: `canOnAccount` grants `write` to the account itself and
 * to a well-formed operator, and to nobody else.
 *
 * An operator is admitted, and that is not an oversight. `Actor`'s two non-anonymous members
 * both carry an `accountId`, AC6 refuses an anonymous ballot rather than a non-owner one, and
 * a break-glass operator that could not vote would be an account that lost a capability by
 * being trusted with more.
 */
export function voterIdOf(actor: Actor): string | undefined {
  if (typeof actor !== "object" || actor === null) return undefined;
  const claimed = (actor as { accountId?: unknown }).accountId;
  if (typeof claimed !== "string") return undefined;
  if (!can(actor, "write", { kind: "account", accountId: claimed })) return undefined;
  return claimed;
}

/** AC6, as a throw. `castBallot` returns an `Aggregate`, and no `Aggregate` can mean *refused*. */
export function requireVoter(actor: Actor): string {
  const accountId = voterIdOf(actor);
  if (accountId === undefined) throw notSignedIn();
  return accountId;
}

/**
 * B-11's 0-100, checked on every member the caller actually sent.
 *
 * **Integers only, and that is about the column rather than about the contract.**
 * `ballot.efficacy` and its two siblings are `smallint` (`lib/db/schema.ts:403-405`), and
 * Postgres does not refuse `87.5` for one — it ROUNDS it. A fractional vote would be stored
 * as a different number than the caller cast, silently, and `ballot_metric_range` would
 * never see anything wrong. So the refusal has to be here; the check constraint cannot hold
 * this half.
 *
 * `Number.isInteger` also disposes of `NaN` and both infinities, each of which is a `number`
 * to the type system and none of which is a score.
 *
 * Absent members are not checked, because absent means *no opinion* rather than *zero* —
 * `Partial<Ballot>` is the whole reason a caller may vote on one metric and leave the others
 * alone (`lib/db/schema.ts:388-392`).
 */
export function requireScores(ballot: Partial<Ballot>): void {
  for (const metric of METRICS) {
    const value = ballot[metric];
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 0 || value > 100) throw outOfRange(metric);
  }
}
