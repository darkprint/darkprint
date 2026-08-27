/* ============================================================
   DarkPrint backend — naming: reading a Postgres error without
   trusting its shape
   `node-postgres` raises a `DatabaseError` carrying `.code`
   (SQLSTATE) and, for a constraint violation, `.constraint`;
   `drizzle-orm`'s node-postgres driver wraps that and chains the
   original onto `.cause`. Walk the chain rather than importing
   either error class, so this module has no compile-time
   dependency on `pg`'s or `drizzle`'s internals drifting.

   The same walk exists in `lib/server/cards/pg-error.ts`, which is
   another task's `Owns` and publishes it from no barrel. Copied
   with the attribution rather than reached for through a deep
   path — `lib/db/index.ts`'s rule is that deep paths are internal
   and may be rearranged, and a cross-task deep import would also
   make this module's gate depend on a task that has not merged.

   **Narrowed to `code` by D-70-06.** The constraint-name reader and
   the unique-violation predicate were both here to translate a
   23505 on the handle key into `HandleTakenError`. Under
   `ON CONFLICT (handle) DO UPDATE … WHERE` no such error is raised,
   so both lost their only caller and are deleted rather than left
   as a surface nothing exercises. What remains has callers: the
   SQLSTATE reader is how the fault-door cases prove a real 22P02 or
   23503 reached them.
   ============================================================ */

const MAX_CAUSE_DEPTH = 5;

function pgErrorField(err: unknown, field: "code"): string | undefined {
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

