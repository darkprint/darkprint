/**
 * Migration runner over hand-written SQL pairs (`NNNN_name.up.sql` / `.down.sql`). Real
 * down scripts, because rollback has to return the schema to its prior state and an
 * ORM-generated one-way migration cannot.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";
import { createDbClient } from "./client.ts";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const TRACKING_TABLE = `"_migrations"`;

/**
 * Arbitrary constant scoped to this runner. `pg_advisory_lock` is database-wide, so
 * concurrent `migrateUp`/`migrateDown` calls from separate pools serialise on it instead
 * of racing the tracking table and the DDL that reads it; an up and a down racing each
 * other is the same hazard, so both take it.
 */
const MIGRATION_LOCK_KEY = 847_362_951;

interface Migration {
  id: string;
  up: string;
  down: string;
}

/** Which pending migrations one `migrateUp` call applies. */
export interface MigrateUpOptions {
  /** Apply pending migrations in id order up to and including this id, and stop there. */
  to?: string;
  /**
   * Apply exactly this pending migration and nothing else, even when earlier ids are still
   * pending. For an additive migration that has to land before a deploy while a destructive
   * one numbered below it waits until after.
   */
  only?: string;
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

/**
 * Holds one client for the caller's whole migration run, locked and released around it.
 * A session-level advisory lock belongs to a connection, which is why this pins one and
 * why the runner cannot go through a transaction pooler.
 */
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
 * `target` is a pool the caller already owns, or a connection string this run opens and
 * closes itself. There is no zero-argument form reading `DATABASE_URL` implicitly: two
 * suites once drove the same database unknowingly and raced each other's teardown.
 */
async function withTargetPool<T>(target: Pool | string, fn: (pool: Pool) => Promise<T>): Promise<T> {
  if (typeof target !== "string") return fn(target);
  const client = createDbClient(target);
  try {
    return await fn(client.pool);
  } finally {
    await client.close();
  }
}

/** The pending migrations one call applies, per `options`; throws on an id that names no file. */
function selectPending(pending: Migration[], all: Migration[], options: MigrateUpOptions): Migration[] {
  if (options.only !== undefined && options.to !== undefined) {
    throw new Error("`to` and `only` are exclusive: one names a stopping point, the other a single migration.");
  }
  const known = (id: string): void => {
    if (!all.some((m) => m.id === id)) {
      throw new Error(`No migration named "${id}". Known ids: ${all.map((m) => m.id).join(", ")}`);
    }
  };
  if (options.only !== undefined) {
    known(options.only);
    return pending.filter((m) => m.id === options.only);
  }
  if (options.to !== undefined) {
    known(options.to);
    return pending.filter((m) => m.id <= (options.to as string));
  }
  return pending;
}

/**
 * Applies every migration not yet recorded, in id order, or the subset `options` names.
 * Safe to call on an already-current database: returns an empty list rather than
 * re-applying. Concurrent callers serialise on `MIGRATION_LOCK_KEY`.
 */
export async function migrateUp(target: Pool | string, dir?: string, options: MigrateUpOptions = {}): Promise<string[]> {
  return withTargetPool(target, (pool) =>
    withMigrationLock(pool, async (client) => {
      await ensureTrackingTable(client);
      const applied = new Set(await appliedIds(client));
      const all = loadMigrations(dir);
      const pending = selectPending(
        all.filter((m) => !applied.has(m.id)),
        all,
        options,
      );
      const ran: string[] = [];
      for (const migration of pending) {
        await runInTransaction(client, migration.up, async () => {
          await client.query(`INSERT INTO ${TRACKING_TABLE} (id) VALUES ($1)`, [migration.id]);
        });
        ran.push(migration.id);
      }
      return ran;
    }),
  );
}

/**
 * Rolls back the `steps` most recently applied migrations, most recent first. Rolling
 * back everything returns the schema to an empty database, byte-for-byte what
 * `migrateUp` started from.
 */
export async function migrateDown(target: Pool | string, steps = 1, dir?: string): Promise<string[]> {
  return withTargetPool(target, (pool) =>
    withMigrationLock(pool, async (client) => {
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
    }),
  );
}
