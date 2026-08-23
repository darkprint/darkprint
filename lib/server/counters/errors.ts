/* ============================================================
   DarkPrint backend — lib/server/counters typed refusals
   D-13: no rejection may carry the failed statement or its bound
   parameters, and on this module that is not optional-by-
   construction. Every statement below binds `kind` and `ref_id`,
   and the toggle binds an `account_id` as well — so a
   `DrizzleQueryError` raised by any of them renders the caller's
   `refId` and the acting account into its own message. The class
   below is what stands between those values and a caller.

   ── TWO classes, and why the second is minted rather than
      consumed ──
   The store class is the sealed-fault half and needs no argument;
   the convention has shipped four times.

   The other is AC3's refusal, and it is minted here after looking
   for one to consume. `NotAccountOwnerError`
   (`@/lib/server/accounts`) is an OWNERSHIP answer — "this is not
   your row" — and AC3 is not that: a star has no owner and the
   thing being refused is acting at all without a session.
   Rendering "not this account's owner" for an anonymous reader
   would be a sentence that is not true of what happened.
   `NotPermittedError` (`@/lib/server/observability`) is closer in
   meaning and unusable in fact: it takes no argument and hardcodes
   `listAudit:` into its message, which is the shape that makes it
   that module's own and not a general one.

   ── Why a REFUSAL exists at all, when the readers answer values ──
   D-140-02's argument, one module over. `toggleStar` returns a
   `SignalState`, and that shape has no room for *denied* — an
   anonymous caller handed back `starredByCaller: false` reads it
   as *your star did not stick*, which is indistinguishable from
   *you just unstarred*. A write that silently does nothing tells
   its caller the write succeeded, and that is a different thing
   from a read declining to distinguish. `getSignals` needs no
   refusal for the same reason in reverse: every count it answers
   is public (B-10), so there is nothing an anonymous reader may
   not see.

   ── The message form, which is RULED and not derived ──
   **D-WAVE-12: `` `${operation}: the counter store failed.` `` —
   SINGULAR.** It shipped here in the plural, because this module
   was built before D-WAVE-07 existed: that ruling published the
   form at a blind author's charge and landed after this branch's
   point, so the shipped convention was the only text there was.

   **And the convention does not settle it**, which is why it took
   a ruling rather than a correction. `accounts/errors.ts` ships
   `` `${operation}: the account store failed.` `` — a SINGULAR
   noun from a plural module name — while `limits/errors.ts` ships
   `` `${operation}: the limits store failed.` ``, plural. Two
   shipped modules, opposite rules, and reading either one as the
   house habit is reading half the evidence. The rest give no help:
   `archive`'s is `` `${operation}: the write failed.` ``, T081's
   is `registry`, T140's is `saves`.

   The document's form wins because it was published so that two
   halves which cannot speak to each other would agree without
   contact. A ruling made for that purpose losing to a convention
   that contradicts itself would mean the charge bought nothing.

   `operation` is the published function that was running, always a
   literal this module supplies at the call site. **Never a
   `refId`, never an `accountId`, never a kind** — D-140-06 admits
   the operation and a caller's own FIELD NAME and never a caller's
   own VALUE. A `refId` echoed back is an existence oracle for a
   private bundle, which is what B-07 and B-03 close everywhere
   else in the tree.

   Neither constant is exported. A test importing its expected
   message from the module under test asserts that the module
   agrees with itself, and goes on passing the day the wording
   starts interpolating something it should not.
   ============================================================ */

/**
 * A `target` or `target_actor` read or write against Postgres failed.
 *
 * `message` is `` `${operation}: the counter store failed.` `` and nothing else. The
 * driver error travels on `cause`, which carries the statement, the bound `kind`, the
 * bound `ref_id`, the bound `account_id` and the SQLSTATE — all of it, and all of it
 * non-enumerable.
 *
 * `cause` is required and passed through the ES2022 option, so the property is installed
 * non-enumerably by the language rather than by anyone remembering
 * `Object.defineProperty`. Passing `undefined` still installs it, which is what keeps the
 * one- and two-argument shapes rendering identically — `tests/error-hygiene.test.ts`
 * constructs at both arities for exactly that reason.
 */
export class CounterStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the counter store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow
   (`tests/error-hygiene.test.ts`, D-13's hygiene clause). */
Object.defineProperty(CounterStoreError.prototype, "name", {
  value: "CounterStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/**
 * AC3: `toggleStar` was called by a caller with no account behind it, and moved nothing.
 *
 * **The rendering names the operation and nothing else** — no `kind`, no `refId`, no
 * claimed account id. A refusal that echoed the target would tell an anonymous caller that
 * a private bundle exists, which is the oracle B-03's 404-not-403 rule closes one layer up.
 * The constructor takes one argument for that reason: a parameter that exists is a
 * parameter somebody interpolates later, so the clause is structural rather than a rule a
 * future editor has to know.
 */
export class NotSignedInError extends Error {
  constructor(operation: string) {
    super(`${operation}: not signed in.`);
  }
}

Object.defineProperty(NotSignedInError.prototype, "name", {
  value: "NotSignedInError",
  enumerable: false,
  writable: true,
  configurable: true,
});
