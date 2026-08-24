/* ============================================================
   DarkPrint backend — planTransfer / transferBundle
   AC1-AC3. A transfer moves a bundle into another handle's
   namespace and changes nothing else about it.

   ── this module composes and owns no decision ──
   The owner behind a handle is T050's `resolveOwner`; every
   authorization answer is T060's `can`; the collision is
   `bundle_owner_slug_key`'s, declared in T005's schema and
   derived by name rather than restated (D-14). Nothing here
   compares a version, computes a digest or decides a visibility
   rule. `forkBundle` is the sibling that composes the same three
   and its header says the same thing.

   ── AC1 is a NON-EFFECT and it holds by construction ──
   `author` is outside `cardDigest` and the manifest is outside
   `bundleDigest` (`lib/core/hash/digest.ts`), and this file
   writes neither: it updates `bundle.owner_id` and nothing else.
   No `release` row is read, rewritten or re-digested by a
   transfer. D-120-06 settles what "resolves identically" means —
   the same bytes and the same digest; the ADDRESS necessarily
   changes with the namespace under B-09, and no redirect is owed
   by this task.

   ── what moves and what does not (D-120-12) ──
   I: `bundle.owner_id` ONLY. `card_version.owner_id` never moves,
   because a card the old owner's OTHER bundles still pin cannot
   silently change hands. H: fork lineage pointers ARE repointed,
   in the same transaction — the upstream still exists, at a new
   address, and a pointer that still resolved to the old owner
   would name a bundle that is no longer there. (A DELETION leaves
   them dangling instead, which is the schema's own stated design:
   `schema.ts:146-158` and `archive/bundle.ts`'s header both say a
   lineage pointer is deliberately not a foreign key.) J: a
   self-transfer is a no-op SUCCESS, so a retried request is
   idempotent rather than a 409.
   ============================================================ */

import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { resolveOwner } from "@/lib/server/accounts";
import type { BundleRecord } from "@/lib/server/archive";
import { can, type Actor } from "@/lib/server/policy";
import { isSlugCollision } from "./constraint";
import {
  LifecycleStoreError,
  refusedForSlugCollision,
  refusedNoSuchBundle,
  refusedNoSuchHandle,
  refusedNotBundleOwner,
  refusedTransferNeedsAccount,
  TransferRefusedError,
} from "./errors";
import { accountById, bundleById, isTombstone, slugTakenBy } from "./store";
import type { TransferPlan } from "./types";

/**
 * The account id the actor OFFERS, read through the same `Object.hasOwn` gate `can` uses.
 *
 * A field that exists only on a prototype reads as absent rather than as whatever the
 * prototype supplies (T060's ruling, 2026-08-14). This function never decides who somebody
 * is — `can` does that below, against the row — it only decides whether there is an id to
 * put in a `NOT NULL` column at all.
 */
function candidateAccountId(actor: Actor): string | undefined {
  if (typeof actor !== "object" || actor === null || !Object.hasOwn(actor, "accountId")) return undefined;
  const offered = (actor as { accountId?: unknown }).accountId;
  return typeof offered === "string" && offered.length > 0 ? offered : undefined;
}

/**
 * Everything both verbs decide before either of them writes, in the one order B-03 allows.
 *
 * **The order is the privacy property, not a style.** Read grant first, so a bundle the
 * caller may not read is `no-such-bundle` and never `not-owner` — a distinct refusal there
 * would confirm which bundle ids exist to anybody who tried one. Ownership next, so the
 * recipient handle is never resolved on behalf of a caller who has no business transferring
 * this bundle. The recipient last, so `no-such-handle` is reachable only by somebody who
 * already holds the thing being moved.
 */
async function resolve(
  db: Db,
  actor: Actor,
  operation: string,
  bundleId: string,
  toHandle: string,
): Promise<{ bundle: BundleRecord; toAccountId: string }> {
  const bundle = await bundleById(db, operation, bundleId);
  if (bundle === undefined) throw refusedNoSuchBundle(operation, bundleId);

  const resource = { kind: "bundle" as const, ownerId: bundle.ownerId, visibility: bundle.visibility };
  if (!can(actor, "read", resource)) throw refusedNoSuchBundle(operation, bundleId);

  /* D-110-10's case, arriving here unchanged. `can(anonymous, "read", publicBundle)` is
     `true`, so the read grant above lets an anonymous caller through — and `bundle.owner_id`
     is `NOT NULL`, so there is no id to move it to. Refused BEFORE any write, in D-180-03's
     construction, rather than letting the column raise a constraint violation a caller would
     read as a store fault. */
  if (candidateAccountId(actor) === undefined) throw refusedTransferNeedsAccount(operation);
  if (!can(actor, "transfer", resource)) throw refusedNotBundleOwner(operation);

  /* `resolveOwner` is CONSUMED rather than rejoined here. T050 publishes it as D-100-01's
     narrow amendment precisely because two other places in the tree had already spelled the
     handle-to-id join by hand, and a third copy is the defect this run charges most. */
  const recipient = await resolveOwner(db, toHandle);
  if (recipient === undefined) throw refusedNoSuchHandle(operation, toHandle);

  /* D-120-01's B2. The tombstone KEEPS its handle — B-05 puts it inside every published
     card's own bytes, so the author line has to survive — which is what leaves `resolveOwner`
     answering for a grave. Same sentence as a handle nobody ever held, for B-03's reason: a
     distinct refusal would publish which accounts are deleted. */
  const recipientRow = await accountById(db, operation, recipient.accountId);
  if (recipientRow === undefined || isTombstone(recipientRow)) {
    throw refusedNoSuchHandle(operation, toHandle);
  }

  return { bundle, toAccountId: recipient.accountId };
}

