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
  /**
   * The stored body when it is a card, `undefined` when the row cannot supply one.
   *
   * Was `NodeCard`, filled by a cast that never looked. A row written under an older schema
   * satisfies neither the type nor its readers, and the difference surfaced as a `TypeError`
   * in a renderer rather than as a value a caller could branch on. See `stored-card.ts`.
   */
  body: NodeCard | undefined;
  /** text: BYTE-identical on read-back, verbatim YAML. */
  source: string;
  createdAt: Date;
}
