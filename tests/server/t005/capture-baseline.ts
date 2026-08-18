/* ============================================================
   T005 — freezing the base schema before T005 can move it

   Not a test file, and not collected: `vitest.config.ts` reaches
   `tests/**\/*.test.ts`.

   AC7 says the ten tables T000 shipped are byte-identical in the
   schema after this task, with one named exception. Comparing the
   post-T005 schema against a baseline this suite derives *from the
   post-T005 tree* would prove nothing: the obvious way to satisfy
   AC7 wrongly is to edit `0001_init.up.sql` in place — it is inside
   T005's `Owns` — so that base itself changes and every
   up/down round trip still agrees with itself.

   So the baseline is captured here, once, from the base commit's
   own bytes read through `git show`, and frozen into
   `baseline.json`. After that this suite never reads
   `lib/db/migrations/**` again. A migration directory rewritten
   later cannot move the thing AC7 compares against, which is the
   whole point.

   Run it with the base commit as its argument:

     node --experimental-strip-types \
       tests/server/t005/capture-baseline.ts 73e769f

   It needs DATABASE_URL and it creates and drops its own scratch
   database, like every other database-touching thing in this run.
   ============================================================ */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* A relative specifier rather than the `@` alias: this file runs under
   `node --experimental-strip-types`, outside vitest and outside Next, and neither resolves
   the alias there. Every *test* in this directory still uses the alias, because the alias is
   what a consumer writes and a suite that reached past it would be testing a different
   import surface. */
import { createDbClient } from "../../../lib/db/index.ts";

import { BASE_MIGRATION_ID, BASE_TABLES } from "./harness.ts";

const OUT = fileURLToPath(new URL("./baseline.json", import.meta.url));

async function main(): Promise<void> {
  const commit = process.argv[2];
  if (commit === undefined || commit === "") {
    throw new Error("Usage: capture-baseline.ts <base-commit-ish>");
  }

  const sha = execFileSync("git", ["rev-parse", commit], { encoding: "utf8" }).trim();
  const upSql = execFileSync("git", ["show", `${sha}:lib/db/migrations/${BASE_MIGRATION_ID}.up.sql`], {
    encoding: "utf8",
  });

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") throw new Error("DATABASE_URL is not set");
  const name = `darkprint_t005_baseline_${process.pid}`;
  const url = new URL(databaseUrl);
  const scratchUrl = new URL(databaseUrl);
  scratchUrl.pathname = `/${name}`;
  url.pathname = "/postgres";

  const admin = createDbClient(url.toString());
  await admin.query(`drop database if exists "${name}" with (force)`);
  await admin.query(`create database "${name}"`);

  const client = createDbClient(scratchUrl.toString());
  try {
    /* The base migration is one file of `--> statement-breakpoint`-separated statements, and
       `migrateUp` would apply T005's alongside it. Applied raw here for exactly that reason:
       what is wanted is base and nothing else. */
    for (const statement of upSql.split("--> statement-breakpoint")) {
      if (statement.trim() === "") continue;
      await client.query(statement);
    }

    const baseline = {
      capturedFrom: sha,
      migration: `${BASE_MIGRATION_ID}.up.sql`,
      tables: [...BASE_TABLES],
      shape: await shape(client, [...BASE_TABLES]),
      enums: await enums(client),
    };
    writeFileSync(OUT, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
    process.stdout.write(`baseline captured from ${sha} -> ${OUT}\n`);
  } finally {
    await client.close();
    await admin.query(`drop database if exists "${name}" with (force)`);
    await admin.close();
  }
}

type Client = ReturnType<typeof createDbClient>;

async function shape(client: Client, tables: string[]): Promise<Record<string, unknown[]>> {
  const columns = await client.query(
    `select table_name, column_name, data_type, udt_name, is_nullable, column_default,
            character_maximum_length, numeric_precision, numeric_scale
       from information_schema.columns
      where table_schema = 'public' and table_name = any($1)
      order by table_name, column_name`,
    [tables],
  );
  const indexes = await client.query(
    `select tablename, indexname, indexdef
       from pg_indexes
      where schemaname = 'public' and tablename = any($1)
      order by tablename, indexname`,
    [tables],
  );
  const constraints = await client.query(
    `select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
       from pg_constraint
      where connamespace = 'public'::regnamespace and conrelid::regclass::text = any($1)
      order by 1, 2`,
    [tables],
  );
  return { columns: columns.rows, indexes: indexes.rows, constraints: constraints.rows };
}

async function enums(client: Client): Promise<unknown[]> {
  const result = await client.query(
    `select t.typname as name, e.enumlabel as label
       from pg_type t join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
      order by t.typname, e.enumsortorder`,
  );
  return result.rows;
}

await main();
