/* ============================================================
   DarkPrint backend: mcpProvenance
   Who published a bundle, what it was forked from, and every
   release digest. Three published readers and no query of its own.
   The owner's handle is read back rather than echoed, so a bundle
   whose owner has no handle refuses instead of inventing a value.
   ============================================================ */

import { publicAuthorsByIds } from "@/lib/server/accounts";
import { listReleases } from "@/lib/server/archive";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { readableBundle } from "./bundle";
import { McpRefusedError } from "./errors";
import { withMcpStore } from "./store";
import type { Provenance } from "./types";

/**
 * The provenance of one bundle, as `actor` may read it.
 *
 * Throws `McpRefusedError` for a handle nobody holds, a slug naming no bundle, a bundle this
 * actor may not read, and an owner holding no handle: one sentence for all four.
 */
export async function mcpProvenance(
  db: Db,
  actor: Actor,
  ownerHandle: string,
  slug: string,
): Promise<Provenance> {
  return withMcpStore("mcpProvenance", async () => {
    const bundle = await readableBundle(db, actor, ownerHandle, slug);
    if (bundle === undefined) throw new McpRefusedError("mcpProvenance");

    /* One call for both owners: the lineage's owner is a uuid and an agent can do nothing
       with a uuid, so both ends are resolved to handles here or not rendered at all. */
    const lineageOwnerId = bundle.lineage?.ownerId;
    const authors = await publicAuthorsByIds(
      db,
      lineageOwnerId === undefined ? [bundle.ownerId] : [bundle.ownerId, lineageOwnerId],
    );

    const publishedBy = authors.get(bundle.ownerId)?.handle;
    if (publishedBy === undefined || publishedBy === null) throw new McpRefusedError("mcpProvenance");

    const releases = (await listReleases(db, bundle.id)).map((release) => ({
      version: release.version,
      digest: release.digest,
    }));

    const provenance: Provenance = { publishedBy, releases };

    /* Assigned only when it resolves, so the key is absent rather than present-and-undefined
       on a fork whose upstream is withheld. */
    const forkedFrom = await upstreamOf(db, actor, bundle.lineage, authors);
    if (forkedFrom !== undefined) provenance.forkedFrom = forkedFrom;

    return provenance;
  });
}

/**
 * The upstream a fork names, or `undefined` when it may not be named.
 *
 * The lineage is three columns on the fork's own row, so rendering it would name an upstream
 * without ever reading it, and a fork of a private bundle would publish that bundle's
 * existence. The upstream is therefore put through the same visibility filter as the
 * subject, and a fork whose upstream is withheld presents as an original. Omitted whole and
 * never partially: two of three fields is a shape every reader has to special-case.
 */
async function upstreamOf(
  db: Db,
  actor: Actor,
  lineage: { ownerId: string; slug: string; version: string } | undefined,
  authors: Awaited<ReturnType<typeof publicAuthorsByIds>>,
): Promise<{ owner: string; slug: string; version: string } | undefined> {
  if (lineage === undefined) return undefined;

  const owner = authors.get(lineage.ownerId)?.handle;
  if (owner === undefined || owner === null) return undefined;

  const upstream = await readableBundle(db, actor, owner, lineage.slug);
  if (upstream === undefined) return undefined;

  return { owner, slug: lineage.slug, version: lineage.version };
}
