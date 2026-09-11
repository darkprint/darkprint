/* ============================================================
   DarkPrint backend — naming: the arbiter's name, derived
   AC5 is satisfied by the index rather than by code, so the thing
   that decides which of two concurrent allocations won is
   `handle_reservation`'s primary key. Naming it wrongly does not
   fail loudly: a duplicate would stop being recognised as a
   duplicate and would leave as a generic write failure instead,
   with AC4 and AC5 quietly unmet. D-14's argument, applied to a
   primary key.

   **The constraint NAME is gone and only the shape is checked.**
   D-70-06 replaced the bare insert with
   `ON CONFLICT (handle) DO UPDATE … WHERE`, so a duplicate no
   longer raises 23505 at all — the refusal is an empty `returning`.
   Matching `handle_reservation_pkey` against a driver error became
   a branch nothing can take, and a derivation whose only consumer
   is unreachable is a guard that cannot fail, so it was removed
   rather than kept for symmetry.

   What remains is the assumption the statement itself rests on:
   `ON CONFLICT (handle)` needs `handle` to carry a unique
   constraint. If the schema moved the key, Postgres would raise
   42P10 on the next allocation; asserting it at import turns that
   into a loud configuration error at load instead of a fault a
   caller meets. Drizzle records a column-level `.primaryKey()` as a
   flag on the column rather than in `primaryKeys`, so the columns
   are what gets read.
   ============================================================ */

import { getTableConfig } from "drizzle-orm/pg-core";
import { schema } from "@/lib/db";

function assertHandleIsTheKey(): void {
  const config = getTableConfig(schema.handleReservation);
  const primary = config.columns.filter((column) => column.primary).map((column) => column.name);
  if (primary.length !== 1 || primary[0] !== "handle") {
    throw new Error(
      `lib/server/naming: handle_reservation's primary key is (${primary.join(", ")}), not (handle) — ` +
        "lib/db/schema.ts has drifted from what this module assumes, and `ON CONFLICT (handle)` " +
        "would raise 42P10 at allocation time instead of failing here.",
    );
  }
}

assertHandleIsTheKey();
