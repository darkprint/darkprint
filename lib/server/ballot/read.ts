/* ============================================================
   DarkPrint backend — ballot: the read half
   ============================================================ */

import type { Db } from "@/lib/db";
import { can, type Actor } from "@/lib/server/policy";
import { aggregateFrom } from "./aggregate";
import { bundleRowFor, weightedVotesFor, withStore } from "./store";
import type { Aggregate } from "./types";

/**
 * One blueprint's community standing, recomputed from the stored votes and the **current**
 * validator weights every time it is asked for.
 *
 * **AC5 is this function having no cached answer to return.** "Raising an account's
 * `validator_weight` changes an existing aggregate without any vote being recast" holds
 * because nothing here reads a stored aggregate — there is no column to read, by
 * `lib/db/schema.ts:394-397`'s ruling, and the weight arrives on the join in
 * `weightedVotesFor`. A materialised aggregate passes every other criterion and fails this
 * one, and it is the optimisation somebody will reach for; if it is ever wanted it has to be
 * invalidated by weight changes, which is harder to get right than recomputing.
 *
 * **A bundle the caller may not see and a bundle that is not there answer identically, and
 * the answer is a VALUE rather than a refusal.** B-03's 404-over-403 rule, expressed the way
 * `listSaves` expresses it with `[]` and `countSaves` with `0` (D-140-01): an empty aggregate
 * is what a real public blueprint nobody has voted on returns, so a private one is
 * indistinguishable from an unvoted one and from a mistyped id. `Aggregate` has no absent
 * shape to return instead, and inventing one would be the existence oracle B-03 closes.
 *
 * **Anonymous callers are answered.** AC6 refuses an anonymous *ballot*; a public
 * blueprint's community score is public, and every other read-model door answers the public
 * half to anonymous.
 *
 * `can` rather than a comparison: T060 owns the visibility decision and re-deciding it here
 * would be a second answer free to disagree with the first.
 */
export async function getAggregate(db: Db, actor: Actor, bundleId: string): Promise<Aggregate> {
  return await withStore("getAggregate", async () => {
    const bundle = await bundleRowFor(db, bundleId);
    if (bundle === undefined) return aggregateFrom([]);
    if (!can(actor, "read", { kind: "bundle", ...bundle })) return aggregateFrom([]);
    return aggregateFrom(await weightedVotesFor(db, bundleId));
  });
}
