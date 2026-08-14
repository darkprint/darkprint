/* ============================================================
   DarkPrint backend — listCardVersions
   ============================================================ */

import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { CardRecord } from "./types";
import { fetchVisibleVersions } from "./visible-versions";

/** Every version of `cardId` that `actor` may read, newest first, total order. */
export async function listCardVersions(db: Db, actor: Actor, cardId: string): Promise<CardRecord[]> {
  return fetchVisibleVersions(db, actor, cardId);
}
