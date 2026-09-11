/* ============================================================
   DarkPrint backend — planDeletion / deleteAccount
   AC4-AC6, and the one irreversible operation in the registry.

   ── the account ROW SURVIVES, and that is structural rather than
      a preference (D-120-01) ──
   Twelve foreign keys reference `account.id` and every one is `ON
   DELETE no action`; `bundle.owner_id` and `card_version.owner_id`
   are `NOT NULL`; AC5 forbids deleting published rows. So
   `DELETE FROM account` is refused by the database for any
   account that ever published, and a stranger's fork can point at
   it through `bundle.lineage_owner_id` besides. Deletion here is a
   TOMBSTONE, which is also what B-18 and T170 already made it
   everywhere else on this site.

   ── what the tombstone holds, ruled per field (D-120-01) ──
   `github_id` is SCRUBBED, and that is the field that makes the
   deletion real: `upsertFromGitHub` is keyed on it, so an
   unscrubbed id means the same GitHub user signing in again gets
   the same `account.id` back and the whole thing is undone.
   Scrubbing it is also what makes AC4 true literally (D-120-02):
   `allocateHandle`'s D-70-06 exception lets a handle's ORIGINAL
   holder reclaim it after release, so *"cannot be claimed"* holds
   only once the ghost can no longer sign in.
   `handle` STAYS — B-05 puts it inside every published card's own
   bytes, so the author line has to survive — and a transfer INTO a
   tombstone is refused instead (`transfer.ts`).
   The profile fields are SCRUBBED. An account that keeps its email
   is not deleted.

   ── the nine account-reaching tables, ruled per table (D-120-13)
      ──
   `save` deleted, `ballot` deleted, `note` TOMBSTONED through
   T170's own verb, `note_vote` deleted, `target_actor` stays and
   counters are untouched (D-120-05), `run_report` kept except
   D-120-04's orphans, `api_key` revoked (D-120-10), `audit`
   retained because B-14 is permanent, `bundle.lineage_owner_id`
   left dangling by the schema's own design. The two embedding
   tables cascade themselves.

   ── this module writes no other task's table directly ──
   The reports go through T180's `forgetReportsAt`, the keys
   through T230's `revokeKeysFor`, the notes through T170's
   `deleteNote`, the reservation through T070's `releaseHandle`.
   Four verbs, four authors. What is deleted here directly is
   `save`, `ballot`, `note_vote`, `release` and `bundle` — rows
   whose destruction no other module publishes a verb for.
   ============================================================ */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { NotAccountOwnerError } from "@/lib/server/accounts";
import { LimitsStoreError, revokeKeysFor } from "@/lib/server/limits";
import { InvalidNameError, NamingStoreError, releaseHandle } from "@/lib/server/naming";
import { deleteNote, NoteStoreError } from "@/lib/server/notes";
import { can, type Actor } from "@/lib/server/policy";
import { forgetReportsAt, RunReportStoreError } from "@/lib/server/runs";
import { LifecycleStoreError, refusedAsNotOwner, refusedNoSuchAccount } from "./errors";
import {
  accountById,
  countHoldings,
  doomedCardIds,
  privateBundlesOf,
  releasesOfBundles,
  survivingDigests,
  TOMBSTONE_PREFIX,
} from "./store";
import type { DeletionPlan } from "./types";

/**
 * Authorization, asked before any row is read.
 *
 * **The order is the privacy property.** `can` is pure, so a stranger is refused without a
 * `SELECT` ever running — which is what keeps `no-such-account` off a fishing caller's path
 * entirely. `canOnAccount` grants `delete` to the account itself and to a break-glass
 * operator and to nobody else, so this one call is the whole of AC's ownership half and there
 * is no second rule here to drift from it.
 */
function authorize(actor: Actor, operation: string, accountId: string): void {
  if (!can(actor, "delete", { kind: "account", accountId })) throw refusedAsNotOwner(operation);
}

