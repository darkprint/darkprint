/* ============================================================
   DarkPrint backend — forksOf
   AC2 and AC3 are one property: a private fork is invisible
   upstream in every direction. Not in the list, not in the count,
   and not in the upstream author's notifications (the third is
   T190's and is out of scope here — nothing in this module writes
   an event, which is how it holds).

   ── PUBLIC ROWS ONLY, for everyone, always (Q1) ──
   This shipped once filtering through `visibleTo`, which is what
   the Published signatures block said until `82e48bb`, and the
   ruling went the other way. Filtering per viewer makes the count
   a property of the VIEWER rather than of the upstream: two
   callers see two different fork counts for one bundle, and AC2's
   "unchanged while the fork is private" then holds for a stranger
   and FAILS for the upstream's own author — who is exactly the
   person AC3 protects. So the actor is not consulted about which
   forks exist at all, and the predicate below reads a column
   rather than an identity.
   ============================================================ */

import type { Db } from "@/lib/db";
import type { BundleRecord } from "@/lib/server/archive";
import { can, type Actor } from "@/lib/server/policy";
import { bundleById, forkRowsOf } from "./store";

/**
 * The PUBLIC forks of `bundleId`, newest last. The same list for every caller.
 *
 * **The count is `forksOf(...).length` and there is no aggregate beside it.** That is AC2's
 * whole mechanism rather than a convenience: a `countForksOf` running its own `SELECT
 * count(*)` passes every test that forks publicly and leaks on the one that forks privately,
 * because a count is the query people forget to filter. One query answers both questions or
 * neither does.
 *
 * `actor` still gates the UPSTREAM — a bundle the caller may not read has no fork list to
 * offer them — and that is a different question from which forks are public. The first is
 * about whether this caller may ask; the second is about what the answer is, and Q1 rules
 * the answer is not the asker's to vary.
 *
 * `[]` for a bundle that is not there and for one `actor` may not read, and the two are
 * deliberately the same answer (B-03): a distinguishable empty would say which bundle ids
 * exist. `driftOf` answers its own version of that question the same way.
 */
export async function forksOf(db: Db, actor: Actor, bundleId: string): Promise<readonly BundleRecord[]> {
  const upstream = await bundleById(db, bundleId);
  if (upstream === undefined) return [];
  if (!can(actor, "read", { kind: "bundle", ownerId: upstream.ownerId, visibility: upstream.visibility })) return [];

  const rows = await forkRowsOf(db, upstream.ownerId, upstream.slug);
  return rows.filter((row) => row.visibility === "public");
}
