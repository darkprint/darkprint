/* ============================================================
   DarkPrint backend — lib/server/notes typed refusals
   D-13: no rejection may carry the failed statement or its bound
   parameters. That is not optional-by-construction here: every
   `note` and `note_vote` statement binds `account_id`, a
   `target_id` and a note id, so a `DrizzleQueryError` raised by
   one renders the caller's own values in its message — the same
   measurement T140's blind author made against a live driver on
   `save`, on tables bound the same way.

   ── TWO classes here, and one consumed from elsewhere ──
   D-140-02 ruled T140's single decision belonged to another module
   because `NotAccountOwnerError` was *precisely* that decision.
   **D-WAVE-04 rules the same for AC3 and AC7**, and this file
   originally minted a `NoteDeniedError` for them — the synonym the
   precedent forbids. It is gone; `guards.ts` consumes the accounts
   class and says why.

   What remains is what this module genuinely authors:

   * **`NoteStoreError`** — the fault boundary every module has.
   * **`NoteBodyError`** — AC5, which requires the limit be STATED.
     A refusal a caller cannot act on fails the criterion, so the
     number travels in the message rather than in a caller's memory
     of the documentation. D-WAVE-04 pins the spelling, and pins it
     against `InvalidNoteError`, which a dispatch had named and the
     document never did.

   Neither is re-exported from anywhere and neither re-exports:
   `tests/error-hygiene.test.ts` counts every error class exported
   from every barrel, so a re-export would be counted twice and the
   equality would move by two for one new class.

   ── The message form, and the one place it admits a number ──
   The convention has shipped four times — `archive/errors.ts` is
   `` `${operation}: the write failed.` ``, T050's is
   `` `${operation}: the account store failed.` ``, T081's is
   `` `${operation}: the registry store failed.` ``, T140's is
   `` `${operation}: the saves store failed.` ``. This module's is
   `` `${operation}: the notes store failed.` ``.

   D-140-06 admits the operation and the caller's own FIELD NAME
   and never the caller's own VALUE. `NoteBodyError` renders a
   number, and it is **this module's constant rather than the
   caller's input**: the limit, and the count of what arrived, are
   two integers the module already published and computed. Neither
   is a body, an account id or a `refId`, so nothing a caller sent
   is echoed — which matters because a `refId` echoed to a
   non-author is the existence oracle AC1 exists to close.

   No message literal is exported. A test importing its expected
   message from the module under test asserts that the module
   agrees with itself, and goes on passing the day the wording
   starts interpolating something it should not.
   ============================================================ */

/**
 * A `note` or `note_vote` read or write against Postgres failed.
 *
 * `message` is `` `${operation}: the notes store failed.` `` and nothing else. The driver
 * error travels on `cause`, which carries the statement, the bound ids and the SQLSTATE —
 * all of it, and all of it non-enumerable.
 *
 * `cause` is passed through the ES2022 option so the property is installed non-enumerably
 * by the language rather than by anyone remembering `Object.defineProperty`. Passing
 * `undefined` still installs it, which is what keeps the one- and two-argument shapes
 * rendering identically — `tests/error-hygiene.test.ts` constructs at both arities for
 * exactly that reason.
 */
export class NoteStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the notes store failed.`, { cause });
  }
}

/**
 * AC5: a body over the limit or empty, refused **with the limit stated**.
 *
 * The criterion is the statement, not the refusal — a caller told only "invalid" cannot
 * write the shorter body that would succeed. So the message renders the limit and what
 * arrived, both of them this module's own integers.
 *
 * `limit` and `bodyLength` are also readable as properties, non-enumerably installed for
 * the reason the whole family is: `tests/error-hygiene.test.ts` requires `Object.keys(err)`
 * be empty and `JSON.stringify(err)` be `{}`, and an own enumerable field would fail both.
 * A route rendering a problem detail reads them; nothing serialises them by accident.
 *
 * `bodyLength` rather than `length`: `length` on an `Error` instance reads like the
 * function arity every reader already associates with the name, and a property whose name
 * argues with itself is one a caller has to check the source to trust.
 *
 * **Constructible at one and two arguments**, which is not incidental —
 * `tests/error-hygiene.test.ts` probes every published class at exactly those two arities
 * and treats an unconstructible one as unmeasured rather than as skipped. Both extra
 * parameters therefore default rather than being required, and the defaults are `-1` and
 * not `0`: a probe must not render as the empty-body sentence, which is a real refusal a
 * reader could mistake for one this module issued.
 */
export class NoteBodyError extends Error {
  declare readonly limit: number;
  declare readonly bodyLength: number;

  constructor(operation: string, limit = -1, bodyLength = -1) {
    super(
      bodyLength === 0
        ? `${operation}: a note body cannot be empty; the limit is ${limit} characters.`
        : `${operation}: a note body cannot exceed ${limit} characters; this one is ${bodyLength}.`,
    );
    Object.defineProperty(this, "limit", { value: limit, enumerable: false, writable: false, configurable: true });
    Object.defineProperty(this, "bodyLength", { value: bodyLength, enumerable: false, writable: false, configurable: true });
  }
}

/* On the prototype, not as instance fields: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow. */
for (const [ctor, name] of [
  [NoteStoreError, "NoteStoreError"],
  [NoteBodyError, "NoteBodyError"],
] as const) {
  Object.defineProperty(ctor.prototype, "name", {
    value: name,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}
