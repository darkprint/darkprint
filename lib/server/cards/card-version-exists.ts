/* ============================================================
   DarkPrint backend — is this exact card version stored
   `getCard` answers through `can`, so a private row somebody
   else wrote reads as absent and a second publish of the same
   version would reach the unique index and come back as a
   constraint name. This reader takes no `Actor` so a caller can
   refuse with a sentence before the write, and again after a lost
   race, both times about a version inside its own namespace.
   ============================================================ */

import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";

/** Whether a row for `(cardId, version)` exists, whoever owns it and whatever its visibility. */
export async function cardVersionExists(db: Db, cardId: string, version: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.cardVersion.id })
    .from(schema.cardVersion)
    .where(and(eq(schema.cardVersion.cardId, cardId), eq(schema.cardVersion.version, version)))
    .limit(1);
  return rows.length > 0;
}
