/* ============================================================
   DarkPrint backend — lineage: the two reads no barrel publishes
   `driftOf` and `forksOf` are both keyed by a bundle id, and
   `@/lib/server/archive` publishes exactly one bundle reader,
   `getBundle(db, ownerId, slug)`. `lib/server/archive/**` is
   Forbidden to this task, so neither question can be asked
   through it, and both go straight to `@/lib/db` on the same
   ruling `lib/server/export/lookup.ts` records as D-90-06 and
   T080 got as D-80-04. `lib/server/registry`, `lib/server/saves`
   and `lib/server/profiles` all read this table the same way.

   `bundleById` also exists in `lib/server/export/lookup.ts` and
   is NOT reachable: it is not on that module's barrel, and it
   returns `BundleIdentity`, which carries no `lineage`,
   `createdAt` or `updatedAt` — so it cannot answer either of this
   module's questions, and `forksOf` publishes
   `readonly BundleRecord[]`. The mapping below is therefore a
   second copy of `archive/bundle.ts`'s `toBundleRecord`, reported
   as a divergence rather than hidden. It goes away the day
   `@/lib/server/archive` publishes a reader keyed by id.
   ============================================================ */

import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { BundleRecord } from "@/lib/server/archive";
import { LineageStoreError } from "./errors";

/**
 * Postgres casts a `uuid` parameter before it compares it, so a malformed id raises 22P02
 * on the statement rather than matching nothing — and a `DrizzleQueryError` opens with the
 * whole SELECT and every bound parameter (D-13). `lookup.ts` measured the same guard on the
 * same column: delete it and a malformed `bundleId` stops answering "not there" and starts
 * throwing the statement.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The three lineage columns are written and read together — `createBundle` writes all three
 * or none — so a row with some of them set is not a partial lineage to repair but a row no
 * published writer produced. Absent, like `toBundleRecord`'s, rather than half a pointer:
 * lineage renders as one sentence naming an owner, a slug and a version, and two of the
 * three would render a pointer to nothing.
 */
function toBundleRecord(row: typeof schema.bundle.$inferSelect): BundleRecord {
  const record: BundleRecord = {
    id: row.id,
    ownerId: row.ownerId,
    slug: row.slug,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (row.lineageOwnerId !== null && row.lineageSlug !== null && row.lineageVersion !== null) {
    record.lineage = { ownerId: row.lineageOwnerId, slug: row.lineageSlug, version: row.lineageVersion };
  }
  return record;
}

/**
 * Runs one of the two queries below and seals whatever it rejects with.
 *
 * Unconditional, and `registry/store.ts` records the argument: the set of faults that can
 * carry the statement is not enumerable from here — drizzle, `pg`, the socket, a driver
 * version that has not shipped — so a classifier that is wrong fails OPEN on exactly the
 * clause the wrapper exists for. There is no decision inside either `work` to let through:
 * both are a single `select` and a pure projection, which is what makes converting
 * everything affordable here and not around a whole verb.
 */
async function withLineageStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof LineageStoreError) throw cause;
    throw new LineageStoreError(operation, cause);
  }
}

/** The bundle a `bundleId` names, or `undefined` — including for an id that is not a uuid. */
export async function bundleById(db: Db, bundleId: string): Promise<BundleRecord | undefined> {
  if (typeof bundleId !== "string" || !UUID.test(bundleId)) return undefined;
  return await withLineageStore("bundleById", async () => {
    const [row] = await db.select().from(schema.bundle).where(eq(schema.bundle.id, bundleId));
    return row === undefined ? undefined : toBundleRecord(row);
  });
}

/**
 * Every bundle whose lineage points at `(ownerId, slug)`, unfiltered.
 *
 * By owner and slug and NOT by the version taken: a fork of any release is a fork of the
 * bundle, and `lineage.version` records which release it took rather than which bundle it
 * came from. `(owner, slug)` is unique on this table (`bundle_owner_slug_key`), so the pair
 * addresses one upstream even though the columns are plain values rather than a foreign key.
 *
 * **Unfiltered on purpose, and the filter is the caller's.** AC2 turns on the count and the
 * list coming from the SAME query, so this returns the population and `forksOf` applies the
 * public-rows-only rule (Q1) once. A `countForksOf` beside it that filtered separately is
 * exactly the shape the criterion exists to refuse.
 */
export async function forkRowsOf(db: Db, ownerId: string, slug: string): Promise<BundleRecord[]> {
  return await withLineageStore("forksOf", async () => {
    const rows = await db
      .select()
      .from(schema.bundle)
      .where(and(eq(schema.bundle.lineageOwnerId, ownerId), eq(schema.bundle.lineageSlug, slug)))
      .orderBy(schema.bundle.createdAt);
    return rows.map(toBundleRecord);
  });
}
