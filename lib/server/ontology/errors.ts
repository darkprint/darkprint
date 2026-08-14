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

   Two consequences worth stating, because both look like
   oversights and are not:

   - `stack` is deleted. V8 installs it as an *own* property, and
     "own properties are exactly message and cause" is a rule about
     `Object.getOwnPropertyNames`, not about `Object.keys` — under
     the `Object.keys` reading the clause "`cause` non-enumerable"
     would contradict the clause it qualifies, since a
     non-enumerable `cause` is not an enumerable own property. The
     driver error keeps its own stack and stays reachable at
     `err.cause` while debugging, so the trace that matters is not
     lost.
   - `name` lives on the prototype, never on the instance, for the
     same reason. Callers branch on `instanceof`, and the classes
     are separate rather than one class with a `code` field because
     a `code` own property is exactly what the rule forbids. That
     is also why no error here carries the `Diagnostic[]` that
     explains it: a caller wanting detail calls `validateVocabulary`,
     which is published for that purpose.
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
    delete (this as { stack?: string }).stack;
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

/** A dependency this module consumes rather than implements has not shipped yet. */
export class VersioningUnavailableError extends OntologyStoreError {}
VersioningUnavailableError.prototype.name = "VersioningUnavailableError";
