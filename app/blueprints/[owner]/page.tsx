import { notFound, permanentRedirect } from "next/navigation";

import { getSharedDbClient } from "@/lib/db";
import { blueprints } from "@/lib/server/registry";
import type { Actor } from "@/lib/server/policy";
import { actorFrom } from "@/lib/server/accounts";
import { readSession } from "@/components/profile/session";
import { blueprintHref, searchSuffix } from "@/lib/href";

/* ============================================================
   /blueprints/[<one segment>] — the pre-B-09 URL, and nothing else.

   ── Why the directory is named `[owner]` when the value is a SLUG ──
   Next refuses two different param names in one segment slot: with the canonical page at
   `[owner]/[slug]/`, a sibling `[slug]/` here throws *"You cannot use different slug names
   for the same dynamic path ('owner' !== 'slug')"* at ROUTING time. The build does not
   catch it — it emitted a route table listing both — so this was found by starting a
   server and asking for the URL, which is the only thing that could have found it.

   The name is Next's constraint and NOT a claim about the value: what arrives here is the
   old single-segment blueprint slug, and it is bound to `legacySlug` on the first line of
   the page so nothing downstream reads the parameter's name as its meaning.

   This route used to BE the blueprint page. B-09 made a slug unique per owner rather than
   per registry, so a one-segment URL stopped naming a resource, and D-261-01 put the page
   at `/blueprints/{ownerHandle}/{slug}`. What is left here is the promise that the old
   address keeps working, and it is a promise this file has to keep at request time.

   ── Why this is not the fourteenth entry in `next.config.ts` (D-261-02) ──
   A `redirects()` rule is a pair of static patterns, and the owner is not in the incoming
   URL for a pattern to carry across. Two further refusals, each measured rather than
   argued: a `/blueprints/:slug` rule would also match `/blueprints/{owner}` and shadow the
   filesystem, because redirects are checked before it; and an `async redirects()` that
   asked the registry would freeze a growing registry into a build-time snapshot, which is
   the one thing AC3 exists to forbid, besides opening a Postgres connection in every
   `next dev` boot and in `components/site/nav.test.ts`, which calls `redirects()` in a
   node environment with no database.

   ── Why ZERO or SEVERAL is a 404 and not a guess ──
   The old URL never named an owner. If two accounts hold the slug, this route has no fact
   that distinguishes them and picking one would invent the missing half of the key; if
   none does, there is nothing to send anybody to. Both are the same absent answer, which
   is also what B-03 asks for: a reader must not be able to tell "no such bundle" from "not
   yours", and answering differently in the two cases would put the existence oracle back
   at the route layer that AC6 closes.

   ── The reader is who they are, not `anonymous` ──
   The resolution runs under the caller's own actor, so an owner following their own old
   link to a PRIVATE bundle is redirected rather than 404'd, while a visitor following the
   same link gets the 404 the visibility rule owes them. `blueprints()` already narrows to
   what the actor may read, so this file makes no visibility decision of its own — T060
   owns that one and a second copy here is the defect this project charges hardest.
   ============================================================ */

/**
 * Per request, and it could not be otherwise: this reads the registry, a cookie and the
 * query string, and its answer changes when a bundle is published or transferred.
 *
 * Spelled `dynamic = "force-dynamic"` rather than left implicit, on D-262-25's finding
 * that the prerendering question has a third door — `dynamic = "force-static"` pins a
 * route static with both of the obvious tokens absent — so the segment config states the
 * intent instead of leaving it to be inferred from which request-time APIs happen to be
 * called today. `connection()` is not used here for D-260-09's reason: it throws when a
 * page function is invoked directly in a node-environment cell.
 */
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: PageProps<"/blueprints/[owner]">) {
  /* The segment is named `owner` because Next requires one name per slot (see above); the
     VALUE is the pre-B-09 slug. Renamed on arrival so no line below reads it as an owner. */
  const { owner: legacySlug } = await params;
  const slug = legacySlug;
  const query = searchSuffix(await searchParams);

  const session = await readSession();
  /* `actorFrom` is `@/lib/server/accounts`' and `readSession` is the one server-side
     session read in the repository (D-263-09). Neither is restated here: an actor built by
     hand from a session payload is three lines that agree with the merged pair until the
     day one of them changes. */
  const actor: Actor = session === undefined ? { kind: "anonymous" } : actorFrom(session);

  const { db } = getSharedDbClient();
  const holders = (await blueprints(db, actor)).filter((bp) => bp.slug === slug);

  const only = holders.length === 1 ? holders[0] : undefined;
  if (only === undefined) notFound();

  permanentRedirect(`${blueprintHref(only.ownerHandle, slug)}${query}`);
}
