/* ============================================================
   DarkPrint backend — naming: the arbiter's name, derived
   AC5 is satisfied by the index rather than by code, so the thing
   that decides which of two concurrent allocations won is
   `handle_reservation`'s primary key. Naming it wrongly does not
   fail loudly: a duplicate would stop being recognised as a
   duplicate and would leave as a generic write failure instead,
   with AC4 and AC5 quietly unmet. D-14's argument, applied to a
   primary key.

   Drizzle records a column-level `.primaryKey()` as a flag on the
   column, not as an entry in `primaryKeys` (which is for the
   composite `primaryKey()` helper), so there is no name to read
   off the schema the way `getTableConfig(...).indexes` gives one.
   What *is* readable is the table name and which column carries
   the key, and `0001_init.up.sql` declares the key inline with no
   name — so Postgres names it `<table>_pkey`. Both halves are
   checked at import time, and the assembled name is checked
   against a real 23505 in `naming.scratch.test.ts`, because a
   convention is a claim and this file is where it would rot.
   ============================================================ */

import { getTableConfig } from "drizzle-orm/pg-core";
import { schema } from "@/lib/db";

function handlePrimaryKeyConstraintName(): string {
  const config = getTableConfig(schema.handleReservation);
  const primary = config.columns.filter((column) => column.primary).map((column) => column.name);
  if (primary.length !== 1 || primary[0] !== "handle") {
    throw new Error(
      `lib/server/naming: handle_reservation's primary key is (${primary.join(", ")}), not (handle) — ` +
        "lib/db/schema.ts has drifted from what this module assumes, and a duplicate handle would " +
        "stop being recognised as one.",
    );
  }
  return `${config.name}_pkey`;
}

/** `handle_reservation_pkey` — the unique constraint AC4 and AC5 both rest on. */
export const HANDLE_PRIMARY_KEY_CONSTRAINT = handlePrimaryKeyConstraintName();
