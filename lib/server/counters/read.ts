/* ============================================================
   DarkPrint backend — counters: the read
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { actingAccountIdOrNull } from "./guards";
import { hasStar, targetRow, targetRowsFor, withStore, type TargetRow } from "./store";
import type { CounterTarget, SignalState } from "./types";

/**
 * The three counters as numbers.
 *
 * **`Number`, on D-50-10's precedent** (`lib/server/accounts/records.ts:49`): the columns
 * are `numeric(12, 0)`, which drizzle types as `string` and `pg` hands back as `"0"`.
 * `parseInt` would be the wrong reading for a different column and the right one here by
 * luck, and `Number` is what the tree already uses for a numeric column.
 *
 * **No `isFinite` guard.** `numeric(12, 0)` cannot produce a value `Number` fails on, and
 * twelve digits is four orders of magnitude inside `Number.MAX_SAFE_INTEGER` — a branch
 * that cannot be taken would report a check nobody runs.
 */
export function signalStateFrom(row: TargetRow, starredByCaller: boolean): SignalState {
  return {
    starCount: Number(row.starCount),
    downloadCount: Number(row.downloadCount),
    /* D-WAVE-01: read, never computed and never written. T170 maintains this column, and
       B-18's tombstone rule — which decides whether a deleted note still counts — has
       exactly one author. Counting `note` rows here would give it a second. */
    noteCount: Number(row.noteCount),
    starredByCaller,
  };
}

/**
 * Every public signal against one target, plus whether this caller stars it.
 *
 * **Answers every caller, including an anonymous one.** B-10 makes a star public and the
 * counters with it, so there is nothing here a reader may not see and no refusal to author
 * — which is also why this function has no visibility check: a private bundle's counters
 * are `0`, and they are `0` for its owner too.
 *
 * **A target nothing has happened to answers three zeros without creating a row.** That is
 * the same answer reading a fresh row would give, at the cost of no write — so a read
 * cannot lose the `(kind, ref_id)` race to T170 over a row neither task has a reason to
 * make yet.
 *
 * **`starredByCaller` is `false` for an anonymous reader rather than absent** (AC4).
 */
export async function getSignals(
  db: Db,
  actor: Actor,
  target: CounterTarget,
): Promise<SignalState> {
  return await withStore("getSignals", async () => {
    const row = await targetRow(db, target);
    if (row === undefined) {
      return { starCount: 0, downloadCount: 0, noteCount: 0, starredByCaller: false };
    }
    const accountId = actingAccountIdOrNull(actor);
    const starred = accountId === null ? false : await hasStar(db, row.id, accountId);
    return signalStateFrom(row, starred);
  });
}

/**
 * A `(kind, refId)` pair as a map key. Joined with a space: `kind` is one of three fixed
 * enum members and never contains one, so the join cannot collide two distinct pairs
 * onto one key the way a bare concatenation could.
 */
function keyOf(target: Pick<CounterTarget, "kind" | "refId">): string {
  return `${target.kind} ${target.refId}`;
}

/**
 * `getSignals`, for many targets in one round trip.
 *
 * **Answers in `targets`' own order, one entry per element — including a repeated
 * target twice.** A caller rendering a page of cards asks for exactly the row order it
 * means to draw, and `targetRowsFor`'s `SELECT` makes no promise about the order rows
 * come back in; re-deriving the caller's order from the query result is this function's
 * job, not a property to assume of the statement.
 *
 * **A target nothing has happened to answers three zeros, the same as `getSignals`,
 * and creates no row** — `targetRowsFor` reads, it does not `ensureTargetRow`.
 */
export async function getSignalsMany(
  db: Db,
  actor: Actor,
  targets: readonly CounterTarget[],
): Promise<SignalState[]> {
  return await withStore("getSignalsMany", async () => {
    if (targets.length === 0) return [];
    const accountId = actingAccountIdOrNull(actor);
    const rows = await targetRowsFor(db, targets, accountId);

    const byKey = new Map(rows.map((row) => [keyOf(row), row]));
    return targets.map((target) => {
      const row = byKey.get(keyOf(target));
      return row === undefined
        ? { starCount: 0, downloadCount: 0, noteCount: 0, starredByCaller: false }
        : signalStateFrom(row, row.starredByCaller);
    });
  });
}
