import { notFound, permanentRedirect } from "next/navigation";

import { getSharedDbClient } from "@/lib/db";
import { blueprints } from "@/lib/server/registry";
import type { Actor } from "@/lib/server/policy";
import { actorFrom, getPublicAuthor } from "@/lib/server/accounts";
import { readSession } from "@/components/profile/session";
import { legacyBlueprintTarget, searchSuffix } from "@/lib/href";

/* ============================================================
   /blueprints/<one segment>: a redirect, never a page.

   The segment is an owner's handle, sent to that profile, or the address a blueprint had
   before slugs became unique per owner, sent to the one account that holds the slug. The
   directory is named `[owner]` because Next allows one parameter name per slot and the
   canonical page under it is `[owner]/[slug]`; the value is read both ways regardless.

   Not a `redirects()` rule: the owner is not in the incoming URL for a static pattern to
   carry across, a `/blueprints/:slug` pattern would shadow the filesystem, and an async
   rule reading the registry would freeze it at build time.

   The resolution runs under the caller's own actor, so an owner following an old link to a
   private bundle is redirected while a visitor gets the 404 the visibility rule owes them.
   `blueprints()` already narrows to what the actor may read; nothing here decides
   visibility a second time.
   ============================================================ */

/** Per request: it reads the registry, a cookie and the query string. */
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: PageProps<"/blueprints/[owner]">) {
  const { owner: segment } = await params;
  const query = searchSuffix(await searchParams);

  const session = await readSession();
  const actor: Actor = session === undefined ? { kind: "anonymous" } : actorFrom(session);

  const { db } = getSharedDbClient();
  const [account, all] = await Promise.all([getPublicAuthor(db, segment), blueprints(db, actor)]);

  const target = legacyBlueprintTarget({
    segment,
    accountExists: account !== undefined,
    holders: all.filter((bp) => bp.slug === segment),
    query,
  });
  if (target === undefined) notFound();
  permanentRedirect(target);
}
