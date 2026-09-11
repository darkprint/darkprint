#!/usr/bin/env node
/**
 * Read-only report on a DarkPrint database, for the operator preparing a deploy.
 *
 *   npm run preflight:db                       reads DATABASE_URL (or MIGRATE_DATABASE_URL when set)
 *   npm run preflight:db -- <postgres url>     reads the URL given
 *
 * Prints which migrations are applied, table counts, the shape of the stored card bodies
 * and release manifests, embedding coverage, and whether the URL is a transaction pooler.
 * Raw SQL over `pg` only, on purpose: the target is usually BEHIND the code (a
 * pre-migration production database still has to answer), so the drizzle schema, which
 * selects columns the target may not have yet, is never imported here. Every statement
 * runs inside one READ ONLY transaction, so a typo cannot become a write.
 *
 * What the numbers mean:
 *   bodies with willNot == cards and bodies with requiresHuman == 0   the card rows are migrated
 *   bodies with willNot == 0 and bodies with requiresHuman == cards   the rows still need scripts/migrate-stored-cards.ts
 *   release_embedding < releases or card_version_embedding < cards    `npm run db:reembed` has work to do
 */

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Pool } = pg;

/**
 * Read off the directory rather than listed here, because a hand-kept list silently
 * under-reports: this stood as a literal ending at `0010_key_scope` while
 * `0011_tutorial_live` sat beside it on disk, so the line below claimed nothing was
 * pending that the operator still had to run. `lib/db/migrate.ts` owns the same
 * convention and is deliberately not imported: this script has to answer about a database
 * BEHIND the code, so it pulls in no schema.
 */
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "db", "migrations");
const MIGRATIONS_ON_DISK = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".up.sql"))
  .map((file) => file.slice(0, -".up.sql".length))
  .sort();

const TABLES = [
  "account",
  "bundle",
  "release",
  "card_version",
  "release_embedding",
  "card_version_embedding",
  "api_key",
  "save",
  "note",
  "run_report",
  "notification_queue",
  "follow",
  "profile_pin",
  "account_support",
  "audit",
];

interface Row {
  [column: string]: unknown;
}

function target(): string {
  const fromArgv = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const url = fromArgv ?? process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Give a postgres URL as the first argument, or set DATABASE_URL.");
  return url;
}

/** Host, port and database only. The password never reaches the terminal. */
function describe(url: string): string {
  const parsed = new URL(url);
  return `host=${parsed.hostname} port=${parsed.port || "5432"} database=${decodeURIComponent(parsed.pathname.replace(/^\//, ""))} user=${decodeURIComponent(parsed.username)}`;
}

function isTransactionPooler(url: string): boolean {
  return url.includes("pooler.supabase.com:6543") || url.includes("pgbouncer=true");
}

const line = (label: string, value: unknown): void => {
  console.log(`  ${label.padEnd(44)} ${String(value)}`);
};

