/* ============================================================
   DarkPrint backend — getLatestCard
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { CardRecord } from "./types";
import { fetchVisibleVersions } from "./visible-versions";

/** The highest-semver version of `cardId` that `actor` may read, or `undefined`. */
export async function getLatestCard(db: Db, actor: Actor, cardId: string): Promise<CardRecord | undefined> {
  const versions = await fetchVisibleVersions(db, actor, cardId);
  return versions[0];
}
