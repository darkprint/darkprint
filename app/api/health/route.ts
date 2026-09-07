/**
 * GET /api/health: one request that says whether this deployment can serve. Reads the
 * database with raw SQL rather than the drizzle schema because the target may be behind
 * the code (a pre-migration production database still has to answer), and reports the
 * encoder because a missing model degrades search silently otherwise. Names which
 * variables are configured and never their values.
 */

import { getSharedDbClient } from "@/lib/db";
import { encoderAvailable } from "@/lib/server/search/embed";

export const dynamic = "force-dynamic";

const STORAGE_VARIABLES = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;
const PROVIDERS = {
  github: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
} as const;

interface Health {
  ok: boolean;
  /**
   * `migrationsApplied` sits beside the head because the head alone cannot tell a database
   * with the additive migrations applied ahead of the destructive one (head 0010, nine
   * applied) from a fully migrated one (head 0010, ten applied), and the deploy runbook
   * passes through exactly that state.
   */
  db: { latencyMs: number; migrationsHead: string | null; migrationsApplied: number } | { error: string };
  encoder: "present" | "absent";
  storage: "configured" | "missing";
  auth: { providers: string[] };
  commit: string | null;
}

const isSet = (name: string): boolean => Boolean(process.env[name]);

async function readDb(): Promise<Health["db"]> {
  try {
    const { query } = getSharedDbClient();
    const started = performance.now();
    await query("select 1");
    const latencyMs = Math.round(performance.now() - started);
    const applied = await query<{ id: string }>(`select id from "_migrations" order by id`);
    return { latencyMs, migrationsHead: applied.rows.at(-1)?.id ?? null, migrationsApplied: applied.rowCount ?? applied.rows.length };
  } catch (err) {
    /* The message names the failure class (a refused connection, a missing table) and never
       the connection string: `pg` does not put credentials in its errors. */
    return { error: err instanceof Error ? err.message : "database read failed" };
  }
}

export async function GET(): Promise<Response> {
  const [db, encoder] = await Promise.all([readDb(), encoderAvailable()]);
  const body: Health = {
    ok: !("error" in db),
    db,
    encoder: encoder ? "present" : "absent",
    storage: STORAGE_VARIABLES.every(isSet) ? "configured" : "missing",
    auth: {
      providers: Object.entries(PROVIDERS)
        .filter(([, names]) => names.every(isSet))
        .map(([provider]) => provider),
    },
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  };
  return new Response(JSON.stringify(body), {
    status: body.ok ? 200 : 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
