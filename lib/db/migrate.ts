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
import type { Pool } from "pg";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const TRACKING_TABLE = `"_migrations"`;

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

async function ensureTrackingTable(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
       id text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
}

async function appliedIds(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ id: string }>(`SELECT id FROM ${TRACKING_TABLE} ORDER BY id`);
  return result.rows.map((row) => row.id);
}

async function runInTransaction(pool: Pool, sql: string, after: (client: import("pg").PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await after(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Applies every migration not yet recorded, in id order. Safe to call on an
 * already-current database — returns an empty list rather than re-applying (AC1).
 */
export async function migrateUp(pool: Pool, dir?: string): Promise<string[]> {
  await ensureTrackingTable(pool);
  const applied = new Set(await appliedIds(pool));
  const pending = loadMigrations(dir).filter((m) => !applied.has(m.id));
  const ran: string[] = [];
  for (const migration of pending) {
    await runInTransaction(pool, migration.up, async (client) => {
      await client.query(`INSERT INTO ${TRACKING_TABLE} (id) VALUES ($1)`, [migration.id]);
    });
    ran.push(migration.id);
  }
  return ran;
}

/**
 * Rolls back the `steps` most recently applied migrations, most recent first (AC2).
 * Rolling back everything returns the schema to an empty database, byte-for-byte
 * what `migrateUp` started from.
 */
export async function migrateDown(pool: Pool, steps = 1, dir?: string): Promise<string[]> {
  await ensureTrackingTable(pool);
  // `appliedIds` is already ascending (its query orders by id); reverse for
  // most-recent-first without a second sort over the wrong element type.
  const applied = (await appliedIds(pool)).reverse();
  const toRevert = applied.slice(0, steps);
  const migrations = new Map(loadMigrations(dir).map((m) => [m.id, m]));
  const reverted: string[] = [];
  for (const id of toRevert) {
    const migration = migrations.get(id);
    if (!migration) throw new Error(`No migration file found for applied id "${id}"`);
    await runInTransaction(pool, migration.down, async (client) => {
      await client.query(`DELETE FROM ${TRACKING_TABLE} WHERE id = $1`, [id]);
    });
    reverted.push(id);
  }
  return reverted;
}
