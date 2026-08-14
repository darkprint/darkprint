/* ============================================================
   DarkPrint backend — the (card_id, version) unique constraint,
   named at runtime rather than restated
   `card_version_id_version_key` is declared once, in
   `lib/db/schema.ts` (Forbidden here — read, never edited).
   Asserting it through `getTableConfig` instead of writing the
   literal a second time means a rename in the schema either
   updates this automatically or fails loudly at import time,
   rather than this module silently stopping matching a real
   Postgres constraint-violation error.
   ============================================================ */

import { getTableConfig } from "drizzle-orm/pg-core";
import { schema } from "@/lib/db";

function findCardIdVersionUniqueConstraintName(): string {
  const unique = getTableConfig(schema.cardVersion).indexes.filter((index) => index.config.unique);
  if (unique.length !== 1 || unique[0].config.name === undefined) {
    throw new Error(
      "lib/server/cards: expected exactly one named unique index on card_version — lib/db/schema.ts has drifted from what this module assumes",
    );
  }
  return unique[0].config.name;
}

/** The runtime name of `card_version_id_version_key`, read off the schema rather than typed here twice. */
export const CARD_ID_VERSION_UNIQUE_CONSTRAINT = findCardIdVersionUniqueConstraintName();
