/* ============================================================
   GET /api/names/slugs/[owner]/[slug]
   Published by D-70-03. 200 with the `Availability` payload and
   no 404, for the same reason as its handle counterpart.

   **`[owner]` is read as a handle, not as an account id**, and
   that is a reading rather than something the contract states —
   reported as D-70-14. Every other route in the tree spells that
   segment as a handle (`/api/blueprints/[owner]/[slug]`,
   `/u/[username]/[slug]`), a uuid in a public URL is not
   something this codebase does, and `checkSlug` publishes
   `ownerId`, so the join has to happen somewhere. It happens here
   rather than inside the module because the module's published
   surface takes the id and adding a second entry point that takes
   a handle would be inventing surface.
   ============================================================ */

import { eq } from "drizzle-orm";
import { getSharedDbClient, schema, type Db } from "@/lib/db";
import { ok } from "@/lib/server/http";
import { checkSlug, validateNamespace } from "@/lib/server/naming";

/**
 * Stands in for an owner nobody is.
 *
 * An unknown handle must NOT short-circuit to `{ available: true }`: a reserved slug is
 * reserved whoever asks, because the profile tabs occupy that segment for every handle,
 * and a name that is not a legal slug is still not legal. Answering those here would mean
 * a second implementation of `checkSlug`'s answer beside the first, which is how two
 * answers to one question start disagreeing. So the question goes to the module either
 * way, with an owner id that matches no row.
 *
 * Safe by construction rather than by luck: `account.id` is `uuid().defaultRandom()`, a
 * v4 UUID, whose version nibble is always `4`. The nil UUID's is `0`, so no account can
 * ever carry this id.
 */
const NOBODY = "00000000-0000-0000-0000-000000000000";

async function ownerIdFor(db: Db, handle: string): Promise<string> {
  /* Asked before the driver is reached: an illegal handle cannot be anyone's, and this
     keeps a value the grammar rejects out of a `text` comparison — `pg` sends `text` as
     UTF-8 and an unpaired surrogate becomes U+FFFD, so the lookup would otherwise be
     about a handle nobody typed. */
  if (validateNamespace(handle).length > 0) return NOBODY;
  const [row] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(eq(schema.account.handle, handle));
  return row?.id ?? NOBODY;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  const { owner, slug } = await params;
  const { db } = getSharedDbClient();
  return ok(await checkSlug(db, await ownerIdFor(db, owner), slug));
}
