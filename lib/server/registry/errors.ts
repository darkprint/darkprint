/* ============================================================
   DarkPrint backend — lib/server/registry typed refusals
   D-13: no rejection may carry the failed statement or its bound
   parameters. T080 shipped this module with no error class at
   all, so a driver failure escaped a merged, tagged route as a
   raw `DrizzleQueryError` whose message opens with the full
   `select … from "bundle"`. `params:` was empty only because that
   query is unparameterised; a parameterised one carries the bound
   values, which is D-13's clause verbatim.

   The hygiene clause, as `lib/server/export/errors.ts` and
   `lib/server/cards/errors.ts` apply it: `Object.keys(err)` is
   empty and `JSON.stringify(err)` is exactly `"{}"`; `cause` is
   present but non-enumerable (the ES2022 Error-cause option makes
   it so by spec); `stack` is retained. Whitelist, not blacklist —
   the only thing any rendering carries is the operation.

   ── Why there is exactly ONE class here ──
   The contract asked whether this read model has any DECISIONS —
   refusals this module authors, which T050's `withStore` passes
   through unwrapped — and asked for the answer to be measured
   rather than copied from `isDecision`'s shape.

   Measured against this module at `3497063`, before this file
   existed: `grep -rn "throw " lib/server/registry/` over every
   non-test file returns ZERO lines, and the module's only `catch`
   is `snapshot.ts`'s `canonicalJson` fallback, which swallows and
   returns a value rather than rejecting. Every absent, invisible
   or empty answer in the published surface is a VALUE — `blueprint`,
   `card` and `scoresOf` answer `undefined`, the facets answer a
   frozen `[]` — because B-03 returns 404 over 403 and a caller
   able to tell "no such row" from "not yours" has the leak back.

   The question that measurement answers is "does any published
   reader raise a refusal of this module's own?", and the answer is
   no: **every fault a published reader can raise comes from
   something it calls, and nothing it calls is this module.** So
   there is no decision to recognise, no arm to pass one through,
   and no `isDecision` predicate — inventing one would be a rule
   written against another task's instance rather than against this
   module's property.

   That claim is not left as prose. `fault-path.test.ts` asserts
   that `RegistryStoreError` is the ONLY error class the barrel
   publishes, derived from the barrel by construction, so the day
   somebody adds a decision the guard reds and whoever adds it has
   to decide what `withRegistryStore` should do with it.

   ── The message form, and why it is this one ──
   **D-81-01, ruled:** `` `${operation}: the registry store failed.` ``,
   exactly. The contract's own block said *the operation alone* in
   one paragraph and *mirrors `withAccountErrors`* in the next —
   two different strings, each satisfying one sentence and
   violating the other — and the blind author refused to choose
   rather than guess. The ruled form is the convention already
   shipped twice: `archive/errors.ts:74` is
   `` `${operation}: the write failed.` `` and T050's is
   `` `${operation}: the account store failed.` ``.

   The operation is the only variable part and it is always a
   literal this module supplies. An exact-match pin is therefore
   writable by a blind author, and it makes D-13 hold BY
   CONSTRUCTION rather than by a substring scan — a message equal
   to a known string cannot contain a statement, and a scan for the
   statement's own tokens would over-match on `card_version` and
   red a correct implementation (T-04).

   ── Why this constant is not re-exported from the barrel ──
   A test that imports its expected message from the module under
   test asserts that the module agrees with itself, and passes
   unchanged the day the message starts interpolating something it
   should not. A suite has to hardcode.
   ============================================================ */

/**
 * A read against Postgres failed.
 *
 * `message` is `` `${operation}: the registry store failed.` `` (D-81-01) and nothing else.
 * `operation` is the name of the published reader that was running, always a literal this
 * module supplies and never a value a caller sent. No statement, no bound parameter, no
 * SQLSTATE, no constraint name. The driver error travels on `cause`, which carries all of
 * it and is exactly what non-enumerable hides.
 *
 * `cause` is typed `unknown` and required, matching the published block. It is passed
 * through the ES2022 option so the property is installed non-enumerably by the language
 * rather than by anyone remembering `Object.defineProperty`; passing `undefined` still
 * installs it, which is what keeps the two-argument and one-argument shapes rendering
 * identically (`tests/error-hygiene.test.ts` constructs at both arities for that reason).
 */
export class RegistryStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the registry store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow. */
Object.defineProperty(RegistryStoreError.prototype, "name", {
  value: "RegistryStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});
