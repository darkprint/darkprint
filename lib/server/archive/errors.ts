/* ============================================================
   DarkPrint backend — archive: typed rejections
   D-13 (backend.md): no rejection this module produces may carry
   the failed statement or its bound parameters, whatever its
   SQLSTATE — `DrizzleQueryError.message` opens with the full query
   and every bound parameter, including a losing writer's entire
   DOT source. A duplicate write is named with a typed
   `ArchiveConflictError` a caller can branch on (0267e52 ruling,
   shape ours to define); everything else this module cannot name
   still has to leave — a database being down must not be swallowed
   as a conflict — but leaves with a safe `message` and the driver
   error on `cause`, for whatever logs it.
   ============================================================ */

/** The two unique constraints this module's writers can hit. */
export type ArchiveConflictKind = "bundle-slug" | "release-version";

export class ArchiveConflictError extends Error {
  /**
   * `declare` plus `defineProperty`, not a field assignment, and `name` on the prototype rather
   * than in the constructor — both so the enumerable surface stays empty.
   *
   * The hygiene clause says `Object.keys(err)` is `[]` and `JSON.stringify(err)` is exactly `"{}"`.
   * A constructor assignment makes its property **enumerable**, so this class gave
   * `["name","kind"]` and `{"name":"ArchiveConflictError","kind":"bundle-slug"}` while the three
   * other merged error classes satisfied the clause exactly. Neither value is caller or driver data,
   * so it was never a *leak* — but the clause's worth is that it is absolute and mechanically
   * checkable, and an exception for "fields we meant to publish" reintroduces the list it replaced.
   *
   * Nothing downstream loses anything: `kind` is still a readable property and still what callers
   * branch on (D-14), and `instanceof` is untouched. Only its appearance in a *rendering* changes,
   * which is the whole point. Found by T090's blind author measuring all four merged classes
   * against the clause rather than against its own module.
   */
  declare readonly kind: ArchiveConflictKind;

  constructor(kind: ArchiveConflictKind, detail: string) {
    super(detail);
    Object.defineProperty(this, "kind", { value: kind, enumerable: false, writable: false });
  }
}

ArchiveConflictError.prototype.name = "ArchiveConflictError";

/* --------------------- T133 / D-133-01: the column's published shape --------------------- */

/**
 * Which clause of `StoredVocabulary` the offered value failed.
 *
 * A union rather than a free string for `ArchiveConflictKind`'s reason (D-14): a caller
 * branches on it, so the set has to be closed and checkable rather than whatever a call
 * site happened to pass.
 */
export type MalformedVocabularyClause = "not-a-mapping" | "text" | "terms";

/**
 * One fixed sentence per clause, and every one of them names the FIELD (D-13, AC4).
 *
 * None interpolates the offered value. That is not caution about this particular payload:
 * `vocabulary` is the one `addRelease` input with no assumed shape, it arrives from a
 * request body, and a message quoting it would put a caller's own content into a rendering
 * — the same rule that keeps `sanitizedWriteError` from quoting the statement it failed on.
 * The parser's diagnostic quotes the offending entry's index and `kind`, which is caller
 * content too; it travels on `cause` and nowhere else.
 */
const CLAUSE_DETAIL: Readonly<Record<MalformedVocabularyClause, string>> = {
  "not-a-mapping": "`vocabulary` must be a mapping, not an array or a primitive.",
  text: "`vocabulary.text` must be a string.",
  terms: "`vocabulary.terms` must be a list of term mappings.",
};

/**
 * AC1's refusal: `release.local_vocabulary` was offered something that is not
 * `StoredVocabulary`, and the write refuses it rather than letting a reader refuse it
 * later. A shape refused by two readers independently is a shape two authors have each
 * guessed at, which is the defect T133 exists to end.
 *
 * `declare` plus `defineProperty` rather than field assignment, and `name` on the
 * prototype — `ArchiveConflictError` above records why: a constructor assignment makes the
 * property **enumerable** and breaks the hygiene clause that `Object.keys(err)` is `[]` and
 * `JSON.stringify(err)` is exactly `"{}"`. That class shipped the bug once; this one is
 * written from its correction rather than from its original.
 */
export class MalformedVocabularyError extends Error {
  declare readonly operation: string;
  declare readonly clause: MalformedVocabularyClause;

  constructor(operation: string, clause: MalformedVocabularyClause, cause?: unknown) {
    super(`${operation}: ${CLAUSE_DETAIL[clause]}`, { cause });
    Object.defineProperty(this, "operation", { value: operation, enumerable: false, writable: false });
    Object.defineProperty(this, "clause", { value: clause, enumerable: false, writable: false });
  }
}

MalformedVocabularyError.prototype.name = "MalformedVocabularyError";

/**
 * D-14: `cause.code === "23505"` alone says *a* unique constraint was
 * violated, not *which* — so with a second unique index on either table, the
 * writer that did not own it would still label the violation as its own
 * conflict, asserting a collision that never happened. `pg` carries the
 * constraint name on the error it wraps; comparing it is what makes `kind`
 * trustworthy rather than merely plausible.
 */
export function isUniqueViolationOn(err: unknown, constraint: string): boolean {
  if (typeof err !== "object" || err === null || !("cause" in err)) return false;
  const cause = err.cause;
  if (typeof cause !== "object" || cause === null) return false;
  return (
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === constraint
  );
}

/**
 * Every write failure this module has not already given a name to — a NUL
 * byte in `text` (well-formed UTF-16, so D-12's guard does not catch it and
 * Postgres refuses the byte itself), a foreign key that does not resolve, a
 * malformed uuid — still arrives as `DrizzleQueryError`. Re-thrown rather than
 * swallowed, with `operation` naming only the function that failed and the
 * original error moved to `cause` rather than into `message`.
 */
export function sanitizedWriteError(operation: string, err: unknown): Error {
  return new Error(`${operation}: the write failed.`, { cause: err });
}
