#!/usr/bin/env node
/**
 * Migration CLI: `npm run db:migrate [-- --to <id> | --only <id>]` and `npm run db:rollback [-- <steps>]`.
 * A thin argv wrapper over migrate.ts so this script and the test harness share one
 * implementation of "apply" and "revert".
 *
 * The runner takes a session-level advisory lock on one pinned connection, which a
 * transaction pooler (Supabase's port 6543, pgbouncer in transaction mode) cannot serve:
 * the unlock lands on a different backend and the lock wedges forever. So migrations
 * take `MIGRATE_DATABASE_URL`, meant to be the direct or session-mode connection, and
 * fall back to `DATABASE_URL` only when it is not a transaction-pooler URL.
 */

import { Pool } from "pg";
import { migrateDown, migrateUp, type MigrateUpOptions } from "./migrate.ts";

const TRANSACTION_POOLER_MARKS = ["pooler.supabase.com:6543", "pgbouncer=true"];

/** Which env variable supplied the URL, so the refusal can say what to set instead. */
export function migrationTarget(env: Record<string, string | undefined> = process.env): { url: string; source: string } {
  const preferred = env.MIGRATE_DATABASE_URL;
  if (preferred) return { url: preferred, source: "MIGRATE_DATABASE_URL" };
  if (env.DATABASE_URL) return { url: env.DATABASE_URL, source: "DATABASE_URL" };
  throw new Error("Neither MIGRATE_DATABASE_URL nor DATABASE_URL is set.");
}

/** Throws when `url` goes through a transaction pooler, naming the variable to set instead. */
export function refuseTransactionPooler(url: string, source: string): void {
  const mark = TRANSACTION_POOLER_MARKS.find((m) => url.includes(m));
  if (mark === undefined) return;
  throw new Error(
    [
      `${source} points at a transaction pooler (it contains "${mark}").`,
      "Migrations hold a session-level advisory lock on one connection, and a transaction pooler",
      "hands the unlock to a different backend, so the lock never releases.",
      "Set MIGRATE_DATABASE_URL to the direct connection (Supabase: db.<ref>.supabase.co:5432, or",
      "the session-mode pooler on port 5432) and run again.",
    ].join("\n"),
  );
}

/** `--to <id>` and `--only <id>` from argv; anything else after the command is an error. */
export function upOptions(args: readonly string[]): MigrateUpOptions {
  const options: MigrateUpOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--to" || arg === "--only") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a migration id, for example ${arg} 0008_embedding_input`);
      if (arg === "--to") options.to = value;
      else options.only = value;
      i++;
    } else {
      throw new Error(`Unknown argument "${arg}". "up" takes --to <id> or --only <id>.`);
    }
  }
  return options;
}

async function main(): Promise<void> {
  const [, , command = "up", ...rest] = process.argv;
  const { url, source } = migrationTarget();
  refuseTransactionPooler(url, source);

  const pool = new Pool({ connectionString: url });
  try {
    if (command === "up") {
      const options = upOptions(rest);
      const ran = await migrateUp(pool, undefined, options);
      console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Nothing to apply.");
      if (options.only !== undefined) {
        const skipped = await pendingBelow(pool, options.only);
        if (skipped.length > 0) console.log(`Still pending below ${options.only}: ${skipped.join(", ")}`);
      }
    } else if (command === "down") {
      const steps = rest[0] !== undefined ? Number.parseInt(rest[0], 10) : 1;
      const reverted = await migrateDown(pool, steps);
      console.log(reverted.length ? `Reverted: ${reverted.join(", ")}` : "Nothing to revert.");
    } else {
      throw new Error(`Unknown command "${command}", expected "up" or "down"`);
    }
  } finally {
    await pool.end();
  }
}

/** Pending ids ordered before `id`, so an out-of-order apply says what it stepped over. */
async function pendingBelow(pool: Pool, id: string): Promise<string[]> {
  const { readdirSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
  const all = readdirSync(dir)
    .filter((file) => file.endsWith(".up.sql"))
    .map((file) => file.slice(0, -".up.sql".length));
  const applied = new Set((await pool.query<{ id: string }>(`SELECT id FROM "_migrations"`)).rows.map((r) => r.id));
  return all.filter((m) => m < id && !applied.has(m)).sort();
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
