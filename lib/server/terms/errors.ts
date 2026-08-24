/* ============================================================
   DarkPrint backend — lib/server/terms typed refusals
   D-13: no rejection may carry the failed statement or its bound
   parameters. One class, for the reason `lib/server/registry`
   measured rather than assumed: this module authors no refusal of
   its own.

   Measured against this module rather than copied from another's
   shape. Every published answer here is a VALUE — `usageOf`
   returns zeros for a term nothing names (AC4), `candidates`
   returns a list that can be empty — so there is no decision for
   a wrapper to pass through and no `isDecision` predicate to
   write. The only fault a published reader can raise comes from
   something it calls, and the only thing it calls that can fail
   is the registry read underneath it.

   The hygiene clause as the merged modules apply it:
   `Object.keys(err)` is empty, `JSON.stringify(err)` is exactly
   `"{}"`, `cause` is present but non-enumerable (the ES2022
   Error-cause option installs it that way by spec), `stack` is
   retained. Whitelist, not blacklist — the only thing any
   rendering carries is the operation.

   The message form is the convention already shipped three times
   — `archive/errors.ts`'s `` `${operation}: the write failed.` ``,
   T050's `` `${operation}: the account store failed.` `` and
   D-81-01's `` `${operation}: the registry store failed.` ``.
   `operation` is always a literal this module supplies, never a
   caller's `termId`, so an exact-match pin is writable by a blind
   author and D-13 holds BY CONSTRUCTION: a message equal to a
   known string cannot contain a statement.

   The constant is deliberately not re-exported from the barrel. A
   test importing its expected message from the module under test
   asserts that the module agrees with itself, and passes unchanged
   the day the message starts interpolating something it should not.
   ============================================================ */

/**
 * A read behind the term-usage index failed.
 *
 * `message` is `` `${operation}: the term store failed.` `` and nothing else. The
 * underlying fault travels on `cause`, which carries the statement, the bound parameters
 * and the stack, and which is exactly what non-enumerable hides from a rendering.
 *
 * `cause` is required and typed `unknown`. It is passed through the ES2022 option rather
 * than assigned, so the property is installed non-enumerably by the language instead of by
 * anyone remembering `Object.defineProperty`; passing `undefined` still installs it, which
 * keeps the one- and two-argument shapes rendering identically.
 */
export class TermStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the term store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field is
   itself an own enumerable property, which `Object.keys(err) === []` does not allow. */
Object.defineProperty(TermStoreError.prototype, "name", {
  value: "TermStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});
