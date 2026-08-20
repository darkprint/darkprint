/* ============================================================
   DarkPrint backend — lib/server/profiles typed refusals
   D-13: no rejection may carry the failed statement or its bound
   parameters. One class, and the count is MEASURED against this
   module rather than copied from a neighbour's shape — the brief
   for this task said so explicitly, and T081's implementer got a
   different answer from T050's by taking that measurement instead
   of reasoning by analogy.

   ── Why there is exactly ONE class ──
   The question is whether this module has DECISIONS: refusals it
   authors itself, which a wrapper must pass through rather than
   seal.

   The measurement and the question it answers, in one sentence,
   because the first version of this paragraph got them apart and
   said something false. `grep -rn "throw "` over
   `lib/server/profiles/` and `app/api/authors/` returns SIX lines,
   and three of them are this file's and `http.ts`'s own prose
   about the rule — so the count answers "does the string appear",
   which is not the question. The three throw STATEMENTS are
   `store.ts`'s seal, `store.ts`'s rethrow of an already-sealed
   fault of this module's own, and `http.ts`'s D-50-18 rethrow of
   what it does not recognise.

   None of the three takes a CALLER'S INPUT as its subject: no
   published function of this module refuses anything a caller can
   send. That is the question — *does any published function reject
   a caller's input?* — and the answer is no.

   `getProfile` publishes `Promise<ProfileRecord | undefined>` and
   answers `undefined` for an unknown handle, for a handle no
   account holds, and for one that is not a legal name at all
   (D-130-02). That is B-03 one layer down: *no such handle* and
   *nothing you may see* are ONE value, so a caller cannot use the
   difference as an existence oracle, and the 404 is the route's to
   produce from the absence.

   So there is no decision to recognise, no arm to pass one
   through, and no `isDecision` predicate. Inventing one would be a
   rule written against T050's instance rather than against this
   module's property.

   `tests/store-modules-seal-their-faults.test.ts` requires this
   file to exist at all: this module imports `@/lib/db`, so
   whatever the driver rejects with has to leave sealed. Its domain
   is `git ls-tree backend`, so it does not see this module until
   the merge — the requirement is real and its enforcement arrives
   one commit later than the code.

   The hygiene clause, as `lib/server/registry/errors.ts` applies
   it: `Object.keys(err)` is empty and `JSON.stringify(err)` is
   exactly `"{}"`; `cause` is present but non-enumerable, which the
   ES2022 Error-cause option installs by spec rather than by anyone
   remembering `Object.defineProperty`; `stack` is retained.
   Whitelist, not blacklist — the only thing any rendering carries
   is the operation.

   ── Why the message constant is not exported ──
   A test importing its expected message from the module under test
   asserts that the module agrees with itself, and passes unchanged
   the day the wording starts interpolating something it should
   not. A suite has to hardcode.
   ============================================================ */

/**
 * A read against Postgres failed while serving a profile.
 *
 * `message` is `` `${operation}: the profile store failed.` `` and nothing else — the form
 * D-81-01 ruled for the registry and the convention shipped four times now
 * (`archive/errors.ts`, T050's accounts, T081's registry). `operation` is the name of the
 * published reader that was running, always a literal this module supplies and never a
 * value a caller sent, which is what makes an exact-match pin writable by a blind author
 * and makes D-13 hold BY CONSTRUCTION: a message equal to a known string cannot contain a
 * statement. A scan for the statement's own tokens would over-match on `bundle` or
 * `release` and red a correct implementation (T-04).
 *
 * The driver error travels on `cause`, which carries the statement, the bound parameters
 * and the SQLSTATE, and which is exactly what non-enumerable hides from every rendering.
 *
 * `cause` is required and typed `unknown`. Passing `undefined` still installs the property,
 * which is what keeps the one- and two-argument shapes rendering identically —
 * `tests/error-hygiene.test.ts` constructs error classes at both arities for that reason.
 */
export class ProfileStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the profile store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field is
   itself an own enumerable property, which `Object.keys(err) === []` does not allow. */
Object.defineProperty(ProfileStoreError.prototype, "name", {
  value: "ProfileStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});
