/* ============================================================
   DarkPrint backend — findCardsByDigest
   `CardRecord[]`, deliberately: `cardDigest` includes `id` and
   `version`, so two *stored* rows sharing a digest is impossible
   short of a sha256 collision under today's unique index — but
   the cardinality is a consequence of that index, not a property
   of digests, and T080's duplicate-group queries are the future
   caller that will care (2026-08-14 amendment). Narrowing this to
   `CardRecord | undefined` would be a signature that has to
   change shape the day the index does.
   ============================================================ */

import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { can, type Actor } from "@/lib/server/policy";
import type { CardRecord } from "./types";
import { toCardRecord } from "./to-card-record";
import { byVersionDescendingThenId } from "./visible-versions";

/** Every row carrying `digest` that `actor` may read, in the same total order as the other lists. */
export async function findCardsByDigest(db: Db, actor: Actor, digest: string): Promise<CardRecord[]> {
  const rows = await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.digest, digest));
  return rows
    .filter((row) => can(actor, "read", { kind: "card", ownerId: row.ownerId, visibility: row.visibility }))
    .map(toCardRecord)
    .sort(byCardIdThenVersion);
}

function byCardIdThenVersion(a: CardRecord, b: CardRecord): number {
  if (a.cardId !== b.cardId) return a.cardId < b.cardId ? -1 : 1;
  return byVersionDescendingThenId(a, b);
}
