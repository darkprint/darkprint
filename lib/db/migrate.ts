/* ============================================================
   DarkPrint backend — migration runner
   Hand-written SQL pairs (`NNNN_name.up.sql` / `.down.sql`)
   rather than an ORM-generated one-way migration, because AC2
   ("rollback returns the schema to the prior state") needs a
   real down script and drizzle-kit does not generate one.
   ============================================================ */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";
import { createDbClient } from "./client";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const TRACKING_TABLE = `"_migrations"`;

/**
 * D-06: arbitrary constant scoped to this migration runner. `pg_advisory_lock` is
 * database-wide, so every concurrent `migrateUp`/`migrateDown` — even from separate
 * pools — serialises on it rather than racing the tracking table and the DDL that
 * reads it, which is what crashed 3 of 4 concurrent cold-boot runs on
 * `pg_type_typname_nsp_index`. `migrateDown` takes the same key: an up and a down
 * racing each other is the identical hazard.
 */
const MIGRATION_LOCK_KEY = 847_362_951;

interface Migration {
  id: string;
  up: string;
  down: string;
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const upFiles = readdirSync(dir).filter((file) => file.endsWith(".up.sql"));
  return upFiles
    .map((file) => {
      const id = file.slice(0, -".up.sql".length);
      const up = readFileSync(join(dir, file), "utf8");
      const down = readFileSync(join(dir, `${id}.down.sql`), "utf8");
      return { id, up, down };
    })
    .sort(byId);
}

async function ensureTrackingTable(client: PoolClient): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
       id text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
}

async function appliedIds(client: PoolClient): Promise<string[]> {
  const result = await client.query<{ id: string }>(`SELECT id FROM ${TRACKING_TABLE} ORDER BY id`);
  return result.rows.map((row) => row.id);
}

async function runInTransaction(client: PoolClient, sql: string, after: () => Promise<void>): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await after();
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

/** Holds one client for the caller's whole migration run, locked and released around it. */
async function withMigrationLock<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    try {
      return await fn(client);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

/**
 * Applies every migration not yet recorded, in id order. Safe to call on an
 * already-current database — returns an empty list rather than re-applying (AC1).
 * Concurrent callers serialise on `MIGRATION_LOCK_KEY` rather than racing the
 * tracking table (AC1, concurrency; D-06).
 */
export async function migrateUp(pool: Pool, dir?: string): Promise<string[]> {
  return withMigrationLock(pool, async (client) => {
    await ensureTrackingTable(client);
    const applied = new Set(await appliedIds(client));
    const pending = loadMigrations(dir).filter((m) => !applied.has(m.id));
    const ran: string[] = [];
    for (const migration of pending) {
      await runInTransaction(client, migration.up, async () => {
        await client.query(`INSERT INTO ${TRACKING_TABLE} (id) VALUES ($1)`, [migration.id]);
      });
      ran.push(migration.id);
    }
    return ran;
  });
}

/**
 * Rolls back the `steps` most recently applied migrations, most recent first (AC2).
 * Rolling back everything returns the schema to an empty database, byte-for-byte
 * what `migrateUp` started from.
 */
export async function migrateDown(pool: Pool, steps = 1, dir?: string): Promise<string[]> {
  return withMigrationLock(pool, async (client) => {
    await ensureTrackingTable(client);
    // `appliedIds` is already ascending (its query orders by id); reverse for
    // most-recent-first without a second sort over the wrong element type.
    const applied = (await appliedIds(client)).reverse();
    const toRevert = applied.slice(0, steps);
    const migrations = new Map(loadMigrations(dir).map((m) => [m.id, m]));
    const reverted: string[] = [];
    for (const id of toRevert) {
      const migration = migrations.get(id);
      if (!migration) throw new Error(`No migration file found for applied id "${id}"`);
      await runInTransaction(client, migration.down, async () => {
        await client.query(`DELETE FROM ${TRACKING_TABLE} WHERE id = $1`, [id]);
      });
      reverted.push(id);
    }
    return reverted;
  });
}

/**
 * Self-contained convenience wrapper over `migrateUp`: opens its own connection
 * against `DATABASE_URL` and closes it when done, for a caller with no pool of its
 * own to hand in — `@/lib/db`'s barrel is the only place this is exported.
 */
export async function migrate(dir?: string): Promise<string[]> {
  const client = createDbClient();
  try {
    return await migrateUp(client.pool, dir);
  } finally {
    await client.close();
  }
}

/** The `migrate` counterpart for `migrateDown`. */
export async function rollback(steps = 1, dir?: string): Promise<string[]> {
  const client = createDbClient();
  try {
    return await migrateDown(client.pool, steps, dir);
  } finally {
    await client.close();
  }
}
