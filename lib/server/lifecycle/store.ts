/* ============================================================
   DarkPrint backend — lifecycle: the reads no barrel publishes
   Both published `plan*` verbs are keyed by an id — a `bundleId`
   and an `accountId` — and no barrel in the tree answers either.
   `@/lib/server/archive` publishes exactly one bundle reader,
   `getBundle(db, ownerId, slug)`, which is keyed the other way
   round; `@/lib/server/accounts` publishes `getAccount`, which
   asks `can(actor, "read", …)` and is a record rather than a row.

   So this file goes straight to `@/lib/db`, on the ruling
   `lib/server/lineage/store.ts` records and cites twice: D-90-06
   for `lib/server/export/lookup.ts` and D-80-04 for T080.
   `lib/server/registry`, `lib/server/saves` and
   `lib/server/profiles` all read this table the same way.

   `toBundleRecord` below is a THIRD copy of
   `archive/bundle.ts`'s, after `lineage/store.ts`'s second, and
   it is reported as a divergence rather than hidden — exactly as
   that file reported the second. All three go away the day
   `@/lib/server/archive` publishes a reader keyed by id.
   ============================================================ */

import { and, eq, inArray, sql } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { BundleRecord } from "@/lib/server/archive";
import { LifecycleStoreError } from "./errors";

/**
 * Postgres casts a `uuid` parameter before it compares it, so a malformed id raises 22P02
 * on the statement rather than matching nothing — and a `DrizzleQueryError` opens with the
 * whole SELECT and every bound parameter (D-13). `lineage/store.ts` and
 * `export/lookup.ts` both measured the same guard on this same column: delete it and a
 * malformed `bundleId` stops answering "not there" and starts throwing the statement.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The three lineage columns are written and read together — `createBundle` writes all three
 * or none — so a row with some of them set is not a partial lineage to repair but a row no
 * published writer produced. Absent, like `toBundleRecord`'s, rather than half a pointer.
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
 * Runs one read and seals whatever it rejects with.
 *
 * Unconditional, and `registry/store.ts` records the argument: the set of faults that can
 * carry the statement is not enumerable from here — drizzle, `pg`, the socket, a driver
 * version that has not shipped — so a classifier that is wrong fails OPEN on exactly the
 * clause the wrapper exists for. There is no decision inside `work` to let through.
 */
export async function withLifecycleStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof LifecycleStoreError) throw cause;
    throw new LifecycleStoreError(operation, cause);
  }
}

/** The bundle a `bundleId` names, or `undefined` — including for an id that is not a uuid. */
export async function bundleById(
  db: Db,
  operation: string,
  bundleId: string,
): Promise<BundleRecord | undefined> {
  if (typeof bundleId !== "string" || !UUID.test(bundleId)) return undefined;
  return await withLifecycleStore(operation, async () => {
    const [row] = await db.select().from(schema.bundle).where(eq(schema.bundle.id, bundleId));
    return row === undefined ? undefined : toBundleRecord(row);
  });
}

/**
 * Whether `ownerId` already holds a bundle at `slug` — AC3's `collides`, asked against the
 * same `(owner_id, slug)` pair `bundle_owner_slug_key` is declared on (B-09).
 *
 * A read, never the arbiter. `transferBundle` re-asks and the UNIQUE INDEX is what actually
 * refuses under concurrency: this read and the update are not one statement, so two
 * transfers racing into one free slug can both pass here. `forkBundle` records the identical
 * split for the identical reason, and its `withLineageErrors` keeps a 409 arm for the loser.
 */
export async function slugTakenBy(
  db: Db,
  operation: string,
  ownerId: string,
  slug: string,
): Promise<boolean> {
  return await withLifecycleStore(operation, async () => {
    const rows = await db
      .select({ id: schema.bundle.id })
      .from(schema.bundle)
      .where(and(eq(schema.bundle.ownerId, ownerId), eq(schema.bundle.slug, slug)));
    return rows.length > 0;
  });
}

