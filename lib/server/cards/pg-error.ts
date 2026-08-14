/* ============================================================
   DarkPrint backend — reading a Postgres error without trusting
   its shape
   `node-postgres` raises a `DatabaseError` carrying `.code`
   (SQLSTATE) and, for a constraint violation, `.constraint`;
   `drizzle-orm`'s node-postgres driver wraps that in a
   `DrizzleQueryError` and chains the original onto `.cause`. Walk
   the `.cause` chain rather than importing either error class, so
   this module has no compile-time dependency on `pg`'s or
   `drizzle`'s internals drifting.
   ============================================================ */

const MAX_CAUSE_DEPTH = 5;

function pgErrorField(err: unknown, field: "code" | "constraint"): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== "object" || current === null) return undefined;
    const record = current as Record<string, unknown>;
    const value = record[field];
    if (typeof value === "string") return value;
    current = record.cause;
  }
  return undefined;
}

/** SQLSTATE, if `err` (or something in its `.cause` chain) carries one. */
export function pgErrorCode(err: unknown): string | undefined {
  return pgErrorField(err, "code");
}

/** The violated constraint's name, if `err` names one. */
export function pgErrorConstraint(err: unknown): string | undefined {
  return pgErrorField(err, "constraint");
}
