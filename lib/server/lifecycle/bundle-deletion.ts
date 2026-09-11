/* ============================================================
   DarkPrint backend — deleting ONE bundle, owner-instructed (2026-08-25)

   `deleteAccount` destroys an account's private bundles wholesale; this is the same act
   scoped to a single bundle the caller still owns, reached from the trash control on the
   owner's shelf. The boundary it must not cross is D-120's ratified sentence, rendered on
   the danger zone itself: everything you PUBLISHED stays. So a PUBLIC bundle carrying at
   least one release refuses — its bytes are the world's to re-read and other people's
   pins may name them — while a draft (no release) and a private bundle (never readable to
   anyone else) destroy completely, exactly as they would under account deletion.

   ── why the note cascade is a bulk delete where deleteAccount tombstones ──
   Account deletion tombstones notes one at a time through `deleteNote` because the
   PARENT survives: `target.note_count` lives on and T150 reads it, so the count and the
   rows must move in step. Here the parent dies in the same transaction — the `target`
   row goes with the bundle — so there is no surviving counter for a tombstone protocol
   to keep honest, and the rows about a thing that no longer exists go with it.

   ── what deliberately survives ──
   A fork's `lineage_*` columns name this bundle by plain text with no constraint, the
   same way GitHub leaves forks standing when an upstream is deleted: the fork's own
   bytes are its own, and its lineage line becomes a name that resolves to nothing.
   ============================================================ */

import { and, eq, inArray } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { can } from "@/lib/server/policy";
import { forgetReportsAt } from "@/lib/server/runs";
import { DeletionRefusedError } from "./errors";
import { bundleById, releasesOfBundles, survivingDigests, withLifecycleStore } from "./store";

/**
 * Delete one bundle the actor owns, with everything that only made sense while it existed.
 *
 * Refusals, in the order they are asked (the same split `transferBundle` publishes):
 * absent-or-unreadable is one answer (`no-such-bundle`, B-03 — a caller who may not read
 * the bundle learns nothing from asking); a readable bundle someone else owns is
 * `not-owner` (the read grant already conceded existence); a public bundle with a release
 * is `bundle-published`, because published stays.
 */
export async function deleteBundle(db: Db, actor: Actor, bundleId: string): Promise<void> {
  const bundle = await bundleById(db, "deleteBundle", bundleId);
  if (
    bundle === undefined ||
    !can(actor, "read", { kind: "bundle", ownerId: bundle.ownerId, visibility: bundle.visibility })
  ) {
    throw new DeletionRefusedError(
      "no-such-bundle",
      "deleteBundle: no bundle answers to that id for this caller.",
    );
  }
  if (!can(actor, "delete", { kind: "bundle", ownerId: bundle.ownerId, visibility: bundle.visibility })) {
    throw new DeletionRefusedError(
      "not-owner",
      "deleteBundle: only the owner may delete a bundle.",
    );
  }

  const digests = await releasesOfBundles(db, [bundleId]);
  if (bundle.visibility === "public" && digests.length > 0) {
    throw new DeletionRefusedError(
      "bundle-published",
      "deleteBundle: this bundle has a published release, and everything you published stays. " +
        "Take it private first is not an exit either: the release was the world's to read.",
    );
  }

  await withLifecycleStore("deleteBundle", async () =>
    db.transaction(async (tx) => {
      /* Children first, FK order where one exists (`note_vote.note_id` → `note`,
         `target_actor.target_id` → `target`, `ballot.bundle_id`/`release.bundle_id` →
         `bundle`); the text-keyed rows (`note`, `save`, `target`) go because their subject
         does — see the header for why this is not `deleteNote`'s tombstone protocol. */
      const notes = await tx
        .select({ id: schema.note.id })
        .from(schema.note)
        .where(and(eq(schema.note.targetKind, "blueprint"), eq(schema.note.targetId, bundleId)));
      if (notes.length > 0) {
        const noteIds = notes.map((row) => row.id);
        await tx.delete(schema.noteVote).where(inArray(schema.noteVote.noteId, noteIds));
        await tx.delete(schema.note).where(inArray(schema.note.id, noteIds));
      }
      await tx
        .delete(schema.save)
        .where(and(eq(schema.save.targetKind, "blueprint"), eq(schema.save.targetId, bundleId)));
      const targets = await tx
        .select({ id: schema.target.id })
        .from(schema.target)
        .where(and(eq(schema.target.kind, "blueprint"), eq(schema.target.refId, bundleId)));
      if (targets.length > 0) {
        const targetIds = targets.map((row) => row.id);
        await tx.delete(schema.targetActor).where(inArray(schema.targetActor.targetId, targetIds));
        await tx.delete(schema.target).where(inArray(schema.target.id, targetIds));
      }
      await tx.delete(schema.ballot).where(eq(schema.ballot.bundleId, bundleId));
      await tx.delete(schema.release).where(eq(schema.release.bundleId, bundleId));
      await tx.delete(schema.bundle).where(eq(schema.bundle.id, bundleId));

      /* D-120-04's orphan question, per digest and asked against the committing state:
         a fork can still carry an identical digest, and a report about bytes somebody
         still serves is not orphaned. */
      const surviving = await survivingDigests(tx, digests);
      for (const digest of digests) {
        if (!surviving.has(digest)) await forgetReportsAt(tx, digest);
      }
    }),
  );
}
