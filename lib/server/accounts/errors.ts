/* ============================================================
   DarkPrint backend — accounts: typed rejections
   T050's contract publishes three admissible message forms before
   this file existed. Nothing else may appear in any rendering: the
   operation, the caller's own field NAME, and the published forms.

        HandleRequiredError   "<operation>: this account has no handle yet."
        NotAccountOwnerError  "<operation>: not this account's owner."
        InvalidProfileError   "<operation>: `<field>` is not valid."
        AccountStoreError     "<operation>: the account store failed."

   `<field>` is one of this module's own literals — "displayName",
   "bio", "avatarHue", "email", "visibility" — never caller data.
   That distinction is load-bearing here in a way it is not in
   T070: AC2 says no `email` value appears in any rejection,
   *including one about the email*, so the rendering of a bad email
   names the field and never the value.

   The fourth was reported as a departure and is now published as
   D-50-17, with the form above:

   - `AccountStoreError`, on T070's `NamingStoreError` precedent
     and for a reason AC2 makes stronger than T070's. A
     `DrizzleQueryError.message` opens with the statement and every
     bound parameter (D-13) — and on `setEmail` the bound
     parameters ARE the email. So an unwrapped driver fault
     escaping this module renders the one value AC2 exists to keep
     off every surface. Wrapping is what AC2 requires, not a
     stylistic preference, and none of the three published forms
     names a fault. This one carries the operation alone: no
     statement, no parameter, no SQLSTATE. `cause` carries the
     original and is non-enumerable; `stack` is retained.

     D-50-17 also gives it `upsertFromGitHub`'s door, and the
     wording reads oddly there on purpose: an empty-string
     `githubId` is a caller's mistake rather than a store failure,
     and the whitelist is closed, so it is refused with the one
     admissible form instead of a fifth invented for it.

   `name` goes on the prototype, never on the instance, for the
   reason `tests/error-hygiene.test.ts` was written: `this.name =`
   in a constructor creates an own ENUMERABLE property, which puts
   the class name into `Object.keys(err)` and `JSON.stringify(err)`
   and breaks D-13's hygiene clause. That guard builds its domain
   by construction over every `lib/server/<module>/index.ts`, so these
   classes are covered the day this barrel exists.
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
 * The base every rejection in this module extends. Exported from this FILE and not
 * from the barrel: `store.ts` needs one `instanceof` to tell a decision this module
 * made from a fault it is wrapping, and seven concrete checks would be seven places
 * to forget a class. Not published, because a caller branching on the base learns
 * nothing a concrete class does not tell it better.
 */
export class AccountError extends Error {
  /**
   * The options bag is passed only when there is a cause. `new Error(m, { cause:
   * undefined })` still *installs* `cause`, because the spec installs on `HasProperty`
   * rather than on the value — so every instance would answer true to
   * `hasOwnProperty("cause")` and a test checking a cause is present would be a guard
   * that cannot fail.
   */
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
  }
}
nameOnPrototype(AccountError, "AccountError");

/** The session is real but its account has no handle yet (AC1). The 403 half of D-50-05. */
export class HandleRequiredError extends AccountError {}
nameOnPrototype(HandleRequiredError, "HandleRequiredError");

/** The actor is not the account it is trying to read or change. */
export class NotAccountOwnerError extends AccountError {}
nameOnPrototype(NotAccountOwnerError, "NotAccountOwnerError");

/** A profile field failed this module's own predicate. Names the field, never the value. */
export class InvalidProfileError extends AccountError {}
nameOnPrototype(InvalidProfileError, "InvalidProfileError");

/** A database call failed for a reason this module does not name. `cause` carries the original. */
export class AccountStoreError extends AccountError {}
nameOnPrototype(AccountStoreError, "AccountStoreError");

export function handleRequiredError(operation: string): HandleRequiredError {
  return new HandleRequiredError(`${operation}: this account has no handle yet.`);
}

export function notAccountOwnerError(operation: string): NotAccountOwnerError {
  return new NotAccountOwnerError(`${operation}: not this account's owner.`);
}

/**
 * `field` is one of this module's own literals, never a key off a caller-supplied
 * object: a caller that can choose the field name can choose the rendering, and
 * `patch` is caller-built. `ProfileField` is what makes that structural rather than
 * a rule someone has to remember.
 */
export type ProfileField = "displayName" | "bio" | "avatarHue" | "email" | "visibility" | "handle";

export function invalidProfileError(operation: string, field: ProfileField): InvalidProfileError {
  return new InvalidProfileError(`${operation}: \`${field}\` is not valid.`);
}

export function accountStoreError(operation: string, cause: unknown): AccountStoreError {
  return new AccountStoreError(`${operation}: the account store failed.`, cause);
}
