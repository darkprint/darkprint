/* ============================================================
   DarkPrint backend — getCard
   ============================================================ */

import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { can, type Actor } from "@/lib/server/policy";
import type { CardRecord } from "./types";
import { toCardRecord } from "./to-card-record";

/** The exact `(cardId, version)` row, or `undefined` if it does not exist or `actor` may not read it. */
export async function getCard(
  db: Db,
  actor: Actor,
  cardId: string,
  version: string,
): Promise<CardRecord | undefined> {
  const rows = await db
    .select()
    .from(schema.cardVersion)
    .where(and(eq(schema.cardVersion.cardId, cardId), eq(schema.cardVersion.version, version)));
  const row = rows[0];
  if (row === undefined) return undefined;
  if (!can(actor, "read", { kind: "card", ownerId: row.ownerId, visibility: row.visibility })) return undefined;
  return toCardRecord(row);
}
