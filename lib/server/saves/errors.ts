/* ============================================================
   DarkPrint backend — lib/server/saves typed refusals
   D-13: no rejection may carry the failed statement or its bound
   parameters. **On this module that is not optional-by-
   construction the way T081's was** (D-140-02): every `save` write
   binds `account_id`, `target_kind` and `target_id`, so a
   `DrizzleQueryError` raised by one carries the account's id and
   the caller's `refId` in its own message. Measured by T140's
   blind author against a live driver rather than assumed — a
   dropped table answers `42P01` naming `relation "save"`, and
   drizzle renders the bound `accountId` and `refId`. So the class
   below is what stands between those values and a caller.

   ── ONE class here, and one consumed from elsewhere ──
   D-140-02 measured this module rather than copying T081's answer,
   and the answers differ. T081 converts every rejection because
   its readers author no refusal at all: every absent or invisible
   answer there is a VALUE. Here the readers do the same — a denied
   `listSaves` answers a frozen `[]` and a denied `countSaves`
   answers `0` (D-140-01) — but **the three writers return
   `Promise<void>`, and `void` cannot express *denied***. A write
   that silently does nothing tells its caller the save succeeded,
   which is a write failing silently rather than a read declining
   to distinguish.

   So this module has exactly one decision, on the write half, and
   D-140-02 rules that it is **not a class of ours**:
   `NotAccountOwnerError` is `@/lib/server/accounts`', sealed,
   published, and is precisely this decision. Minting a second
   class of the same name would pass every check that compares
   names and fail the one that compares identity — T140's blind
   author measured that, and its mutation reds 21 cells across all
   three writers by `instanceof` against the imported class.

   ── Why it is not re-exported from our barrel ──
   The accounts barrel gives the rule in its own header, for
   `HandleTakenError` and `InvalidNameError`: re-exporting another
   module's rejection publishes it under this module's name and
   invites the re-rendering D-50-08 forbids. A caller branching on
   an ownership denial imports it from the barrel that owns it.
   It also keeps `tests/error-hygiene.test.ts`'s walk honest — that
   guard counts every error class exported from every barrel, so a
   re-export would be counted twice and the equality would move by
   two for one new class.

   ── The message form ──
   **D-140-02, ruled:** `` `${operation}: the saves store failed.` ``,
   exactly. The convention shipped three times already —
   `archive/errors.ts` is `` `${operation}: the write failed.` ``,
   T050's is `` `${operation}: the account store failed.` ``, T081's
   is `` `${operation}: the registry store failed.` ``.

   `operation` is the published reader or writer that was running,
   always a literal this module supplies at the call site. Never a
   `refId`, never an `accountId`, never a kind — **D-140-06 admits
   the operation and the caller's own FIELD NAME and never the
   caller's own VALUE**, and the reason is specific to this task: a
   `refId` echoed back to a non-owner is an existence oracle, which
   is exactly what AC1 exists to close. So a value in a rendering
   here reopens the criterion through the error surface.

   The constant is deliberately NOT exported. A test importing its
   expected message from the module under test asserts that the
   module agrees with itself, and goes on passing the day the
   wording starts interpolating something it should not.
   ============================================================ */

/**
 * A `save` read or write against Postgres failed.
 *
 * `message` is `` `${operation}: the saves store failed.` `` and nothing else. The driver
 * error travels on `cause`, which carries the statement, the bound `account_id`, the bound
 * `target_id` and the SQLSTATE — all of it, and all of it non-enumerable.
 *
 * `cause` is required and passed through the ES2022 option so the property is installed
 * non-enumerably by the language rather than by anyone remembering `Object.defineProperty`.
 * Passing `undefined` still installs it, which is what keeps the one- and two-argument
 * shapes rendering identically — `tests/error-hygiene.test.ts` constructs at both arities
 * for exactly that reason.
 */
export class SaveStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the saves store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow. */
Object.defineProperty(SaveStoreError.prototype, "name", {
  value: "SaveStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});
