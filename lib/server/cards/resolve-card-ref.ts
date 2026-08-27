/* ============================================================
   DarkPrint backend — resolveCardRef
   A `CardRef` is always "id@version" (`parseCardRef` refuses an
   unversioned or "@latest" ref, per `lib/core/card/schema.ts`) —
   there is no bare-id case to special-case here; that is
   `getLatestCard`'s job (AC5).
   ============================================================ */

import { parseCardRef } from "@/lib/core";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { CardRef } from "@/lib/server/types";
import type { CardRecord } from "./types";
import { getCard } from "./get-card";

/** `undefined` for a ref that does not parse, that names no row, or that `actor` may not read. */
export async function resolveCardRef(db: Db, actor: Actor, ref: CardRef): Promise<CardRecord | undefined> {
  const parsed = parseCardRef(ref);
  if (parsed === undefined) return undefined;
  return getCard(db, actor, parsed.id, parsed.version);
}