/**
 * What a deletion would destroy and what it would keep, without destroying any of it.
 *
 * **Authorizes exactly as `deleteAccount` does** (D-120-12 K): a plan is not a lesser
 * operation, and a stranger's plan would be a count of somebody else's private holdings.
 *
 * The four figures partition by OUTCOME rather than by column (D-120-15's R clause): a
 * private card that a surviving published release pins is counted in `publishedCards`,
 * because it is a card this deletion keeps. `privateBundles` and `privateCards` are exactly
 * the set `deleteAccount` destroys, computed by the same predicate in the same file, so a
 * plan cannot disagree with the verb it describes.
 */
export async function planDeletion(db: Db, actor: Actor, accountId: string): Promise<DeletionPlan> {
  authorize(actor, "planDeletion", accountId);

  const row = await accountById(db, "planDeletion", accountId);
  if (row === undefined) throw refusedNoSuchAccount("planDeletion", accountId);

  const counts = await countHoldings(db, "planDeletion", accountId);
  return { accountId: row.id, handle: row.handle, ...counts };
}

/**
 * Destroy the account's private half, keep everything published, and tombstone the row.
 *
 * Throws `DeletionRefusedError`. One transaction: a deletion that half-ran would leave a
 * registry nobody can reason about, and this is the operation with no undo.
 *
 * **The order inside is load-bearing in one place.** Notes are tombstoned FIRST, before any
 * bundle row disappears, because `deleteNote` resolves the note's parent target and refuses a
 * note whose parent it cannot reach (`notes/write.ts`'s `reachable`) — a note under a
 * blueprint this transaction is about to delete would stop being reachable halfway through.
 */
