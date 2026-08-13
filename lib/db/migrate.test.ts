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
});
