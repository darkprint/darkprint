/* ============================================================
   DarkPrint backend — lifecycle: the one constraint name this
   module has to recognise, derived rather than restated
   D-14: `cause.code === "23505"` alone says *a* unique constraint
   was violated, not *which* — so a writer that did not own the
   index would still label the violation as its own conflict and
   assert a collision that never happened. `bundle` carries
   exactly one unique index today and `release` carries a second
   non-unique one, so position would start reading the wrong
   entry the moment a third is added; the name is what stays
   right.

   Reading `schema.ts` through drizzle's own `getTableConfig` is
   NOT editing the Forbidden file — it is the reach D-05-05 ruled
   acceptable and `lib/server/archive/constraints.ts` already
   makes, for the same reason: a rename in the schema is a rename
   here for free, where a literal beside the truth silently stops
   matching.

   **This duplicates `archive/constraints.ts`'s
   `BUNDLE_OWNER_SLUG_CONSTRAINT` and the duplication is reported
   rather than hidden.** That constant is not on
   `@/lib/server/archive`'s barrel — the barrel publishes
   `ArchiveConflictError` and `MalformedVocabularyError` and no
   constraint name — and deep paths are internal by T000's D-01,
   so it cannot be consumed. Both derive from the same schema
   entry, so they cannot drift; the copy goes away the day that
   barrel publishes the name.
   ============================================================ */

import { getTableConfig } from "drizzle-orm/pg-core";
import { schema } from "@/lib/db";

/**
 * The unique index declared on exactly `(owner_id, slug)`, by name.
 *
 * Throws at import time rather than at query time if the schema no longer has one: a config
 * error the tree should fail loudly on, not one a caller finds out about the next time a
 * duplicate write goes unrecognised.
 */
function uniqueIndexName(columnNames: readonly string[]): string {
  const found = getTableConfig(schema.bundle).indexes.find((index) => {
    if (!index.config.unique) return false;
    const names = index.config.columns.map((column) => ("name" in column ? column.name : undefined));
    return columnNames.length === names.length && columnNames.every((name) => names.includes(name));
  });
  if (found === undefined || found.config.name === undefined) {
    throw new Error(`No unique index on (${columnNames.join(", ")}) found in the schema.`);
  }
  return found.config.name;
}

export const BUNDLE_OWNER_SLUG_CONSTRAINT = uniqueIndexName(["owner_id", "slug"]);

/**
 * Whether `err` is a violation of that one index.
 *
 * `pg` carries the constraint name on the error drizzle wraps; comparing it is what makes the
 * refusal trustworthy rather than merely plausible. A 23505 from some other unique index a
 * later migration adds still arrives, and correctly leaves as a fault rather than as "that
 * slug is taken".
 */
export function isSlugCollision(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("cause" in err)) return false;
  const cause = err.cause;
  if (typeof cause !== "object" || cause === null) return false;
  return (
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === BUNDLE_OWNER_SLUG_CONSTRAINT
  );
}
