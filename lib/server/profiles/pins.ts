/* ============================================================
   DarkPrint backend — stored pins, and resolving them per actor

   Two halves that must stay apart, and `store.ts`'s header is why:
   `readPins` issues one of THIS module's statements and the caller
   wraps it, while `resolvePins` calls into `@/lib/server/registry`,
   which seals its own faults to the same standard. Pulling the
   second inside `withProfileStore` would re-wrap a
   `RegistryStoreError` as a profile-store fault -- which does not
   sanitize twice, it RELABELS, naming a store that was working.

   ── absence is the whole criterion, and it has three causes ──
   AC3: "a pin at a deleted target is omitted". The array a caller
   receives is therefore SHORTER than the array the account stored,
   and never carries a null (`components/profile/load.ts:182-190`,
   the shape the frontend already chose). The three ways a stored
   row fails to appear are deliberately ONE mechanism rather than
   three branches:

     * the target was deleted;
     * the target exists but this actor may not see it (D-132-04's
       C-D, extended to `pinned` at D-131-04);
     * a node pin's version is no longer pinned by any current
       release, while the `profile_pin` row survives (C-10).

   All three fall out of the readers below being actor-filtered and
   index-narrowed already. There is no visibility test in this file
   and there must not be one: a second copy of `readable()` is what
   D-130-04 exists to prevent, and it would be the copy that goes
   stale when the policy changes.

   ── why nothing here validates on the way IN ──
   `setPins` stores what it is given, subject only to arity and the
   union's shape (D-131-04, the implementer's A7 ratified with its
   reason). A write-time resolution check would remove the reader's
   witnesses: AC3's fixture is a pin whose target is REMOVED
   AFTERWARDS, and a store that refuses an unresolvable pin cannot
   hold one to delete out from under.
   ============================================================ */

import { asc, eq } from "drizzle-orm";
import type { PinnedRef } from "@/lib/data/profiles";
import type { Actor } from "@/lib/server/policy";
import { card } from "@/lib/server/registry";
import { schema, type Db } from "@/lib/db";

/** One `profile_pin` row, before anything has asked whether it still names something. */
export interface StoredPin {
  kind: "blueprint" | "node";
  ref: string;
}

/**
 * One account's stored pins, in the order the account chose.
 *
 * Ordered by `position` rather than by `created_at` or by id: `pinned` is an array whose
 * first entry is the first card drawn, so an unordered read would redraw a profile
 * differently between two requests that changed nothing.
 *
 * A STATEMENT. The caller wraps it — see this file's header.
 */
export async function readPins(db: Db, accountId: string): Promise<readonly StoredPin[]> {
  const rows = await db
    .select({ kind: schema.profilePin.kind, ref: schema.profilePin.ref })
    .from(schema.profilePin)
    .where(eq(schema.profilePin.accountId, accountId))
    .orderBy(asc(schema.profilePin.position));
  return rows;
}

/**
 * The stored pins this `actor` can actually resolve, in stored order (AC3).
 *
 * `ownedSlugs` is the profile owner's own visible blueprint slugs, which the caller already
 * has — `read.ts` computes it for `counts.blueprints` and passing it in is what keeps this
 * from being a second registry read.
 *
 * **A blueprint pin resolves against the PROFILE OWNER'S OWN bundles** (D-131-04, A5).
 * `slug` alone cannot name a bundle: `bundle_owner_slug_key` is unique on `(owner_id, slug)`
 * and not on `slug`, which is D-130-14's recorded collision — `inArray(bundle.slug, slugs)`
 * alone reaches another owner's identically-slugged bundle. Scoping to the owner is what
 * makes the union's own spelling unambiguous without widening it, and it is what the seeded
 * data already does: all six fixture pins are self-authored.
 *
 * **A node pin goes through `card`, which owns two decisions this file must not copy.** It
 * canonicalises the ref before looking it up — T080's inherited read semantics, "pins are
 * canonicalised to `id@version`, with an unparseable pin dropped" — and it reads the
 * snapshot's pin index, so a version no current release pins is `undefined` here while the
 * row survives. Matching `ref` strings against a card list instead would be a second
 * canonicaliser, and the two would disagree the first time one of them changed.
 */
export async function resolvePins(
  db: Db,
  actor: Actor,
  stored: readonly StoredPin[],
  ownedSlugs: ReadonlySet<string>,
): Promise<readonly PinnedRef[]> {
  const resolved: PinnedRef[] = [];
  /* Sequential rather than `Promise.all`, and the reason is cost rather than ordering:
     `card` loads a whole registry snapshot per call and memoises nothing, so firing both at
     once would run two full scans concurrently instead of two in sequence. Bounded at two
     either way — `setPins` accepts no more — and recorded for §11.1 rather than hidden. */
  for (const pin of stored) {
    if (pin.kind === "blueprint") {
      if (ownedSlugs.has(pin.ref)) resolved.push({ kind: "blueprint", slug: pin.ref });
      continue;
    }
    if ((await card(db, actor, pin.ref)) !== undefined) resolved.push({ kind: "node", ref: pin.ref });
  }
  return resolved;
}
