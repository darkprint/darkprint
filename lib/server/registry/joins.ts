/* ============================================================
   DarkPrint backend — usersOf() and duplicates()
   The two reverse indexes. `usersOf` answers over every version
   of a card id, so a blueprint pinning two of them is one user
   (AC2's "distinct"); `duplicates` asks the question the stored
   digest cannot (D-80-05).
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { BlueprintSummary, CardSummary } from "./types";
import { loadSnapshot } from "./snapshot";
import { withRegistryStore } from "./store";

const NO_USERS: readonly BlueprintSummary[] = Object.freeze([]);

/** Blueprints using any version of `cardId`, distinct, by slug then owner handle. */
export async function usersOf(db: Db, actor: Actor, cardId: string): Promise<readonly BlueprintSummary[]> {
  return withRegistryStore(
    "usersOf",
    async () => (await loadSnapshot(db, actor)).usersById.get(cardId) ?? NO_USERS,
  );
}

/**
 * Cards that say the same thing under different refs — §4 dedup made visible. Groups of two
 * or more, each in `cards()` order, the groups themselves in first-appearance order.
 */
export async function duplicates(db: Db, actor: Actor): Promise<readonly (readonly CardSummary[])[]> {
  return withRegistryStore("duplicates", async () => (await loadSnapshot(db, actor)).duplicates);
}
