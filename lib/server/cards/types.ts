/* ============================================================
   DarkPrint backend — lib/server/cards row type
   T020's published `CardRecord`: one immutable row per
   `(cardId, version)`. `body` round-trips VALUE-identical only
   (jsonb drops key order and number spelling); `source` holds
   the verbatim YAML bytes and round-trips BYTE-identical.
   ============================================================ */

import type { NodeCard } from "@/lib/server/types";

export interface CardRecord {
  id: string;
  cardId: string;
  version: string;
  digest: string;
  ownerId: string;
  visibility: "public" | "private";
  /** jsonb: VALUE-identical on read-back, never byte-identical. */
  body: NodeCard;
  /** text: BYTE-identical on read-back, verbatim YAML. */
  source: string;
  createdAt: Date;
}
