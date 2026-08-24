/* ============================================================
   DarkPrint backend — notifications: typed rejections
   T190's contract publishes THREE admissible message forms and
   nothing else may appear in any rendering (D-190-05 widened the
   section's two to three):

        NotAccountOwnerError    "getPreferences: not this account's owner."
        NotAccountOwnerError    "setPreferences: not this account's owner."
        UnsubscribeInvalidError "unsubscribe: this link is no longer valid."
        NotificationStoreError  "<operation>: the notification store failed."

   ── two new classes, not three ──
   The not-owner refusal is **T050's class, imported and raised
   here**, on T140's precedent (D-140-02, `saves/store.ts`): one
   refusal about one thing should not have two vocabularies across
   two tasks. It is NOT re-exported from this module's barrel —
   `tests/error-hygiene.test.ts` pushes one entry per
   `(barrel, export)` pair, so re-exporting an already-counted
   class moves its equality by one with no new class in the tree,
   which is a red nobody could explain at the merge. So this task
   derives 50 -> 52 (D-190-05).

   ── no email address, and it is structural ──
   `NotificationDelivery.send` takes an `accountId` and never an
   address (D-190-03), so no address is ever in scope in this
   module. The store fault below carries the operation alone: no
   statement, no bound parameter, no SQLSTATE. That matters more
   here than the general D-13 case — `account.email` is one join
   away from every query this module runs, and a
   `DrizzleQueryError.message` opens with the statement and its
   bound parameters.

   `name` goes on the PROTOTYPE, never on the instance:
   `this.name =` in a constructor creates an own enumerable
   property, which puts the class name into `Object.keys(err)` and
   `JSON.stringify(err)` and breaks D-13's hygiene clause. That is
   the defect `tests/error-hygiene.test.ts` was written for, and it
   measures this barrel from the day it exists.
   ============================================================ */

function nameOnPrototype(ctor: { prototype: object }, name: string): void {
  Object.defineProperty(ctor.prototype, "name", {
    value: name,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

/**
 * The base both of this module's rejections extend. Exported from this FILE and not from the
 * barrel: `store.ts` needs one `instanceof` to tell a decision this module made from a fault
 * it is wrapping, and a caller branching on the base learns nothing a concrete class does not
 * tell it better.
 */
export class NotificationError extends Error {
  /**
   * The options bag is passed only when there is a cause. `new Error(m, { cause: undefined })`
   * still INSTALLS `cause`, because the spec installs on `HasProperty` rather than on the
   * value — so every instance would answer true to `hasOwnProperty("cause")` and a test
   * checking a cause is present would be a guard that cannot fail.
   */
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
  }
}
nameOnPrototype(NotificationError, "NotificationError");

/**
 * AC6's revoked link. Raised when no `unsubscribe_token` row resolves the presented token —
 * which covers a token that never existed, one already used (the row is deleted on use, and
 * that deletion IS the revocation D-190-01 chose a stored token for), and one belonging to
 * an account since deleted.
 *
 * **The four cases share one sentence deliberately.** A distinct rejection for "already used"
 * would tell anybody holding a random string whether it was ever a real token, which is the
 * same oracle B-03 closes everywhere else.
 */
export class UnsubscribeInvalidError extends NotificationError {}
nameOnPrototype(UnsubscribeInvalidError, "UnsubscribeInvalidError");

/** A database call failed for a reason this module does not name. `cause` carries the original. */
export class NotificationStoreError extends NotificationError {}
nameOnPrototype(NotificationStoreError, "NotificationStoreError");

/**
 * The whole of AC6's refusal, and it names nothing the caller sent.
 *
 * The presented token is NOT echoed. It is caller data, and a rejection that quotes it puts a
 * secret into every log line that renders the message.
 */
export function unsubscribeInvalidError(): UnsubscribeInvalidError {
  return new UnsubscribeInvalidError("unsubscribe: this link is no longer valid.");
}

export function notificationStoreError(operation: string, cause: unknown): NotificationStoreError {
  return new NotificationStoreError(`${operation}: the notification store failed.`, cause);
}
