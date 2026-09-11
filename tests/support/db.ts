/* ============================================================
   DarkPrint backend — shared DB test harness
   Every implementer worktree after T000 (T010, T020, ...) needs
   the same two things against a real local Postgres: a migrated
   client, and a clean slate between tests. One implementation
   here instead of nine copies that could each get the
   FK-safe delete order wrong differently.

   Test isolation, per T000: "the database is addressed
   by name — a test needing a clean one creates and drops its
   own." `DATABASE_URL` names the shared development database, so
   a client opened directly against it is a suite sharing state
   with whatever else is running, including another suite's own
   migrate/rollback (D-08). This harness creates a scratch
   database per call and drops it when the caller is done.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { is, sql } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { createDbClient, migrateUp, schema, type DbClient } from "@/lib/db";
import { testEnv } from "./env";

function withDatabaseName(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

export interface TestDb {
  client: DbClient;
  /** Closes the client and drops the scratch database it was created for. */
  drop(): Promise<void>;
}

/** A fresh, migrated database of its own — never the shared `DATABASE_URL` one. */
export async function createTestDb(): Promise<TestDb> {
  const baseUrl = testEnv().databaseUrl;
  const dbName = `darkprint_test_${randomUUID().replaceAll("-", "")}`;

  const admin = new Pool({ connectionString: baseUrl });
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  const url = withDatabaseName(baseUrl, dbName);
  const client = createDbClient(url);
  await migrateUp(client.pool);

  return {
    client,
    async drop() {
      await client.close();
      const cleanup = new Pool({ connectionString: baseUrl });
      try {
        await cleanup.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      } finally {
        await cleanup.end();
      }
    },
  };
}

/**
 * Every table `lib/db/schema.ts` declares, derived rather than listed.
 *
 * It was a hand-written list in child-before-parent order, and T005 is the reason it
 * is not any more: six tables arrived and the list named ten. A list that has to be
 * edited per table is a list that stops being edited.
 *
 * How that fails is worth stating exactly, because the obvious guess is wrong and it
 * was measured rather than reasoned about. The guess is silent contamination — rows
 * surviving a `beforeEach` that reported success. What actually happens is louder and
 * narrower: every one of the six carries a foreign key to `account`, so the old
 * `delete from "account"` at the end of the list raises 23503 the moment any suite
 * writes to one of them. Measured against the real prior implementation with a single
 * `save` row present: `Failed query: delete from "account"`.
 *
 * Louder is not the same as visible, which is why deriving it still matters. That
 * throw lands in `beforeEach`, and a failing hook runs no test — so it reports as a
 * failed *file* with nothing added to the failed *test* count, a trap that has already
 * fired once (`Tests 3954 passed` beside two failed files). And the silent
 * reading does become true for any future table with no foreign-key path into the
 * set, which a hand list and a cascade would both miss.
 *
 * Deriving it also removes the ordering, which was the other thing that could be
 * wrong: a single `TRUNCATE` over the whole set is order-independent, where N deletes
 * are only correct if the order is.
 */
function allTables(): PgTable[] {
  /* `unknown[]` first: the namespace holds enums as well as tables, and their union
     is narrower than `PgTable`, so a predicate against it cannot typecheck. */
  const exported: unknown[] = Object.values(schema);
  const tables = exported.filter((value): value is PgTable => is(value, PgTable));
  /* A derivation that finds nothing WOULD be the silent no-op described above — every
     suite running against the previous test's rows while its `beforeEach` reports
     success, with no throw anywhere to give it away. Fail closed. */
  if (tables.length === 0) {
    throw new Error(
      "resetTestDb: no tables found in the `@/lib/db` schema export — the derivation is broken, " +
        "and an empty truncation set would silently leave every suite dirty.",
    );
  }
  return tables;
}

/**
 * Empties every table between tests without dropping or re-migrating the schema.
 *
 * One `TRUNCATE` over all of them rather than a delete per table in dependency order:
 * a single statement sees the whole set at once, so no foreign key is ever momentarily
 * violated and there is no order for a new table to be inserted into wrongly. `CASCADE`
 * reaches only tables referencing the set, and the set is every table there is.
 */
export async function resetTestDb(client: DbClient): Promise<void> {
  const names = allTables()
    .map((table) => `"${getTableConfig(table).name}"`)
    .join(", ");
  await client.db.execute(sql.raw(`truncate table ${names} restart identity cascade`));
}
