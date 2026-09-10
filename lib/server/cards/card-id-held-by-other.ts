/* ============================================================
   DarkPrint backend — is this card id held by somebody else
   `cardIdInUse`'s sibling, for the door that appends to its own
   chain. A publish into `<handle>/<name>` has to be allowed when
   the caller already holds versions there, which is the version
   bump, and refused when anybody else does: the unique index is on
   `(card_id, version)`, so two owners at one id never collide at
   the database, and a bundle publish can write any id it pins.

   Owner- and visibility-blind for `cardIdInUse`'s reason: the
   filtered question cannot see a private squatter at all, and the
   one bit this leaks is a bit about the caller's own namespace,
   which is the only namespace its caller ever writes in.
   ============================================================ */

import { and, eq, ne } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";

/** Whether any stored version at `cardId` belongs to an account other than `ownerId`. */
export async function cardIdHeldByOther(db: Db, cardId: string, ownerId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.cardVersion.id })
    .from(schema.cardVersion)
    .where(and(eq(schema.cardVersion.cardId, cardId), ne(schema.cardVersion.ownerId, ownerId)))
    .limit(1);
  return rows.length > 0;
}