async function main(): Promise<void> {
  const url = target();
  console.log(`database  ${describe(url)}`);
  const pooler = isTransactionPooler(url);
  console.log(`pooler    ${pooler ? "TRANSACTION POOLER: fine for the runtime, NOT for migrations or the card migration script" : "direct or session connection"}`);
  console.log("");

  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const q = async (sql: string): Promise<Row[]> => (await client.query(sql)).rows as Row[];
    const count = async (table: string): Promise<number | "absent"> => {
      const exists = await q(`select 1 from information_schema.tables where table_schema = 'public' and table_name = '${table}'`);
      if (exists.length === 0) return "absent";
      return Number((await q(`select count(*)::int as n from "${table}"`))[0]?.n ?? 0);
    };

    /* Migrations: what the tracking table says, and which files on disk it has not seen. */
    const tracking = await q(`select 1 from information_schema.tables where table_schema = 'public' and table_name = '_migrations'`);
    const applied = tracking.length === 0 ? [] : (await q(`select id from "_migrations" order by id`)).map((r) => String(r.id));
    console.log("migrations");
    line("applied", applied.length === 0 ? "(no _migrations table)" : applied.join(", "));
    line("head", applied.at(-1) ?? "(none)");
    const pending = MIGRATIONS_ON_DISK.filter((id) => !applied.includes(id));
    line("pending, as this checkout knows them", pending.length === 0 ? "(none)" : pending.join(", "));
    line("release.scored_ontology_version_id", (await q(`select 1 from information_schema.columns where table_name = 'release' and column_name = 'scored_ontology_version_id'`)).length > 0 ? "present (0009 not applied)" : "absent (0009 applied)");
    line("api_key.scope", (await q(`select 1 from information_schema.columns where table_name = 'api_key' and column_name = 'scope'`)).length > 0 ? "present (0010 applied)" : "absent (0010 not applied)");
    line("*_embedding.embedded_input_sha256", (await q(`select 1 from information_schema.columns where table_name = 'release_embedding' and column_name = 'embedded_input_sha256'`)).length > 0 ? "present (0008 applied)" : "absent (0008 not applied)");
    console.log("");

    console.log("tables");
    for (const table of TABLES) line(table, await count(table));
    console.log("");

    const cards = await count("card_version");
    console.log("card bodies");
    if (cards === "absent") {
      line("card_version", "absent");
    } else {
      line("cards", cards);
      line("bodies with willNot", (await q(`select count(*)::int as n from card_version where body ? 'willNot'`))[0]?.n);
      line("bodies with requiresHuman", (await q(`select count(*)::int as n from card_version where body ? 'requiresHuman'`))[0]?.n);
      line("bodies with ontologyVersion", (await q(`select count(*)::int as n from card_version where body ? 'ontologyVersion'`))[0]?.n);
      line("sources with a will_not: line", (await q(`select count(*)::int as n from card_version where source ~ '(^|\n)will_not:'`))[0]?.n);
      line("sources with a requires_human: line", (await q(`select count(*)::int as n from card_version where source ~ '(^|\n)requires_human:'`))[0]?.n);
      line("distinct card ids", (await q(`select count(distinct card_id)::int as n from card_version`))[0]?.n);
      line("private card versions", (await q(`select count(*)::int as n from card_version where visibility = 'private'`))[0]?.n);
    }
    console.log("");

    const releases = await count("release");
    console.log("release manifests");
    if (releases === "absent") {
      line("release", "absent");
    } else {
      line("releases", releases);
      line("manifests with ontologyVersion", (await q(`select count(*)::int as n from release where manifest ? 'ontologyVersion'`))[0]?.n);
      line("releases with a local vocabulary", (await q(`select count(*)::int as n from release where local_vocabulary is not null`))[0]?.n);
      line("releases with a stored scorecard", (await q(`select count(*)::int as n from release where autonomy is not null`))[0]?.n);
      line("bundles", await count("bundle"));
      line("private bundles", (await q(`select count(*)::int as n from bundle where visibility = 'private'`))[0]?.n);
      line("distinct release digests", (await q(`select count(distinct digest)::int as n from release`))[0]?.n);
    }
    console.log("");

    console.log("embeddings");
    const relEmb = await count("release_embedding");
    const cardEmb = await count("card_version_embedding");
    line("release_embedding / releases", `${relEmb} / ${releases}`);
    line("card_version_embedding / cards", `${cardEmb} / ${cards}`);
    if (relEmb !== "absent" && (await q(`select 1 from information_schema.columns where table_name = 'release_embedding' and column_name = 'embedded_input_sha256'`)).length > 0) {
      line("release vectors with an input hash", (await q(`select count(*)::int as n from release_embedding where embedded_input_sha256 is not null`))[0]?.n);
      line("card vectors with an input hash", (await q(`select count(*)::int as n from card_version_embedding where embedded_input_sha256 is not null`))[0]?.n);
    }
    console.log("");

    console.log("activity");
    line("run_report", await count("run_report"));
    line("notification_queue", await count("notification_queue"));
    line("api_key", await count("api_key"));
    line("accounts with a handle", (await q(`select count(*)::int as n from account where handle is not null`))[0]?.n);
    await client.query("ROLLBACK");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
