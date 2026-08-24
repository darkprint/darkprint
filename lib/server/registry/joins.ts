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

/**
 * The batch form of `usersOf`, owed under D-260-21 and armed the moment T260's shelves went
 * dynamic: `/nodes` was paying one full snapshot (four statements) PER CARD per page load.
 * ONE snapshot, every id answered from its `usersById` index. Ids nothing pins answer an
 * empty list rather than being omitted — a map that omits what nothing names drops exactly
 * the rows a caller is iterating (D-210-09's reason, applied here).
 */
export async function usersOfMany(
  db: Db,
  actor: Actor,
  cardIds: readonly string[],
): Promise<ReadonlyMap<string, readonly BlueprintSummary[]>> {
  return withRegistryStore("usersOfMany", async () => {
    const snapshot = await loadSnapshot(db, actor);
    return new Map(cardIds.map((id) => [id, snapshot.usersById.get(id) ?? []]));
  });
}
