/* ============================================================
   DarkPrint backend — getProfile
   The one published reader. D-130-02: it answers a VALUE and
   publishes no rejection, so an unknown handle, a handle no
   account holds and a name that is not legal at all are ONE
   answer. That is B-03 one layer down — a caller that can tell
   those apart has the existence oracle the 404 was closing — and
   it is why the 404 is the route's to produce from the absence
   rather than this module's to raise.
   ============================================================ */

import { eq } from "drizzle-orm";
import { getPublicAuthor } from "@/lib/server/accounts";
import type { Actor } from "@/lib/server/policy";
import { blueprints, cardsOwnedBy } from "@/lib/server/registry";
import { schema, type Db } from "@/lib/db";

import { withProfileStore } from "./store";
import { countNamespacedTerms } from "./terms";
import type { ProfileRecord } from "./types";

/**
 * One handle's public profile as `actor` may see it, or `undefined`.
 *
 * **`counts` is computed here, per call, and cached nowhere (AC1, AC2).** Both figures are
 * a function of the actor: an owner's visible bundle set includes their private rows and a
 * visitor's does not, so the same handle yields two different records. Memoising either on
 * `handle` alone would serve the owner's counts to a visitor, which is the private-row leak
 * B-13 exists to prevent, arriving through a cache rather than through a query.
 *
 * **AC2 falls out of the `Actor` rather than out of a branch.** There is no `if (owner)`
 * anywhere in this function: `blueprints(db, actor)` already applies T080's ruled filter,
 * and the terms count is taken over the slugs that filter returned. An owner/visitor test
 * written here would be a second copy of `readable()` — the thing D-130-04 forbids — and it
 * would be the copy that goes stale when the policy changes.
 *
 * The grammar check is INHERITED and not restated. `getPublicAuthor` puts the handle
 * through T070's `validateNamespace` before it reaches a driver, so an illegal handle is
 * `undefined` here without a statement being issued, and a tightening in T070 — T071
 * narrows the bound to 32 characters — is a tightening here for free. Nothing in this file
 * names a length or a character class.
 */
export async function getProfile(
  db: Db,
  actor: Actor,
  handle: string,
): Promise<ProfileRecord | undefined> {
  const author = await getPublicAuthor(db, handle);
  if (author === undefined) return undefined;

  /* Read after the author rather than before it, so the grammar guard above stands between
     a caller's string and this statement. `getPublicAuthor` cannot return the row's id or
     its `created_at` — `PublicAuthor` has neither, by T050's AC2 design — and
     `lib/server/accounts/**` is Forbidden here, so there is nowhere to add a reader that
     would. Reading the table directly is what T080's own snapshot does for handles. */
  const [row] = await withProfileStore("getProfile", async () =>
    db
      .select({ id: schema.account.id, createdAt: schema.account.createdAt })
      .from(schema.account)
      .where(eq(schema.account.handle, handle))
      .limit(1),
  );
  /* The row was there a statement ago and is not now: a rename or a deletion landed between
     the two reads. `undefined` is the same answer as "no such handle", which is what a
     caller of a profile page needs and what keeps the two indistinguishable (D-130-02). */
  if (row === undefined) return undefined;

  const owned = (await blueprints(db, actor)).filter((b) => b.ownerHandle === handle);

  /* T132, D-132-02 reading (a): cards this handle OWNS, not cards the index carries for it.
     The two differ by a card no release pins, and `cardsOwnedBy` is the reader T080 published
     for exactly that difference — so the count cannot be quietly short, and the actor half of
     it is still T080's decision rather than a second `readable()` here (D-130-04). Counted
     from the list rather than asked for as a number, because AC1's sentence is that anything
     countable is counted and never stored as a counter. */
  const cards = await cardsOwnedBy(db, actor, handle);

  return {
    author,
    joinedAt: row.createdAt,
    counts: {
      blueprints: owned.length,
      cards: cards.length,
      terms: await withProfileStore("getProfile", () =>
        countNamespacedTerms(db, row.id, handle, owned.map((b) => b.slug)),
      ),
    },
  };
}
