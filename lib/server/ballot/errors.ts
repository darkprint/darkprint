/* ============================================================
   DarkPrint backend — ballot: typed refusals and the fault path
   D-13: no rejection this module produces carries a statement, a
   bound parameter, or anything a caller did not itself submit.

   ── Two classes, on `lib/server/lineage`'s shape ──
   One refusal class carrying a closed `kind`, and one store class.
   `castBallot` refuses three ways and a caller has to map them to
   three different statuses, so the reason has to survive the
   throw — but three separate classes would be three names for one
   decision this module authors, which is the shape T140's ruling
   charges. `ForkRefusedError` already folds four refusals into
   one class with a `kind` a caller branches on, and this is that
   pattern rather than a new one.

   ── Why `NotAccountOwnerError` is not consumed for the anonymous
   case ──
   T140 consumes it because its refusal *is* an ownership decision.
   This one is not: a ballot is cast on somebody else's blueprint
   by design, so a voter is never the owner and "not this account's
   owner" would be a true sentence about the wrong question.
   `NotPermittedError` from `@/lib/server/observability` cannot be
   consumed either — its constructor takes no arguments and hard-
   codes `"listAudit: not permitted."`.

   ── `declare` plus `defineProperty`, and `name` on the prototype ──
   The hygiene clause is that `Object.keys(err)` is `[]` and
   `JSON.stringify(err)` is exactly `"{}"`, and a constructor
   assignment makes its property enumerable. Written from
   `ArchiveConflictError`'s correction rather than its original.
   ============================================================ */

/**
 * Which refusal, so a caller maps three cases without reading a sentence. A closed union
 * rather than a free string (D-14): a caller branches on it.
 *
 * **`no-such-bundle` covers a bundle that is not there AND one the caller may not read**,
 * and that is B-03's 404-over-403 rule rather than a shortcut. A distinct refusal for "you
 * may not vote on that" would confirm which private blueprints exist to anybody who tried.
 * It is also what keeps the foreign key off the fault path: `ballot.bundle_id` references
 * `bundle.id`, so an unrefused insert against an unknown id answers `23503` and would reach
 * a caller as a store fault, which says the database failed when the caller mistyped an id.
 *
 * **`out-of-range` is refused here rather than left to `ballot_metric_range`.** The check
 * constraint is real and stays, but a `23514` raised by it is sealed by `BallotStoreError`
 * on the way out — so a caller who sent `101` and a caller whose database is down would
 * receive the identical answer. One is the caller's mistake and one is ours.
 *
 * **`not-signed-in` is AC6.** A ballot is a row on an account, and an anonymous caller has
 * none to write it on. Note this is the WRITE half only: `getAggregate` answers an anonymous
 * caller, because AC6 refuses an anonymous ballot and not an anonymous read.
 */
export type BallotRefusedKind = "not-signed-in" | "no-such-bundle" | "out-of-range";

export class BallotRefusedError extends Error {
  declare readonly kind: BallotRefusedKind;

  constructor(kind: BallotRefusedKind, message: string) {
    super(message);
    Object.defineProperty(this, "kind", { value: kind, enumerable: false, writable: false });
  }
}

BallotRefusedError.prototype.name = "BallotRefusedError";

/** AC6. The bare sentence — there is nothing about an anonymous caller to name. */
export function notSignedIn(): BallotRefusedError {
  return new BallotRefusedError("not-signed-in", "castBallot: not signed in.");
}

/**
 * B-03's one answer for two states. The `bundleId` is deliberately not quoted back: it would
 * be harmless in itself, but it is what makes a tried id distinguishable from an untried
 * one, which is the existence oracle the single refusal exists to close.
 */
export function noSuchBundle(): BallotRefusedError {
  return new BallotRefusedError("no-such-bundle", "castBallot: no such bundle.");
}

/**
 * B-11's 0-100, refused at the door.
 *
 * **The metric NAME is interpolated and the caller's VALUE is not.** D-140-06's line, and it
 * applies unchanged: a field name tells the caller which of the three it got wrong, where
 * echoing `101` back adds nothing the caller does not already hold. `metric` is one of three
 * literals this module supplies, never a string a caller chose.
 */
export function outOfRange(metric: string): BallotRefusedError {
  return new BallotRefusedError("out-of-range", `castBallot: \`${metric}\` is not a score from 0 to 100.`);
}

/* --------------------- the fault path --------------------- */

/**
 * A `ballot` read or write against Postgres failed.
 *
 * `message` is `` `${operation}: the ballot store failed.` `` and nothing else — the eighth
 * instance of the form `archive`, `accounts`, `registry`, `saves` and `lineage` already
 * ship (D-81-01, D-140-02). **This module is not optional-by-construction**: every statement
 * below binds `account_id` and `bundle_id`, so a `DrizzleQueryError` raised by one carries
 * both ids and the SQLSTATE in its own message, and this class is what stands between those
 * values and a caller.
 *
 * `operation` is always the published function that was running, a literal this module
 * supplies at the call site. The driver error travels on `cause`, required and passed
 * through the ES2022 option so the property is installed non-enumerably by the language
 * rather than by anyone remembering `Object.defineProperty`. Passing `undefined` still
 * installs it, which is what keeps the one- and two-argument shapes rendering identically —
 * `tests/error-hygiene.test.ts` constructs at both arities for exactly that reason.
 */
export class BallotStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the ballot store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow. */
Object.defineProperty(BallotStoreError.prototype, "name", {
  value: "BallotStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});