/**
 * What a transfer would do, without doing any of it.
 *
 * AC3 requires refusing "before anything moves", and a criterion about ordering needs a
 * surface that can be observed without performing the act — so `collides` is a VALUE here and
 * a rejection over in `transferBundle`. A test can then assert the refusal *and* that nothing
 * moved, instead of inferring atomicity from an error.
 *
 * **Authorizes exactly as `transferBundle` does** (D-120-12 K). A plan is not a lesser
 * operation: a stranger's plan would be a report on somebody else's namespace, and every
 * refusal it can raise is one the verb raises too, under this operation's own name.
 *
 * **A self-transfer plans as `collides: false`** even though the account demonstrably holds a
 * bundle at that slug — its own, the one being moved. Reporting `true` there would predict a
 * refusal that D-120-12's J rules a no-op success, and a plan that disagrees with its verb is
 * worse than no plan.
 */
export async function planTransfer(
  db: Db,
  actor: Actor,
  bundleId: string,
  toHandle: string,
): Promise<TransferPlan> {
  const { bundle, toAccountId } = await resolve(db, actor, "planTransfer", bundleId, toHandle);
  const collides =
    toAccountId === bundle.ownerId
      ? false
      : await slugTakenBy(db, "planTransfer", toAccountId, bundle.slug);

  return {
    bundleId: bundle.id,
    fromAccountId: bundle.ownerId,
    toAccountId,
    slug: bundle.slug,
    collides,
  };
}

/**
 * Move `bundleId` into `toHandle`'s namespace.
 *
 * Throws `TransferRefusedError`. AC2 follows from the one column this writes: `can` reads
 * `ownerId` off the row, so the old owner loses write access and the new owner gains it at
 * the same instant, with no second rule to keep in step.
 *
 * **The collision is re-asked here and the UNIQUE INDEX is still the arbiter.** The read and
 * the update are not one statement, so two transfers racing into one free slug both pass the
 * check and `bundle_owner_slug_key` settles it — which is where it should be settled, since
 * no reader can be atomic with a later write. The 23505 is caught and rendered as the same
 * published sentence rather than as a constraint name, so the loser of a race and the caller
 * who asked for a taken slug get one wording. The constraint is matched BY NAME derived from
 * the schema (D-14), never by a literal beside it: a rename in `schema.ts` would otherwise
 * make the typed refusal silently stop arriving, with nothing red.
 */
export async function transferBundle(
  db: Db,
  actor: Actor,
  bundleId: string,
  toHandle: string,
): Promise<BundleRecord> {
  const { bundle, toAccountId } = await resolve(db, actor, "transferBundle", bundleId, toHandle);

  /* D-120-12's J. Idempotent for retries, and it writes NOTHING — not even `updated_at`,
     which would make a no-op observable as a change to every reader of that column. */
  if (toAccountId === bundle.ownerId) return bundle;

  if (await slugTakenBy(db, "transferBundle", toAccountId, bundle.slug)) {
    throw refusedForSlugCollision(toHandle, bundle.slug);
  }

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .update(schema.bundle)
        .set({ ownerId: toAccountId, updatedAt: new Date() })
        .where(and(eq(schema.bundle.id, bundle.id), eq(schema.bundle.ownerId, bundle.ownerId)))
        .returning();

      /* The row was read outside this transaction, so another writer may have moved it in
         between. An empty `returning` is that, and it is `no-such-bundle` rather than a store
         fault: the bundle this caller asked about is no longer where it said it was. */
      if (row === undefined) throw refusedNoSuchBundle("transferBundle", bundleId);

      /* D-120-12's H. Every fork pointing at `(oldOwner, slug)` is repointed to `(newOwner,
         slug)` in the SAME transaction — the upstream still exists, at a new address, and a
         pointer left behind would name a bundle nobody holds. Keyed on owner and slug and not
         on the version taken, because `lineage.version` records which release was copied
         rather than which bundle it came from; `(owner, slug)` is unique on this table, so the
         pair addresses one upstream even though the columns are plain values.

         `lineage_slug` is deliberately NOT touched: a transfer does not rename the bundle. */
      await tx
        .update(schema.bundle)
        .set({ lineageOwnerId: toAccountId })
        .where(
          and(
            eq(schema.bundle.lineageOwnerId, bundle.ownerId),
            eq(schema.bundle.lineageSlug, bundle.slug),
          ),
        );

      return toRecord(row);
    });
  } catch (err) {
    /* Ordered, and the order is what keeps each refusal one sentence with one author. The
       module's own typed refusal leaves untouched; the race loser becomes the SAME published
       collision sentence the sequential check raises; everything else is sealed, because the
       set of faults that can carry a statement is not enumerable from here and a classifier
       that is wrong fails OPEN on exactly the clause D-13 exists for. */
    if (err instanceof TransferRefusedError) throw err;
    if (isSlugCollision(err)) throw refusedForSlugCollision(toHandle, bundle.slug);
    throw new LifecycleStoreError("transferBundle", err);
  }
}

/** The projection `archive/bundle.ts` publishes, applied to the row this file just wrote. */
function toRecord(row: typeof schema.bundle.$inferSelect): BundleRecord {
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