/**
 * D-120-01's B1 mark. `deleteAccount` scrubs `github_id` to `deleted:<uuid>` — which keeps
 * the column `NOT NULL` and `account_github_id_key` unique, needs no schema change, and
 * closes the sign-in door: `upsertFromGitHub` is keyed on `github_id`
 * (`accounts/github.ts`), so an un-scrubbed id means the same GitHub user signing in again
 * gets the same `account.id` back and the deletion is undone.
 *
 * A real GitHub id is a decimal string, so no live identity can collide with this prefix.
 */
export const TOMBSTONE_PREFIX = "deleted:";

/**
 * What the two deletion verbs and the tombstone check need off an `account` row.
 *
 * `handle` comes back as stored, `null` included (D-120-08): an account that never chose one
 * has no reservation to release and AC4 is vacuous for it.
 */
export interface AccountRow {
  id: string;
  handle: string | null;
  githubId: string;
}

/** The account an id names, or `undefined` — including for an id that is not a uuid. */
export async function accountById(
  db: Db,
  operation: string,
  accountId: string,
): Promise<AccountRow | undefined> {
  if (typeof accountId !== "string" || !UUID.test(accountId)) return undefined;
  return await withLifecycleStore(operation, async () => {
    const [row] = await db
      .select({ id: schema.account.id, handle: schema.account.handle, githubId: schema.account.githubId })
      .from(schema.account)
      .where(eq(schema.account.id, accountId));
    return row;
  });
}

/**
 * D-120-01's B2, second half: a transfer INTO a tombstoned account is refused.
 *
 * The tombstone keeps its `handle` — B-05 puts it inside every published card's own bytes, so
 * the author line has to survive — which is exactly what leaves `resolveOwner` answering for
 * a grave. This is the check that closes the consequence keeping the handle opened.
 */
export function isTombstone(row: AccountRow): boolean {
  return row.githubId.startsWith(TOMBSTONE_PREFIX);
}

/**
 * D-120-11's predicate, as one SQL clause used by both the plan and the destruction so the
 * two cannot disagree about what dies.
 *
 * A card survives when **some surviving published release pins it**, whatever its own
 * `visibility` column says: the product's own writer produces a public release pinning a
 * private card by byte-reuse at publish, and that card's bytes are already public through
 * that release, so AC5 beats AC6 for it. "Surviving published" is `bundle.visibility =
 * 'public'` — no public bundle is deleted by this task (AC5 keeps the account's own, and
 * other accounts' are untouched), so every public bundle's releases survive by construction.
 *
 * The ref grain is `id@version`, which is what `release.card_refs` stores — never the bare
 * id. A card at a version nothing pins is unreached even when three releases pin its id at
 * other versions, and T080's blind author already paid for that distinction once.
 */
const PINNED_BY_A_SURVIVING_PUBLISHED_RELEASE = sql`exists (
  select 1
  from ${schema.release} r
  join ${schema.bundle} b on b.id = r.bundle_id
  where b.visibility = 'public'
    and (${schema.cardVersion.cardId} || '@' || ${schema.cardVersion.version}) = any(r.card_refs)
)`;

/** The four figures `DeletionPlan` reports, which PARTITION the account's holdings (D-120-09). */
export interface HoldingCounts {
  privateBundles: number;
  privateCards: number;
  publishedBundles: number;
  publishedCards: number;
}

/**
 * Count what a deletion would destroy and what it would keep, in two statements.
 *
 * **`privateCards` is the CONJUNCTION** — private *and* reached by no surviving published
 * release — because D-120-11's closing sentence binds AC6 to *"private content no surviving
 * published release reaches"*. Its headline reads *not over `visibility`*, and that is
 * satisfied: visibility alone no longer decides, the pin does too. Reported to the
 * orchestrator as a two-reading sentence rather than settled here silently.
 *
 * The two card figures are a partition by construction — `publishedCards` is every other card
 * this account owns — so the four numbers cannot sum to anything but the account's holdings,
 * which is the property D-120-09 bought.
 */
