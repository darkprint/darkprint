/* ============================================================
   DarkPrint backend — archive: constraint names, derived
   The index names `ArchiveConflictError`'s
   `kind` depends on were declared in three places — `lib/db/schema.ts`,
   the migration SQL, and a literal in this module — with nothing
   checking them against each other. A rename in the schema would
   have made the typed conflict silently stop arriving, with nothing
   red. Reading `schema.ts` through drizzle's own `getTableConfig` is
   not editing the Forbidden file; it derives the name this module
   already has to match instead of restating it beside the truth, so
   a rename there is a rename here for free.
   ============================================================ */

import { getTableConfig } from "drizzle-orm/pg-core";
import { schema } from "@/lib/db";

/**
 * The unique index declared on exactly this column set, by name rather than
 * by position — `release` carries a second, non-unique index today, and
 * position would silently start reading the wrong one if a third were added.
 * Throws at import time rather than at query time if the schema no longer
 * has one: a config error the tree should fail loudly on, not one a caller
 * finds out about the next time a duplicate write goes unrecognised.
 */
function uniqueIndexName(
  indexes: ReturnType<typeof getTableConfig>["indexes"],
  columnNames: readonly string[],
): string {
  const found = indexes.find((index) => {
    if (!index.config.unique) return false;
    const names = index.config.columns.map((column) => ("name" in column ? column.name : undefined));
    return columnNames.length === names.length && columnNames.every((name) => names.includes(name));
  });
  if (found === undefined || found.config.name === undefined) {
    throw new Error(`No unique index on (${columnNames.join(", ")}) found in the schema.`);
  }
  return found.config.name;
}

export const BUNDLE_OWNER_SLUG_CONSTRAINT = uniqueIndexName(getTableConfig(schema.bundle).indexes, [
  "owner_id",
  "slug",
]);

export const RELEASE_BUNDLE_VERSION_CONSTRAINT = uniqueIndexName(getTableConfig(schema.release).indexes, [
  "bundle_id",
  "version",
]);
