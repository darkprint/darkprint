/* ============================================================
   DarkPrint backend — observability: typed rejections
   T240's published block names no error class, and D-240-05 adds
   this one on `NamingStoreError`'s and `LimitsStoreError`'s
   precedent: both were added beyond their own blocks, for this
   reason, and reported rather than decided quietly.

   ── Why `writeAudit` propagates at all ──
   The block says this module *writes rows rather than raising*.
   D-240-05 reads that as *makes no policy decision*, not as
   *swallows faults*: `audit.actor_id` is a real foreign key to
   `account.id`, so an entry naming an account that does not exist
   raises 23503. Swallowing it violates AC1 in the direction
   nothing checks — **zero rows, silently** — where every cell
   anyone writes counts rows that were asked for and looks for one
   too many rather than none.

   ── Why the rendering carries the operation and nothing else ──
   D-13: no rejection may carry the failed statement or its bound
   parameters. Here the bound parameters ARE the audit `detail`,
   which is the one payload AC3 exists to keep out of a rendering,
   so a `DrizzleQueryError` reaching a caller would leak precisely
   the field this module is built to protect. `cause` carries the
   driver error whole — statement, parameters, SQLSTATE — and
   carries it non-enumerably.

   The message literal is deliberately NOT exported. A test that
   imports its expected message from the module under test asserts
   that the module agrees with itself, and goes on passing the day
   the wording starts interpolating something it should not.
   ============================================================ */

/**
 * An `audit` read or write against Postgres failed.
 *
 * `message` is `` `${operation}: the audit store failed.` `` and nothing else — no
 * statement, no bound parameter, no SQLSTATE, and nothing from the entry that failed
 * to write.
 *
 * `cause` is required and passed through the ES2022 options bag so the property is
 * installed non-enumerably by the language rather than by anyone remembering
 * `Object.defineProperty`. Passing `undefined` still installs it, which is what keeps
 * the one- and two-argument shapes rendering identically.
 */
export class AuditStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the audit store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow
   (`tests/error-hygiene.test.ts`, D-13's hygiene clause). */
Object.defineProperty(AuditStoreError.prototype, "name", {
  value: "AuditStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/**
 * `listAudit` refused a caller that is not the operator (D-240-04, B-13).
 *
 * The published sentence is the whole rendering: **nothing about the target**, because
 * naming a target the caller may not see is itself a leak — B-03's 404-not-403, one
 * layer down. It takes no argument for the same reason `rateLimitedError` takes no
 * subject: a parameter that exists is a parameter somebody interpolates later, so the
 * signature is what makes the clause structural instead of a rule a future editor has
 * to know.
 */
export class NotPermittedError extends Error {
  constructor() {
    super("listAudit: not permitted.");
  }
}

Object.defineProperty(NotPermittedError.prototype, "name", {
  value: "NotPermittedError",
  enumerable: false,
  writable: true,
  configurable: true,
});
