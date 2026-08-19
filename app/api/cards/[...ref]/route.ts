/* ============================================================
   GET /api/cards/[...ref]        -> { card }      | 404
   GET /api/cards/[id]/versions   -> { versions }
   GET /api/cards/[id]/users      -> { users }

   Three published paths, one catch-all, because a card id may be
   namespaced — `CARD_ID` (`lib/core/card/schema.ts:167`) admits
   one `owner/name` segment pair, so `berti/solver-a` spans two
   URL segments and `[id]/versions` as a literal folder could not
   express it. The frontend's own `/nodes/[...id]` is a catch-all
   for that same reason (SEAM-09). The URLs served are exactly the
   ones published; only the file that serves them is shared.

   The dispatch is total rather than heuristic: a pinned ref always
   ends in a segment containing `@` (`parseCardRef` rejects
   anything else) and a card id never contains one, so "is the last
   segment `versions`/`users`" and "is this a ref" cannot both be
   true of one path.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { notFound, ok } from "@/lib/server/http";
import { actorFrom, card, usersOf, versionsOf, withRegistryErrors } from "@/lib/server/registry";

const NO_SUCH_CARD = "card: no such card.";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ref: string[] }> },
): Promise<Response> {
  return withRegistryErrors(request, async () => {
    const { ref } = await params;
    const { db } = getSharedDbClient();
    const actor = actorFrom(request);

    const last = ref[ref.length - 1];
    // `ref.length > 1` is what keeps `/api/cards/versions` — a one-segment path naming no
    // card — out of the sub-resource branches; it falls through and 404s as the malformed
    // ref it is, rather than answering `[]` for the empty id.
    if (ref.length > 1 && (last === "versions" || last === "users")) {
      const id = ref.slice(0, -1).join("/");
      return last === "versions"
        ? ok({ versions: await versionsOf(db, actor, id) })
        : ok({ users: await usersOf(db, actor, id) });
    }

    // One answer for three states — no such ref, a ref that is not a pinned reference, and a
    // card private to somebody else — for the reason the blueprint route states (B-03).
    const record = await card(db, actor, ref.join("/"));
    return record === undefined ? notFound(request, NO_SUCH_CARD) : ok({ card: record });
  });
}
