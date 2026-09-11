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

/**
 * The schema as the database reports it: columns with type, nullability and default,
 * every index, every constraint. `publicTableNames` cannot express AC2's "the prior
 * state" — a rollback that drops a table and rebuilds it without its foreign key
 * passes a table-name check — and it cannot express a migration that changes no table
 * set at all, which is the case the assertions below used to get wrong.
 */
async function schemaSnapshot(pool: Pool): Promise<string> {
  /* Ordered BY `ordinal_position` and deliberately not selecting it. The number is a
     physical-layout artefact: Postgres keeps a dropped column's slot, so a column
     dropped and re-added by a correct down/up round trip comes back at 8 where it left
     at 7, and asserting it reds a migration that did nothing wrong. Measured on a
     one-column probe migration — the only difference across the round trip was that
     field. Row ORDER still carries the property worth holding, which is that the
     columns come back in the same sequence. */
  const columns = await pool.query(
    `select table_name, column_name, data_type, is_nullable,
            column_default, numeric_precision, numeric_scale, udt_name
     from information_schema.columns where table_schema = 'public'
     order by table_name, ordinal_position`,
  );
  const indexes = await pool.query(
    `select tablename, indexname, indexdef from pg_indexes
     where schemaname = 'public' order by tablename, indexname`,
  );
  const constraints = await pool.query(
    `select conrelid::regclass::text as tbl, conname, contype,
            pg_get_constraintdef(oid) as def
     from pg_constraint where connamespace = 'public'::regnamespace
     order by conrelid::regclass::text, conname`,
  );
  return JSON.stringify(
    { columns: columns.rows, indexes: indexes.rows, constraints: constraints.rows },
    null,
    1,
  );
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
      const full = await schemaSnapshot(pool);

      // AC1: re-running is a no-op, not a re-apply.
      expect(await migrateUp(pool)).toEqual([]);
      expect(await publicTableNames(pool)).toEqual(declaredTableNames());
      expect(await schemaSnapshot(pool)).toEqual(full);

      /* AC2: rollback returns the schema to the prior state — asserted as a round trip
         rather than as a claim about what one step looks like.

         This previously read `not.toEqual([])` and `not.toEqual(declaredTableNames())`,
         which encoded an assumption nobody had stated: that the LAST migration changes
         the TABLE SET. That is true of every migration on disk today and false of the
         first column-only one anybody writes, which would red both lines while being
         entirely correct. Measured, not reasoned: a probe migration adding one column
         reds them here.

         The round trip is immune to the shape of the change. Down one, up one, and the
         schema must be structurally identical — which holds whether the migration added
         six tables or widened one column, and still catches a down script that
         over-drops or one that rebuilds a table without its foreign key. */
      const ids = migrationIds();
      const reverted = await migrateDown(pool, 1);
      expect(reverted).toEqual(ids.slice(-1));
      expect(await migrateUp(pool)).toEqual(ids.slice(-1));
      expect(await schemaSnapshot(pool)).toEqual(full);

      // And all the way down is empty, one step at a time.
      expect(await migrateDown(pool, ids.length)).toEqual(ids.slice().reverse());
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

  it("`to` stops at the named id and `only` applies one migration out of order", async () => {
    const baseUrl = process.env.DATABASE_URL as string;
    const dbName = `darkprint_migrate_partial_${process.pid}_${Math.trunc(performance.now())}`;

    const admin = new Pool({ connectionString: baseUrl });
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    const url = withDatabase(baseUrl, dbName);
    const ids = migrationIds();
    /* The deploy sequence this exists for: everything up to the additive embedding column,
       then the key-scope column ahead of the destructive drop between them. */
    const stopAt = "0008_embedding_input";
    const skipped = "0009_drop_ontology_versioning";
    const single = "0010_key_scope";
    expect(ids).toEqual(expect.arrayContaining([stopAt, skipped, single]));
    try {
      expect(await migrateUp(url, undefined, { to: stopAt })).toEqual(ids.filter((id) => id <= stopAt));
      expect(await migrateUp(url, undefined, { to: stopAt })).toEqual([]);

      expect(await migrateUp(url, undefined, { only: single })).toEqual([single]);
      const pool = new Pool({ connectionString: url });
      try {
        const applied = (await pool.query<{ id: string }>(`select id from "_migrations" order by id`)).rows.map((r) => r.id);
        expect(applied).toEqual([...ids.filter((id) => id <= stopAt), single]);
        expect(applied).not.toContain(skipped);
      } finally {
        await pool.end();
      }

      // A plain run afterwards applies exactly what was stepped over, and nothing twice.
      expect(await migrateUp(url)).toEqual(ids.filter((id) => id > stopAt && id !== single));

      await expect(migrateUp(url, undefined, { to: "9999_nothing" })).rejects.toThrow(/No migration named "9999_nothing"/);
      await expect(migrateUp(url, undefined, { to: stopAt, only: single })).rejects.toThrow(/exclusive/);
    } finally {
      const cleanup = new Pool({ connectionString: baseUrl });
      await cleanup.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await cleanup.end();
    }
  });
});
