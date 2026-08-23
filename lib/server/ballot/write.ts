/* ============================================================
   DarkPrint backend — ballot: the write half
   ============================================================ */

import type { Db } from "@/lib/db";
import { can, type Actor } from "@/lib/server/policy";
import { aggregateFrom } from "./aggregate";
import { noSuchBundle } from "./errors";
import { requireScores, requireVoter } from "./guards";
import { bundleRowFor, upsertBallot, weightedVotesFor, withStore } from "./store";
import { METRICS, type Aggregate, type Ballot } from "./types";

/**
 * Records one account's opinion of one blueprint and answers the blueprint's standing after
 * it.
 *
 * **AC2 is `ballot_account_bundle_key`, not a comparison this function makes.** One row per
 * `(account, bundle)`, so an account voting twice on a metric replaces rather than
 * accumulates — and the key is the **bundle**, never a release, because B-11 carries one
 * ballot across releases and keying on a release would silently reset a blueprint's standing
 * every time its author published.
 *
 * **AC1 needs no statement here at all.** `Partial<Ballot>` has three members and the table
 * has three columns, so `autonomy` and `security` cannot be passed and could not be stored
 * if they were. Autonomy and static risk are `source: "auto"` and the engine's alone
 * (`lib/types.ts:36`).
 *
 * ── The order of the four steps, and why each is where it is ──
 *
 * `requireVoter` and `requireScores` are pure and run before any statement is built, so a
 * caller who may not vote never reaches the database and a malformed score never reaches the
 * check constraint. Both sit INSIDE `withStore` rather than before it, on T140's reasoning:
 * that puts the decisions through the wrapper's pass-through arm on the path a caller
 * actually takes, giving the arm a witness instead of leaving it a branch nothing reaches.
 * `withStore` opens no connection of its own, so nothing is lost by it.
 *
 * The bundle is read before the upsert because `ballot.bundle_id` references `bundle.id`: an
 * unrefused insert against an unknown id raises `23503`, which this module would seal into
 * "the ballot store failed" — telling a caller the database broke when they mistyped an id.
 * The same read is the visibility gate, and the two share one answer (`noSuchBundle`) for
 * B-03's reason.
 *
 * **An empty ballot writes nothing.** `castBallot(db, actor, id, {})` is a caller expressing
 * no opinion: the row it would create carries three NULLs, contributes to no metric's sample,
 * and is indistinguishable from not having voted — so creating it would be a row that means
 * nothing. It is still refused for an anonymous caller and for an unknown bundle, because
 * those are facts about the caller and the target rather than about the ballot.
 */
export async function castBallot(
  db: Db,
  actor: Actor,
  bundleId: string,
  ballot: Partial<Ballot>,
): Promise<Aggregate> {
  return await withStore("castBallot", async () => {
    /* AC6, first, and before anything is built. */
    const accountId = requireVoter(actor);
    /* B-11's 0-100, refused here rather than by `ballot_metric_range`, whose violation
       carries the bound value into a driver message (D-13). */
    requireScores(ballot);

    const bundle = await bundleRowFor(db, bundleId);
    if (bundle === undefined) throw noSuchBundle();
    if (!can(actor, "read", { kind: "bundle", ...bundle })) throw noSuchBundle();

    if (METRICS.some((metric) => ballot[metric] !== undefined)) {
      await upsertBallot(db, accountId, bundleId, ballot);
    }

    return aggregateFrom(await weightedVotesFor(db, bundleId));
  });
}
