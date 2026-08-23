/* ============================================================
   DarkPrint backend — counters: the two writers
   They differ in the one way that matters and it is a ruling
   rather than a style: **`toggleStar` may reject and
   `recordDownload` may not.**

   `toggleStar` is a reader acting, and AC3 refuses an anonymous
   one. Its return type carries no room for *denied* — a
   `SignalState` handed back unchanged reads as *your star did not
   stick*, which is indistinguishable from *you just unstarred* —
   so the refusal is a throw (D-140-02, and ruled again here).

   `recordDownload` is the serving edge reporting something that
   already happened. **A counter write that fails must not deny a
   legitimate download** (ruled at `a037587`): a counter outage
   taking downloads offline is a worse product than an undercount,
   and B-14 makes this event explicit rather than load-bearing.
   Nothing it does can reject.
   ============================================================ */

import { writeAudit } from "@/lib/server/observability";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { actingAccountId } from "./guards";
import {
  bumpDownloadCount,
  bumpStarCount,
  deleteStar,
  ensureTargetRow,
  insertStar,
  targetRowById,
  withStore,
} from "./store";
import { signalStateFrom } from "./read";
import type { CounterTarget, SignalState } from "./types";

/**
 * Adds this account's star if it has none, removes it if it has one, and answers the state
 * afterwards.
 *
 * ── The toggle is decided by what the DATABASE did, never by a prior read ──
 * The insert is attempted first and `RETURNING` is what says whether it landed.
 * `target_actor_target_account_kind_key` IS AC1's idempotency guarantee — starring twice
 * from one account yields one row because the index refuses the second, not because this
 * function checked. A `SELECT`-then-`INSERT` passes every sequential test and loses under
 * two concurrent callers, which is why the criterion is tested with concurrent callers or
 * it is not tested.
 *
 * So there are three outcomes and only two of them move the aggregate:
 * * the insert landed — this call starred, `star_count + 1`;
 * * the insert conflicted and the delete removed a row — this call unstarred,
 *   `star_count - 1`, which is AC2 (the count returns to what it was);
 * * the insert conflicted and the delete found nothing — a concurrent toggle got there
 *   first, so the row is gone and nothing here may claim to have moved it.
 *
 * **Every ±1 is therefore paired with a row that demonstrably appeared or disappeared**,
 * which is what keeps `star_count` equal to the rows it counts without a floor pretending
 * it does.
 *
 * ── Why a transaction ──
 * The pair is two statements and neither half is meaningful alone: an insert that lands
 * beside a failed increment is a star that exists and is not counted, and it stays wrong
 * forever because nothing reconciles the two. The transaction is what makes the pair
 * atomic. It also makes the read-back below see this caller's own uncommitted change,
 * which is what lets the answer describe the toggle the caller just asked for rather than
 * whatever was committed a moment earlier.
 *
 * ── `starredByCaller` is derived from what happened, not re-read ──
 * The insert landing means the row is this transaction's own; the delete having removed it
 * means it is gone. In the third outcome the row is gone too, which is why the derivation
 * is exact rather than convenient: `false` is the true answer whenever the insert did not
 * land, because either this call removed the row or something else already had.
 */
export async function toggleStar(
  db: Db,
  actor: Actor,
  target: CounterTarget,
): Promise<SignalState> {
  return await withStore("toggleStar", async () => {
    /* Inside the wrapper rather than before it, so the decision travels the pass-through
       arm on the path a caller actually takes and that arm has a witness. `withStore` opens
       no connection, so an anonymous caller still reaches no statement. */
    const accountId = actingAccountId("toggleStar", actor);

    return await db.transaction(async (tx) => {
      const row = await ensureTargetRow(tx, target);

      const starred = await insertStar(tx, row.id, accountId);
      if (starred) {
        await bumpStarCount(tx, row.id, 1);
      } else if (await deleteStar(tx, row.id, accountId)) {
        await bumpStarCount(tx, row.id, -1);
      }

      const after = await targetRowById(tx, row.id);
      /* Unreachable: nothing in the tree deletes a `target` row, and this transaction is
         holding it. A throw rather than a `!` so a broken premise reports itself here
         instead of as a `TypeError` inside `signalStateFrom`. */
      if (after === undefined) {
        throw new Error("toggleStar: the target row was not readable after the toggle.");
      }
      return signalStateFrom(after, starred);
    });
  });
}

/**
 * One download, counted.
 *
 * **Takes no `Actor`, and AC6 is why the signature is the rule.** A download of a private
 * bundle by its owner COUNTS: the counter measures serving, not publicity, and an owner's
 * own downloads are the honest denominator for a bundle that is later made public — an
 * owner who tested their own release should not see the count jump the day they publish.
 * This function cannot discriminate on the caller because it is not given one, which is
 * what makes the ruling structural rather than a rule somebody has to keep. T090 does its
 * own visibility check at the serving edge and emits the event after the file is in hand.
 *
 * **Never rejects.** Ruled at `a037587`. Not wrapped in `withStore` either, and that is not
 * an omission: the wrapper exists to seal a fault into a class a caller can branch on, and
 * this function hands its caller nothing to branch on by design.
 *
 * The failure is recorded rather than swallowed — see `auditFailedWrite`.
 */
export async function recordDownload(db: Db, target: CounterTarget): Promise<void> {
  try {
    await bumpDownloadCount(db, target);
  } catch (err) {
    await auditFailedWrite(db, target, err);
  }
}

/**
 * The audit row for a download this registry served and failed to count.
 *
 * `counter.write_failed` names the counter FAULT and never the download.
 * `lib/server/observability/types.ts` states the rule it has to satisfy: no member of
 * `AUDIT_ACTIONS` may name a download, because a per-download audit row is B-14's
 * derivation with the arrow reversed. This records failures only and never volume, so no
 * download is ever counted through the audit log.
 *
 * `actorKind: "system"` with a `null` actor is forced rather than chosen: AC6 gives this
 * function no `Actor`, so there is no caller to name and inventing one would be the audit
 * log's most load-bearing column carrying a guess.
 *
 * **`targetKind` and `targetId` are this module's own identifiers and `detail` is empty.**
 * The driver error does not travel: `AuditEntry.detail` is a scalar-only map so a nested
 * error object cannot be passed at all, and D-13 keeps the statement and its bound
 * parameters off every surface a reader reaches.
 *
 * ── The audit write is itself guarded, and that is the whole point ──
 * `writeAudit` throws `AuditStoreError`, and it goes to **the same Postgres that just
 * failed** — or, when the caller handed in a transaction handle, to a transaction that has
 * already aborted. Unguarded, it would convert *never rejects* into *rejects exactly when
 * the database is down*, which is the availability cliff the ruling exists to refuse. So
 * the console line survives as the last resort, and it is reached only when the audit row
 * could not be written: a failure that reached the log is recorded permanently, and
 * printing it as well would give one event two records.
 *
 * Neither error is interpolated into the message. The kind and the ref id are this module's
 * own identifiers rather than driver values, and the errors are passed whole as arguments,
 * so nothing either of them carries is stringified into the line.
 */
async function auditFailedWrite(db: Db, target: CounterTarget, cause: unknown): Promise<void> {
  try {
    await writeAudit(db, {
      actorId: null,
      actorKind: "system",
      action: "counter.write_failed",
      targetKind: target.kind,
      targetId: target.refId,
      decision: "error",
    });
  } catch (auditErr) {
    console.error(
      `recordDownload: the download count for ${target.kind} ${target.refId} was not written, ` +
        `and the audit row failed too.`,
      cause,
      auditErr,
    );
  }
}
