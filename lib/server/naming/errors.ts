/* ============================================================
   DarkPrint backend — naming: typed rejections
   T070's contract publishes the admissible message form for every
   rejection path, before this file existed. Nothing else may
   appear in any rendering: the operation, the caller's own value,
   and the published forms. `cause` carries the driver error and is
   non-enumerable; `stack` is retained.

   Two departures from the published block, both reported to the
   orchestrator rather than decided here (see this task's Log):

   - `SlugTakenError` and `ReservedSlugError` are **absent**. Both
     are published with a `checkSlug:` prefix, and `checkSlug`
     returns `Availability` rather than throwing — a taken or
     reserved slug is `{ available: false }`, which is what makes
     AC1 and AC3 checkable through the published surface at all.
     An exported error class nothing can raise is a guard that
     cannot fail, so neither is defined until the contract says
     which of the two shapes it means.
   - `NamingStoreError` is **added**. A database that is down must
     not be swallowed as a conflict and must not leave carrying
     `DrizzleQueryError.message`, which opens with the statement
     and every bound parameter (D-13). The four published forms
     name the four *decisions* this module makes and none of them
     fits a fault, so this one carries the operation alone and
     nothing else — no statement, no parameter, no SQLSTATE. One
     form covers reads and writes alike: a malformed `ownerId`
     reaching `checkSlug` raises 22P02 from a `SELECT`, and a
     rendering that leaked on the read path while the write path
     was sealed would be the same defect with a different door.
   ============================================================ */

/**
 * `name` goes on the prototype, never on the instance: `this.name = "..."` in a
 * constructor creates an own **enumerable** property, which would put the class
 * name into `Object.keys(err)` and `JSON.stringify(err)` and break the invariant
 * those two renderings are pinned to (`backend.md`, the whitelist amendment:
 * `Object.keys` empty, `JSON.stringify(err)` exactly `"{}"`).
 */
function nameOnPrototype(ctor: { prototype: object }, name: string): void {
  Object.defineProperty(ctor.prototype, "name", {
    value: name,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

class NamingError extends Error {
  /**
   * The options bag is passed only when there is a cause. `new Error(m, { cause:
   * undefined })` still *installs* `cause`, because the spec installs on
   * `HasProperty` rather than on the value — so every error would answer true to
   * `hasOwnProperty("cause")` and a test written to check a cause is present would
   * be a guard that cannot fail (`backend.md`, T030's `expectCausePresent`).
   */
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
  }
}
nameOnPrototype(NamingError, "NamingError");

/** `allocateHandle` lost the race for a handle, or it was reserved before. */
export class HandleTakenError extends NamingError {}
nameOnPrototype(HandleTakenError, "HandleTakenError");

/** The value is not a legal name of its kind, and no store was touched. */
export class InvalidNameError extends NamingError {}
nameOnPrototype(InvalidNameError, "InvalidNameError");

/** A database call failed for a reason this module does not name. `cause` carries the original. */
export class NamingStoreError extends NamingError {}
nameOnPrototype(NamingStoreError, "NamingStoreError");

export function handleTakenError(handle: string, cause?: unknown): HandleTakenError {
  return new HandleTakenError(`allocateHandle: the handle \`${handle}\` is not available.`, cause);
}

/** `kind` is one of this module's own literals — "handle", "slug" — never caller data. */
export function invalidNameError(operation: string, value: string, kind: string): InvalidNameError {
  return new InvalidNameError(`${operation}: \`${value}\` is not a valid ${kind}.`);
}

export function namingStoreError(operation: string, cause: unknown): NamingStoreError {
  return new NamingStoreError(`${operation}: the database call failed.`, cause);
}
