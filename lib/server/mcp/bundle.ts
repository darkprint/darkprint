/* ============================================================
   DarkPrint backend — (handle, slug) -> a bundle this actor may read
   D-220-07 ratified this composition over publishing
   `bundleByHandle` from `lib/server/export`: three readers that
   are ALREADY on their barrels, no new query, and no second
   opinion about visibility.

       resolveOwner   @/lib/server/accounts   handle  -> accountId
       getBundle      @/lib/server/archive    owner+slug -> BundleRecord
       can            @/lib/server/policy     T060's decision, unmodified

   `lib/server/export/lookup.ts` holds a `bundleByHandle` that does
   the same thing in one join and is not on that module's barrel.
   The duplicate path in the tree is RECORDED and is not this
   task's: reaching into a deep path would break T000's barrel rule
   (D-01), and re-deriving the join here would be the second copy
   this run charges harder than anything else.

   ── Three absences, one value ──
   A handle that does not parse, a handle nobody holds, a slug that
   names no bundle, and a bundle this actor may not read all answer
   `undefined`. B-03 requires that: a caller able to tell them apart
   has the existence oracle the status code closed. `resolveOwner`
   already refuses a malformed handle before it reaches a query,
   which is also what keeps caller input off the driver.
   ============================================================ */

import { resolveOwner } from "@/lib/server/accounts";
import { getBundle, type BundleRecord } from "@/lib/server/archive";
import type { Db } from "@/lib/db";
import { can, type Actor } from "@/lib/server/policy";

/**
 * The bundle at `(ownerHandle, slug)` if `actor` may read it, otherwise `undefined`.
 *
 * `can` is T060's published decision called with T060's published resource shape. This file
 * authors no visibility rule of its own and must not grow one: `visibility` and `ownerId`
 * are read off the record and handed over whole, so the answer here cannot disagree with the
 * answer anywhere else on the site.
 */
export async function readableBundle(
  db: Db,
  actor: Actor,
  ownerHandle: string,
  slug: string,
): Promise<BundleRecord | undefined> {
  const owner = await resolveOwner(db, ownerHandle);
  if (owner === undefined) return undefined;

  const bundle = await getBundle(db, owner.accountId, slug);
  if (bundle === undefined) return undefined;

  const readable = can(actor, "read", {
    kind: "bundle",
    ownerId: bundle.ownerId,
    visibility: bundle.visibility,
  });
  return readable ? bundle : undefined;
}
