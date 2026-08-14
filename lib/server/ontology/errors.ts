/* ============================================================
   DarkPrint backend — ontology store rejections
   No rejection carries the statement or its parameters. A
   `DrizzleQueryError` opens with the whole INSERT and every bound
   parameter, which here is the caller's entire vocabulary, and
   T010 paid two rounds for letting one through.

   So every error leaving this module is one of the classes below,
   whose own properties are exactly `["message", "cause"]` with
   `cause` non-enumerable — `JSON.stringify(err)` is `{}` and a
   logger that serialises an error cannot reach the driver's copy
   of the statement through it.

   The rule is about what leaks through a *rendering*, not about
   the own-property list (2026-08-14 amendment). `stack` is an own
   property of every V8 `Error` and is **retained**: the earlier
   wording, "own properties exactly message and cause", could only
   be satisfied by deleting it, which costs every real failure its
   trace. What has to hold instead:

   - `Object.keys(err)` is empty and `JSON.stringify(err)` is
     exactly `"{}"`.
   - `cause` is present and non-enumerable, which is what keeps
     `JSON.stringify` from reaching it.
   - No rendering carries the statement, a bound parameter, the
     caller's content, a SQLSTATE or a `pg` internal.

   `name` lives on the prototype, never on the instance, so it
   cannot appear in an enumeration either. Callers branch on
   `instanceof`, and the classes are separate rather than one class
   with a `code` field so that nothing enumerable has to be added
   to carry the distinction. That is also why no error here carries
   the `Diagnostic[]` explaining it: a caller wanting detail calls
   `validateVocabulary`, which is published for that purpose.

   A version string *is* rendered, deliberately. It is the caller's
   own identifier, not its content — the vocabulary's terms, labels
   and descriptions never appear — and it is what makes the failure
   actionable rather than anonymous.
   ============================================================ */

/** Base for every rejection this module raises. */
export class OntologyStoreError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    // Always defined, even when `cause` is `undefined`, so the own-property set is
    // exactly ["message", "cause"] for every instance rather than varying by call site.
    Object.defineProperty(this, "cause", {
      value: cause,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }
}
OntologyStoreError.prototype.name = "OntologyStoreError";

/** The vocabulary holds content that cannot round-trip through storage. */
export class MalformedContentError extends OntologyStoreError {}
MalformedContentError.prototype.name = "MalformedContentError";

/** `validateVocabulary` reported at least one `error`-severity diagnostic. */
export class InvalidVocabularyError extends OntologyStoreError {}
InvalidVocabularyError.prototype.name = "InvalidVocabularyError";

/** A version with this semver is already published. Versions are immutable. */
export class DuplicateOntologyVersionError extends OntologyStoreError {}
DuplicateOntologyVersionError.prototype.name = "DuplicateOntologyVersionError";

/** `openView` was asked for a version that is not in the store. */
export class UnknownOntologyVersionError extends OntologyStoreError {}
UnknownOntologyVersionError.prototype.name = "UnknownOntologyVersionError";
