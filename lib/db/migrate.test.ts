import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { migrateDown, migrateUp } from "./migrate.ts";
import * as schema from "./schema.ts";

/**
 * Needs a live Postgres (`docker compose up -d`, per compose.yaml) and skips
 * gracefully without one, so `npm test` stays green on a checkout that has not
 * started local infrastructure — see tests/support/env.ts's own reasoning.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/**
 * Every table `schema.ts` declares, sorted the way `publicTableNames` reads them back.
 *
 * It was a list of ten names, and T005 is the reason it is not any more: six tables
 * arrived and every `toEqual` against that list reddened at once. Deriving it means a
 * table added later needs no edit here — and the assertion gets *stronger* rather than
 * weaker, because it now says "the database holds exactly what the schema declares"
 * where the literal said "the database holds these ten names", which is a claim about
 * a moment rather than about the schema.
 */
function declaredTableNames(): string[] {
  const exported: unknown[] = Object.values(schema);
  const names = exported
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => getTableConfig(table).name)
    .sort();
  /* A derivation that finds nothing would make every assertion below compare [] to []
     and pass — a set that can only be empty is not a measurement. Fail closed. */
  expect(names.length).toBeGreaterThan(0);
  return names;
}

/**
 * Every migration on disk, in the order `migrateUp` applies them. Derived for the same
 * reason: `["0001_init"]` was true until a second pair landed, and the point of the
 * assertion is that `migrateUp` reports what it ran, not that the run is one file long.
 */
function migrationIds(): string[] {
  return readdirSync(join(dirname(fileURLToPath(import.meta.url)), "migrations"))
    .filter((file) => file.endsWith(".up.sql"))
    .map((file) => file.slice(0, -".up.sql".length))
    .sort();
}

async function publicTableNames(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_name <> '_migrations'
     order by table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

describe.skipIf(!hasDb)("lib/db/migrate", () => {
  it("AC1/AC2: applies to an empty database, is idempotent, and rolls back to the prior state", async () => {
    const baseUrl = process.env.DATABASE_URL as string;
    const dbName = `darkprint_migrate_test_${process.pid}_${Math.trunc(performance.now())}`;

    const admin = new Pool({ connectionString: baseUrl });
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    const pool = new Pool({ connectionString: withDatabase(baseUrl, dbName) });
    try {
      expect(await publicTableNames(pool)).toEqual([]);

      const applied = await migrateUp(pool);
      expect(applied).toEqual(migrationIds());
      expect(await publicTableNames(pool)).toEqual(declaredTableNames());

      // AC1: re-running is a no-op, not a re-apply.
      expect(await migrateUp(pool)).toEqual([]);
      expect(await publicTableNames(pool)).toEqual(declaredTableNames());

      /* AC2: rollback returns the schema to the prior state. With a second migration
         on disk the "prior state" is no longer the empty one, and that is a stronger
         assertion than this test could make when rolling back the only migration
         there was — one step must land on the *intermediate* schema, not on nothing.
         A down script that over-drops passes an is-it-empty check and fails here. */
      const ids = migrationIds();
      const reverted = await migrateDown(pool, 1);
      expect(reverted).toEqual(ids.slice(-1));
      expect(await publicTableNames(pool)).not.toEqual([]);
      expect(await publicTableNames(pool)).not.toEqual(declaredTableNames());

      // The rest of the way down is empty, one step at a time.
      expect(await migrateDown(pool, ids.length - 1)).toEqual(ids.slice(0, -1).reverse());
      expect(await publicTableNames(pool)).toEqual([]);

      // Rolling back with nothing applied is also a no-op, not an error.
      expect(await migrateDown(pool, 1)).toEqual([]);
    } finally {
      await pool.end();
      const cleanup = new Pool({ connectionString: baseUrl });
      await cleanup.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await cleanup.end();
    }
  });

  it("D-06: concurrent migrateUp callers from empty serialise instead of crashing", async () => {
    const baseUrl = process.env.DATABASE_URL as string;
    const dbName = `darkprint_migrate_race_${process.pid}_${Math.trunc(performance.now())}`;

    const admin = new Pool({ connectionString: baseUrl });
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    // Four separate pools, the way four app instances booting at once each hold their
    // own — the advisory lock has to serialise across connections, not just within one.
    const url = withDatabase(baseUrl, dbName);
    const pools = Array.from({ length: 4 }, () => new Pool({ connectionString: url }));
    try {
      const results = await Promise.allSettled(pools.map((pool) => migrateUp(pool)));
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(rejected.map((r) => String(r.reason))).toEqual([]);

      const verify = new Pool({ connectionString: url });
      try {
        expect(await publicTableNames(verify)).toEqual(declaredTableNames());
      } finally {
        await verify.end();
      }
    } finally {
      await Promise.all(pools.map((pool) => pool.end()));
      const cleanup = new Pool({ connectionString: baseUrl });
      await cleanup.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await cleanup.end();
    }
  }, 60_000);

  it("D-08: target may be a connection string, not only a pool the caller owns", async () => {
    const baseUrl = process.env.DATABASE_URL as string;
    const dbName = `darkprint_migrate_target_${process.pid}_${Math.trunc(performance.now())}`;

    const admin = new Pool({ connectionString: baseUrl });
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    const url = withDatabase(baseUrl, dbName);
    try {
      // migrateUp/migrateDown open and close their own connection for a string
      // target — nothing here hands them a `Pool`.
      expect(await migrateUp(url)).toEqual(migrationIds());
      expect(await migrateDown(url, migrationIds().length)).toEqual(migrationIds().slice().reverse());

      const verify = new Pool({ connectionString: url });
      try {
        expect(await publicTableNames(verify)).toEqual([]);
      } finally {
        await verify.end();
      }
    } finally {
      const cleanup = new Pool({ connectionString: baseUrl });
      await cleanup.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await cleanup.end();
    }
  });
});
