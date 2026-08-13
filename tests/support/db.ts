/* ============================================================
   DarkPrint backend — shared DB test harness
   Every implementer worktree after T000 (T010, T020, ...) needs
   the same two things against a real local Postgres: a migrated
   client, and a clean slate between tests. One implementation
   here instead of nine copies that could each get the
   FK-safe delete order wrong differently.

   Test isolation (backend.md, T000): "the database is addressed
   by name — a test needing a clean one creates and drops its
   own." `DATABASE_URL` names the shared development database, so
   a client opened directly against it is a suite sharing state
   with whatever else is running, including another suite's own
   migrate/rollback (D-08). This harness creates a scratch
   database per call and drops it when the caller is done.
   ============================================================ */

import { randomUUID } from "node:crypto";
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

/** Children before the parents they reference — mirrors `migrations/0001_init.down.sql`. */
const TABLES_CHILDREN_FIRST = [
  schema.targetActor,
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