export async function deleteAccount(db: Db, actor: Actor, accountId: string): Promise<void> {
  authorize(actor, "deleteAccount", accountId);

  const row = await accountById(db, "deleteAccount", accountId);
  if (row === undefined) throw refusedNoSuchAccount("deleteAccount", accountId);

  try {
    await db.transaction(async (tx) => {
      /* T170's verb, one note at a time, because that is where B-18's tombstone rule has its
         single author: the row survives, `body` is emptied, `deleted_at` is stamped and
         `target.note_count` is decremented in step. A bulk `UPDATE note SET deleted_at` here
         would be a second implementation of a rule T170 owns and would silently skip the
         counter, which T150 reads and is forbidden from recomputing. */
      const notes = await tx
        .select({ id: schema.note.id })
        .from(schema.note)
        .where(and(eq(schema.note.accountId, accountId), isNull(schema.note.deletedAt)));
      for (const note of notes) await deleteNote(tx, actor, note.id);

      /* D-120-13, deleted outright: a vote, a bookmark and a ballot are all the ghost's own
         participation, and a ghost must stop weighting community signals. `target_actor`
         (stars) is the exception and STAYS per D-120-05 — the counters it feeds are public
         history rather than the ghost's private data, and nothing recomputes them. */
      await tx.delete(schema.noteVote).where(eq(schema.noteVote.accountId, accountId));
      await tx.delete(schema.save).where(eq(schema.save.accountId, accountId));
      await tx.delete(schema.ballot).where(eq(schema.ballot.accountId, accountId));

      const doomed = await privateBundlesOf(tx, accountId);
      const bundleIds = doomed.map((bundle) => bundle.id);
      const digests = await releasesOfBundles(tx, bundleIds);

      if (bundleIds.length > 0) {
        /* FK-forced and in this order: `ballot.bundle_id` and `release.bundle_id` both
           reference `bundle` with `ON DELETE no action`, so the children go first. These are
           OTHER accounts' ballots on the ghost's private bundles — reachable, because
           `castBallot` gates on `can(actor, "read", …)` and an owner passes that on their own
           private bundle, so the ghost can have balloted its own. Nothing else foreign-keys
           `bundle`; `target`, `target_actor`, `save` and `note` key it by TEXT `ref_id` with
           no constraint, and D-120-05 rules those rows left alone. */
        await tx.delete(schema.ballot).where(inArray(schema.ballot.bundleId, bundleIds));
        await tx.delete(schema.release).where(inArray(schema.release.bundleId, bundleIds));
        await tx.delete(schema.bundle).where(inArray(schema.bundle.id, bundleIds));
      }

      /* D-120-04, and the quantifier is D-120-12's G: across ALL bundles, not this account's.
         `release.digest` is deliberately not unique — an unmodified T110 fork republishes the
         identical digest (D-05-01) — so a digest is orphaned only when NO release anywhere
         still carries it. Asked after the deletes, against the tree as it now stands, so the
         answer is about the state this transaction is committing rather than the one it
         found. The trigger that guards this column fires on INSERT and UPDATE only, which is
         exactly why the check has to live here. */
      const surviving = await survivingDigests(tx, digests);
      for (const digest of digests) {
        if (!surviving.has(digest)) await forgetReportsAt(tx, digest);
      }

      /* D-120-11's set: private AND reached by no surviving published release. A private card
         a public release pins is NOT destroyed — its bytes are already public through that
         release, and AC5 beats AC6 for it. `card_version_embedding` cascades itself. */
      const cardIds = await doomedCardIds(tx, accountId);
      if (cardIds.length > 0) {
        await tx.delete(schema.cardVersion).where(inArray(schema.cardVersion.id, cardIds));
      }

      /* D-120-10. `resolveKey` never joins `account`, so an un-revoked key of a ghost keeps
         authenticating at the key tier forever. T230's own verb, by account id — the per-key
         `revokeKey` binds its WHERE to the CALLER's `accountId`, so an operator deleting
         somebody else's account would silently revoke nothing through it. */
      await revokeKeysFor(tx, accountId);

      /* AC4, and this task implements none of it: T070's `releaseHandle` updates the
         reservation and the row is what keeps the name occupied. **Skipped when the account
         holds no handle** (D-120-08) — there is no reservation to release, and `""` is the one
         value that makes this call throw `InvalidNameError`, another module's class, on a path
         this section publishes no refusal for. */
      if (row.handle !== null) await releaseHandle(tx, accountId, row.handle);

      /* The tombstone itself, last, so a failure anywhere above leaves an account that is
         still whole rather than one whose identity is gone and whose content is not.
         `github_id` takes the account's OWN id as the uuid: it satisfies D-120-01's
         `deleted:<uuid>` form, it is unique because the primary key is, and it needs no
         randomness — which keeps this module deterministic and makes a re-run idempotent
         rather than minting a second grave. A real GitHub id is a decimal string, so no live
         identity can collide with the prefix.

         `handle` is NOT cleared (B2). `validator`, `validator_weight` and `default_visibility`
         are not touched either: they are registry facts about content that survives, not
         personal data, and blanking them would restate a published card's standing. */
      await tx
        .update(schema.account)
        .set({
          githubId: `${TOMBSTONE_PREFIX}${accountId}`,
          githubLogin: "",
          displayName: null,
          email: null,
          bio: null,
          avatarHue: null,
          notificationPreferences: {},
          updatedAt: new Date(),
        })
        .where(eq(schema.account.id, accountId));
    });
  } catch (err) {
    /* **Four other modules' rejections pass through unaltered, and that is D-50-08**: each of
       `deleteNote`, `releaseHandle`, `forgetReportsAt` and `revokeKeysFor` seals its own
       faults behind its own store wrapper, and re-rendering one under this module's name
       would publish another author's rejection as ours — and would RELABEL it, replacing the
       operation that actually failed with whichever wrapper happened to be outermost
       (`runs/store.ts`'s own warning about a sanitizer applied twice).

       Enumerated POSITIVELY, not by excluding a shape. The list covers exactly what those
       four verbs can raise, so a class outside it is sealed rather than let out — the safe
       direction, since the alternative fails OPEN on precisely the driver fault D-13 exists
       for. A fifth class from one of those modules would be MISLABELLED as a store fault
       here; that is a wrong operation name in a message, never a leaked statement. */
    if (
      err instanceof NoteStoreError ||
      err instanceof NotAccountOwnerError ||
      err instanceof NamingStoreError ||
      err instanceof InvalidNameError ||
      err instanceof RunReportStoreError ||
      err instanceof LimitsStoreError
    ) {
      throw err;
    }
    throw new LifecycleStoreError("deleteAccount", err);
  }
}