export async function countHoldings(
  db: Db,
  operation: string,
  accountId: string,
): Promise<HoldingCounts> {
  return await withLifecycleStore(operation, async () => {
    const bundles = await db
      .select({ visibility: schema.bundle.visibility })
      .from(schema.bundle)
      .where(eq(schema.bundle.ownerId, accountId));

    const cards = await db
      .select({ doomed: sql<boolean>`(${schema.cardVersion.visibility} = 'private' and not ${PINNED_BY_A_SURVIVING_PUBLISHED_RELEASE})` })
      .from(schema.cardVersion)
      .where(eq(schema.cardVersion.ownerId, accountId));

    const privateBundles = bundles.filter((row) => row.visibility === "private").length;
    const privateCards = cards.filter((row) => row.doomed).length;
    return {
      privateBundles,
      privateCards,
      publishedBundles: bundles.length - privateBundles,
      publishedCards: cards.length - privateCards,
    };
  });
}

/** The account's private bundles — the set AC6 destroys. */
export async function privateBundlesOf(
  db: Db,
  accountId: string,
): Promise<{ id: string; slug: string }[]> {
  return await withLifecycleStore("deleteAccount", async () =>
    db
      .select({ id: schema.bundle.id, slug: schema.bundle.slug })
      .from(schema.bundle)
      .where(and(eq(schema.bundle.ownerId, accountId), eq(schema.bundle.visibility, "private"))),
  );
}

/**
 * The distinct digests carried by the releases of `bundleIds`, read BEFORE those rows go.
 *
 * Distinct, because one bundle can hold several releases at one digest and the orphan
 * question is asked per digest, not per release.
 */
export async function releasesOfBundles(db: Db, bundleIds: readonly string[]): Promise<string[]> {
  if (bundleIds.length === 0) return [];
  return await withLifecycleStore("deleteAccount", async () => {
    const rows = await db
      .select({ digest: schema.release.digest })
      .from(schema.release)
      .where(inArray(schema.release.bundleId, [...bundleIds]));
    return [...new Set(rows.map((row) => row.digest))];
  });
}

/**
 * Which of `digests` some release STILL carries, asked across ALL bundles (D-120-12's G).
 *
 * `release.digest` is deliberately not unique — an unmodified T110 fork republishes the
 * identical digest (D-05-01, measured `sha256:0400893b…` for both sides) — so a digest is
 * orphaned only when no release anywhere holds it any more. Scoping this to the deleted
 * account's own bundles would delete a stranger's fork's run reports.
 */
export async function survivingDigests(
  db: Db,
  digests: readonly string[],
): Promise<Set<string>> {
  if (digests.length === 0) return new Set();
  return await withLifecycleStore("deleteAccount", async () => {
    const rows = await db
      .select({ digest: schema.release.digest })
      .from(schema.release)
      .where(inArray(schema.release.digest, [...digests]));
    return new Set(rows.map((row) => row.digest));
  });
}

/**
 * The card versions AC6 destroys: D-120-11's set, private AND reached by no surviving
 * published release.
 *
 * The same clause `countHoldings` counts with, so `planDeletion`'s `privateCards` is a
 * prediction of exactly this list rather than a second opinion about it.
 */
export async function doomedCardIds(db: Db, accountId: string): Promise<string[]> {
  return await withLifecycleStore("deleteAccount", async () => {
    const rows = await db
      .select({ id: schema.cardVersion.id })
      .from(schema.cardVersion)
      .where(
        and(
          eq(schema.cardVersion.ownerId, accountId),
          eq(schema.cardVersion.visibility, "private"),
          sql`not ${PINNED_BY_A_SURVIVING_PUBLISHED_RELEASE}`,
        ),
      );
    return rows.map((row) => row.id);
  });
}
