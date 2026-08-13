/* ============================================================
   DarkPrint backend — archive: typed rejections
   D-13 (backend.md): a duplicate write must reject with something
   a caller can branch on without reaching through `cause` into a
   Postgres-specific field, and without echoing the failed
   statement or its bound parameters — `DrizzleQueryError.message`
   does both. The 0267e52 ruling made duplicate rejection a named
   T010 behaviour; the exact shape below is this module's own to
   define.
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
 * `drizzle-orm`'s `DrizzleQueryError` carries no `code` of its own — the `pg`
 * error it wraps is `cause`, and `23505` is Postgres's unique-violation
 * SQLSTATE. This is the one place either writer reaches for it, so a
 * `pg`/`drizzle-orm` upgrade that changes the wrapping has one call site to
 * fix rather than two.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("cause" in err)) return false;
  const cause = err.cause;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}
