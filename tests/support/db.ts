/* ============================================================
   DarkPrint backend — shared DB test harness
   Every implementer worktree after T000 (T010, T020, ...) needs
   the same two things against a real local Postgres: a migrated
   client, and a clean slate between tests. One implementation
   here instead of nine copies that could each get the
   FK-safe delete order wrong differently.
   ============================================================ */

import { createDbClient, schema, type DbClient } from "@/lib/db/client";
import { migrateUp } from "@/lib/db/migrate";
import { testEnv } from "./env";

/** A client against `DATABASE_URL`, migrated to current. Caller closes it (`client.close()`). */
export async function createTestDbClient(): Promise<DbClient> {
  const client = createDbClient(testEnv().databaseUrl);
  await migrateUp(client.pool);
  return client;
}

/** Children before the parents they reference — mirrors `migrations/0001_init.down.sql`. */
const TABLES_CHILDREN_FIRST = [
  schema.target,
  schema.release,
  schema.ontologyTerm,
  schema.ontologyVersion,
  schema.handleReservation,
  schema.cardVersion,
  schema.bundle,
  schema.audit,
  schema.account,
] as const;

/** Empties every table between tests without dropping or re-migrating the schema. */
export async function resetTestDb(client: DbClient): Promise<void> {
  for (const table of TABLES_CHILDREN_FIRST) {
    await client.db.delete(table);
  }
}
