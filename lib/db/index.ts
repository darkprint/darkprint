/* ============================================================
   DarkPrint backend — lib/db public surface
   `lib/core/index.ts`'s rule, extended to every owned barrel:
   deep paths are internal and may be rearranged, so nothing
   outside `lib/db` should reach for one (T000 contract, D-01).
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the store promises.
   ============================================================ */

/* --------------------- Postgres client --------------------- */
export type { Db, DbClient } from "./client.ts";
export { createDbClient, getSharedDbClient, schema } from "./client.ts";

/* --------------------- migrations --------------------- */
/**
 * D-08: no zero-argument form. `migrateUp`/`migrateDown` take a `target` — a pool
 * the caller owns, or a connection string this run opens and closes itself — never
 * `DATABASE_URL` implicitly. A convenience wrapper reading it implicitly is what let
 * two suites drive the same database unknowingly and race each other's teardown.
 */
export { migrateDown, migrateUp } from "./migrate.ts";

/* --------------------- object storage --------------------- */
export type { ObjectStorage, ObjectStorageConfig } from "./storage.ts";
export { createObjectStorage, keyForDigest, objectStorageConfigFromEnv } from "./storage.ts";
