/**
 * Postgres client factory. The index lives in Postgres and the host is a connection
 * string, so nothing here assumes local infrastructure.
 */

import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";

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
 * `pg`'s default of 10 per pool multiplies by every warm serverless instance, so production
 * defaults to 3 and stays under a hosted connection ceiling. Development and tests keep 10:
 * the race suites warm eight clients at once on one pool and a smaller pool turns them into
 * connect timeouts. `PG_POOL_MAX` overrides either.
 */
const DEFAULT_POOL_MAX = process.env.NODE_ENV === "production" ? 3 : 10;

/**
 * Pool sizing for a runtime where every warm function instance holds a pool of its own.
 * Idle connections are released after ten seconds so a quiet instance holds none, a
 * connect that cannot be made in ten seconds fails instead of queueing forever, and
 * `allowExitOnIdle` lets a script's process end without an explicit `close()`.
 */
function poolOptions(): Pick<PoolConfig, "max" | "idleTimeoutMillis" | "connectionTimeoutMillis" | "allowExitOnIdle"> {
  const configured = Number.parseInt(process.env.PG_POOL_MAX ?? "", 10);
  return {
    max: Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_POOL_MAX,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  };
}

/**
 * One pool per call. A caller that wants an isolated instance (a test, a script) holds
 * onto the returned `DbClient` itself and closes it when done. A string target gets the
 * serverless pool options; a `PoolConfig` is taken as written, so a caller can size its
 * own pool.
 */
export function createDbClient(config: string | PoolConfig = requiredEnv("DATABASE_URL")): DbClient {
  const pool =
    typeof config === "string" ? new Pool({ connectionString: config, ...poolOptions() }) : new Pool(config);
  /* `pg` reports an idle connection dying (a restart, a failover, an admin terminate) as
     an `'error'` event on the pool, and an EventEmitter with no listener for it crashes the
     process on the next occurrence. */
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
 * symbol rather than at module scope, because Next's dev server hot-reloads route
 * modules on every save and a module-scope singleton would leak a pool per edit.
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
