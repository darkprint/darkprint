/* ============================================================
   DarkPrint backend — accounts: row to record
   One place builds a record, so the key set every response
   carries is decided once. AC2's test asserts a key set, and a
   key set assembled at each call site is a key set that differs
   at one of them.

   D-50-09: an absent value **omits the key**. Written as a
   conditional assignment rather than as `bio: row.bio ?? undefined`
   for the reason the criterion is sensitive to — the second form
   puts `bio` in `Object.keys` while `Response.json` drops it from
   the body, so an object-level assertion and a wire-level one
   would disagree about the same response.
   ============================================================ */

import type { schema } from "@/lib/db";
import type { AccountRecord, PublicAuthor } from "./types";

/** The stored row, as drizzle infers it. Never published — records are. */
type AccountRow = typeof schema.account.$inferSelect;

export function publicAuthorOf(row: AccountRow): PublicAuthor {
  const author: PublicAuthor = {
    handle: row.handle,
    displayName: row.displayName,
    avatarHue: row.avatarHue,
    validator: row.validator,
  };
  if (row.bio !== null) author.bio = row.bio;
  return author;
}

export function accountRecordOf(row: AccountRow): AccountRecord {
  const record: AccountRecord = {
    accountId: row.id,
    author: publicAuthorOf(row),
    email: row.email,
    /* `joinedAt` is `created_at`. The column is the only record of when the account
       came into being, and nothing else on the row moves only once. */
    joinedAt: row.createdAt,
    /**
     * D-50-10. `validator_weight` is `numeric(6,3)`, which drizzle types as `string`
     * and `pg` hands back as `"1.000"` — verified with `tsc`, not assumed. `Number`
     * rather than `parseInt`: the column holds three decimal places, `1.005` is a
     * representable weight, and an integer reading would silently store-and-serve
     * `1` for it. No `isFinite` guard: `numeric` cannot produce a value `Number`
     * fails on, and a branch that cannot be taken reports a check nobody runs.
     */
    validatorWeight: Number(row.validatorWeight),
    defaultVisibility: row.defaultVisibility,
  };
  if (row.validatorSince !== null) record.validatorSince = row.validatorSince;
  return record;
}
