#!/usr/bin/env node
/* ============================================================
   DarkPrint backend — migration CLI
   `npm run db:migrate` / `npm run db:rollback`. Thin argv wrapper
   over migrate.ts so both this script and a test harness share
   one implementation of "apply" and "revert".
   ============================================================ */

import { Pool } from "pg";
import { migrateDown, migrateUp } from "./migrate.ts";

async function main(): Promise<void> {
  const [, , command = "up", stepsArg] = process.argv;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    if (command === "up") {
      const ran = await migrateUp(pool);
      console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Nothing to apply.");
    } else if (command === "down") {
      const steps = stepsArg ? Number.parseInt(stepsArg, 10) : 1;
      const reverted = await migrateDown(pool, steps);
      console.log(reverted.length ? `Reverted: ${reverted.join(", ")}` : "Nothing to revert.");
    } else {
      throw new Error(`Unknown command "${command}", expected "up" or "down"`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
