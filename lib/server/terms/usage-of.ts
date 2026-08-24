/* ============================================================
   DarkPrint backend — usageOf
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";

import { buildIndex, noUsage } from "./index-of";
import { withTermStore } from "./store";
import type { TermUsage } from "./types";

/**
 * How much of the public archive names one term. Always a record, never `undefined` (AC4).
 *
 * A term nothing names reports zero, and an abstract root reporting zero is not a defect:
 * roots exist to be specialised, so nothing pointing at one directly is the expected
 * reading rather than a hole. Returning `undefined` here would invite a 404 at the route
 * and lose the criterion one layer up, which is why the signature has no nullable arm to
 * satisfy in the first place.
 *
 * The id is matched exactly as the caller spells it and as the card spells it. No `broader`
 * chain is walked and no deprecation is followed: a card naming a deprecated term is
 * counted against that term and not against its successor, which is the only way these
 * counts can answer "is anybody still writing the old spelling?".
 *
 * `actor` does not select the content, and that is AC3 rather than an oversight. The counts
 * are absolute — private blueprints and cards contribute to none of them, for every reader
 * — so an answer that varied by viewer would be the defect. See `index-of.ts` for why the
 * index is built for an anonymous actor and what would go wrong if it were built for this
 * one. Reported as T210-07.
 */
export async function usageOf(db: Db, actor: Actor, termId: string): Promise<TermUsage> {
  /* T200's construction (D-200-06/07), adopted at D-210-03: accepted, documented, unused. */
  void actor;
  return withTermStore("usageOf", async () => (await buildIndex(db)).get(termId) ?? noUsage(termId));
}
