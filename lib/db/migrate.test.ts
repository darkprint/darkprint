import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { migrateDown, migrateUp } from "./migrate";

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

const EXPECTED_TABLES = [
  "account",
  "audit",
  "bundle",
  "card_version",
  "handle_reservation",
  "ontology_term",
  "ontology_version",
  "release",
  "target",
  "target_actor",
];

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
      expect(applied).toEqual(["0001_init"]);
      expect(await publicTableNames(pool)).toEqual(EXPECTED_TABLES);

      // AC1: re-running is a no-op, not a re-apply.
      expect(await migrateUp(pool)).toEqual([]);
      expect(await publicTableNames(pool)).toEqual(EXPECTED_TABLES);

      // AC2: rollback returns the schema to the prior (empty) state.
      const reverted = await migrateDown(pool, 1);
      expect(reverted).toEqual(["0001_init"]);
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
        expect(await publicTableNames(verify)).toEqual(EXPECTED_TABLES);
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
      expect(await migrateUp(url)).toEqual(["0001_init"]);
      expect(await migrateDown(url, 1)).toEqual(["0001_init"]);

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
