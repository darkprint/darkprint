/* ============================================================
   DarkPrint backend — row -> CardRecord
   `lib/db/schema.ts`'s own header: domain shapes are never
   restated as SQL columns beyond what needs to be queried or
   constrained, and the rest is stored verbatim as jsonb `body`,
   "reconstructed by callers through `lib/core`, which is the one
   place allowed to know what those shapes mean." This is that
   reconstruction: `body`'s column type is untyped jsonb, so the
   cast to `NodeCard` happens here, once, at the boundary.
   ============================================================ */

import type { NodeCard } from "@/lib/server/types";
import type { CardRecord } from "./types";
import { storedCard } from "./stored-card";

interface CardVersionRow {
  id: string;
  cardId: string;
  version: string;
  digest: string;
  ownerId: string;
  visibility: "public" | "private";
  body: unknown;
  source: string;
  createdAt: Date;
}

export function toCardRecord(row: CardVersionRow): CardRecord {
  return {
    id: row.id,
    cardId: row.cardId,
    version: row.version,
    digest: row.digest,
    ownerId: row.ownerId,
    visibility: row.visibility,
    body: storedCard(row.body),
    source: row.source,
    createdAt: row.createdAt,
  };
}
