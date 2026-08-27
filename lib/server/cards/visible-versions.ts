/* ============================================================
   DarkPrint backend — the shared read-time visibility filter
   AC4 is enforced here rather than left to callers: every read
   below builds the resource as { kind: "card", ownerId,
   visibility } and asks T060's `can`. A denied read is omitted
   from the result, never thrown and never a 403 — mapping a
   denial to 404 is the route's job (B-03).

   "Latest is the highest semver, not the most recent row" — order
   with `compareVersionStrings` (semver order over raw strings),
   and give every list a total order with an `id` tiebreak behind
   it, so two reads of one set never disagree (T020 contract; the
   inherited defect this rule exists to not repeat is T010's
   `listReleases`, which shipped without one).
   ============================================================ */

import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { compareVersionStrings } from "@/lib/core";
import { can, type Actor } from "@/lib/server/policy";
import type { CardRecord } from "./types";
import { toCardRecord } from "./to-card-record";

/** Descending by semver, then ascending by row id — a total order over any set of rows. */
export function byVersionDescendingThenId(a: CardRecord, b: CardRecord): number {
  const byVersion = compareVersionStrings(b.version, a.version);
  if (byVersion !== 0) return byVersion;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Every stored version of `cardId` that `actor` may read, newest first. */
export async function fetchVisibleVersions(db: Db, actor: Actor, cardId: string): Promise<CardRecord[]> {
  const rows = await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.cardId, cardId));
  return rows
    .filter((row) => can(actor, "read", { kind: "card", ownerId: row.ownerId, visibility: row.visibility }))
    .map(toCardRecord)
    .sort(byVersionDescendingThenId);
}
