/* ============================================================
   DarkPrint backend — is anything stored under this card id
   The one question about `card_version` that must NOT be asked
   through `can`, and the reason is a defect it was written from.

   A card id is a namespace shared by every version under it, and
   the unique index constrains `(card_id, version)` — so a writer
   holding `berti/planner@0.1.0` and a writer adding
   `berti/planner@1.0.0` do not collide at the database at all.
   Two accounts then own two versions of one card, `versionsOf`
   lists them as one chain, and `getLatestCard` answers with
   whichever sorts highest. Nothing in this module compared a new
   version's owner against the owners already at that id, and a
   fork asking the visibility-filtered question could not see a
   PRIVATE row to compare against in the first place: it read an
   empty list, wrote, and disappeared into a stranger's card.

   So this reader takes no `Actor`. It answers whether the id is
   occupied and nothing else — never who, never how many, never at
   which versions — and its one caller (`lineage/fork-card.ts`)
   may only ever write inside the caller's OWN handle namespace,
   so the single bit it can leak is a bit about the asker's own
   names. That pairing is the whole argument: an unfiltered read
   is safe here because the id it is asked about is not the
   caller's to choose.

   It does not replace `can` anywhere. Every reader that returns
   card CONTENT still filters, and this returns no content.
   ============================================================ */

import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";

/**
 * Whether any stored version carries `cardId`, whoever owns it and whatever its visibility.
 *
 * `select 1 ... limit 1` rather than a count: the caller branches on occupied-or-not, and a
 * count invites a caller to render it, which would turn one bit into a report about rows the
 * asker may not read.
 */
export async function cardIdInUse(db: Db, cardId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.cardVersion.id })
    .from(schema.cardVersion)
    .where(eq(schema.cardVersion.cardId, cardId))
    .limit(1);
  return rows.length > 0;
}
