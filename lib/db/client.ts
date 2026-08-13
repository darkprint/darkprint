/* ============================================================
   DarkPrint backend — Postgres client factory
   B-01: the index lives in Postgres, and the host is a
   connection string — nothing here assumes local infrastructure.
   ============================================================ */

import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export interface DbClient {
  db: Db;
  pool: Pool;
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  close(): Promise<void>;
}

/** Re-exported so a caller can `import { schema } from "@/lib/db/client"` alongside `db`. */
export { schema };

/**
 * One pool per call — a caller that wants an isolated instance (a test, a script)
 * holds onto the returned `DbClient` itself and closes it when done.
 */
export function createDbClient(config: string | PoolConfig = requiredEnv("DATABASE_URL")): DbClient {
  const pool = typeof config === "string" ? new Pool({ connectionString: config }) : new Pool(config);
  /**
   * D-05: `pg` documents an idle client's connection dying (a restart, a failover, an
   * admin `pg_terminate_backend`) as an `'error'` event on the pool. An `EventEmitter`
   * with no listener for that event crashes the process on the next occurrence — and
   * `getSharedDbClient` hands this one pool to every route handler in the app.
   */
  pool.on("error", (err) => {
    console.error("lib/db: idle Postgres client error", err);
  });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    query: (text, params) => pool.query(text, params),
    close: () => pool.end(),
  };
}

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

/**
 * The pool a route handler reaches for. Cached on `globalThis` behind a well-known
 * symbol, not module scope, because Next's dev server hot-reloads route modules on
 * every save — a module-scope singleton would be recreated (and its old pool
 * leaked) on each edit, where a `globalThis` slot survives the reload.
 */
export function getSharedDbClient(): DbClient {
  const withShared = globalThis as GlobalWithSharedClient;
  if (!withShared[SHARED_CLIENT_KEY]) {
    withShared[SHARED_CLIENT_KEY] = createDbClient();
  }
  return withShared[SHARED_CLIENT_KEY];
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
