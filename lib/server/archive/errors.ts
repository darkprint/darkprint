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
  readonly kind: ArchiveConflictKind;

  constructor(kind: ArchiveConflictKind, detail: string) {
    super(detail);
    this.name = "ArchiveConflictError";
    this.kind = kind;
  }
}

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
