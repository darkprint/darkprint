/* ============================================================
   DarkPrint backend — lib/db public surface
   `lib/core/index.ts`'s rule, extended to every owned barrel:
   deep paths are internal and may be rearranged, so nothing
   outside `lib/db` should reach for one (T000 contract, D-01).
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the store promises.
   ============================================================ */

/* --------------------- Postgres client --------------------- */
export type { Db, DbClient } from "./client";
export { createDbClient, getSharedDbClient, schema } from "./client";

/* --------------------- migrations --------------------- */
export { migrate, migrateDown, migrateUp, rollback } from "./migrate";

/* --------------------- object storage --------------------- */
export type { ObjectStorage, ObjectStorageConfig } from "./storage";
export { createObjectStore, keyForDigest, objectStorageConfigFromEnv } from "./storage";
