/* ============================================================
   POST /api/account/saves/migrate
   The browser-local favourite set, folded into the account on
   first sign-in (AC5, D-140-07). `200 SavesView | 400 401 500`.

   **The body carries `{ kind, refId }` targets, ALREADY in the
   enum's own vocabulary — this route translates nothing.**
   SEAM-62's `localStorage` key space is withdrawn rather than
   mapped: it names three kinds against a three-member enum with
   two outside it and `term` absent, it carries the `@<version>`
   grain B-10 forbids in that column, and its bare slug cannot
   resolve to a bundle because B-09 makes slugs unique per owner.
   Mapping it here would invent three things the contract does not
   state. **T262 owns `STORAGE_KEY` and owns that mapping.**

   **No handle is required, and AC5 is the deciding case.** The
   migration happens *on first sign-in*, when the account still has
   `handle: null` until it reaches `PATCH /api/account/handle`.
   Requiring one would make the criterion unreachable at exactly
   the moment it is about — the same shape as D-50-05's carve-out
   for the route that allocates the first handle.

   Idempotent across repeated sign-ins by the database rather than
   by anything here: `save_account_target_key` refuses the second
   row, so a second sign-in carrying an overlapping set adds only
   what the first did not.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, readJsonObject } from "@/lib/server/accounts";
import { withSession } from "@/lib/server/auth";
import {
  migrateLocalSaves,
  savesViewFor,
  targetsFrom,
  withSaveErrors,
} from "@/lib/server/saves";

export async function POST(request: Request): Promise<Response> {
  return withSession(request, async (session) =>
    withSaveErrors(request, async () => {
      const targets = targetsFrom(request, await readJsonObject(request));
      if (targets instanceof Response) return targets;

      const { db } = getSharedDbClient();
      const actor = actorFrom(session);
      await migrateLocalSaves(db, actor, session.accountId, targets);
      return await savesViewFor(db, actor, session.accountId);
    }),
  );
}
