/* ============================================================
   DarkPrint backend — mcpProvenance
   Who published a bundle, what it was forked from, and every
   release digest. Three published readers and no query of its own.

   ── Why the owner's handle is READ rather than echoed ──
   The caller supplied `ownerHandle` and the lookup matched on it,
   so returning the argument would be right today and would be a
   claim this module never checked. It is read back through
   `publicAuthorsByIds` instead, which is also what makes D-220-05's
   handleless refusal a real branch rather than a sentence that
   cannot fire: `account.handle` is nullable until a first sign-in
   picks one (T050 AC1), and T080 excludes such a bundle from every
   listing. One call covers the owner AND the upstream owner, so
   the extra honesty costs one query rather than two.
   ============================================================ */

import { publicAuthorsByIds } from "@/lib/server/accounts";
import { listReleases } from "@/lib/server/archive";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { MCP_ACTOR } from "./actor";
import { readableBundle } from "./bundle";
import { McpRefusedError } from "./errors";
import { withMcpStore } from "./store";
import type { Provenance } from "./types";

/**
 * The provenance of one bundle.
 *
 * `actor` is ACCEPTED AND DELIBERATELY UNUSED (D-220-03). See `actor.ts`.
 *
 * Throws `McpRefusedError` for a handle nobody holds, a slug naming no bundle, a bundle this
 * actor may not read, and an owner holding no handle — one sentence for all four, B-03.
 *
 * The last of those is the one that is a judgement rather than a lookup, and D-220-05 ruled
 * it: `publishedBy` is typed `string`, the whole verb is *who published it*, and a bundle
 * whose owner cannot be named has no answer to give. T080 excludes exactly this bundle from
 * every listing, so refusing here agrees with the rest of the site instead of inventing a
 * placeholder that would only exist on this surface.
 */
export async function mcpProvenance(
  db: Db,
  actor: Actor,
  ownerHandle: string,
  slug: string,
): Promise<Provenance> {
  void actor;
  return withMcpStore("mcpProvenance", async () => {
    const bundle = await readableBundle(db, MCP_ACTOR, ownerHandle, slug);
    if (bundle === undefined) throw new McpRefusedError("mcpProvenance");

    /* One call for both owners. `lineage.ownerId` is a uuid in the store and an agent can do
       nothing with a uuid — it addresses no route on this site — so both ends of the lineage
       are resolved to handles here or not rendered at all. */
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

    /* Assigned only when it resolves, so the key is ABSENT rather than present-and-undefined
       on a fork whose upstream is withheld — the same distinction `search.ts` draws for a
       card hit's `author`, and for the same reason: an absent key says nothing, a present
       one says `null` in a shape a client will read. */
    const forkedFrom = await upstreamOf(db, bundle.lineage, authors);
    if (forkedFrom !== undefined) provenance.forkedFrom = forkedFrom;

    return provenance;
  });
}

/**
 * The upstream a fork names, or `undefined` when it may not be named.
 *
 * ── This is where AC3 would leak if it leaked at all, and the leak has no reader ──
 *
 * `lineage` is three columns on the FORK's OWN row. Rendering them names an upstream owner,
 * slug and version without ever reading the upstream — so a fork of a private bundle would
 * publish that bundle's existence through a verb that never touched it, and no visibility
 * check anywhere else on the site would have been consulted. The upstream is therefore
 * looked up and put through the same `readableBundle` filter as the subject.
 *
 * `searchBlueprints`' `forkedKeys` settled the analogous case one module over — a fork whose
 * upstream is not in the public set presents as an original, because it has no upstream a
 * reader could be sent to instead — and this follows that precedent rather than inventing a
 * second rule for the same fact.
 *
 * Omitted WHOLE and never partially. Two of the three fields with the third missing is a
 * shape every downstream reader has to special-case, and `owner` is the field that would go
 * missing: it is the one that needs a handle.
 */
async function upstreamOf(
  db: Db,
  lineage: { ownerId: string; slug: string; version: string } | undefined,
  authors: Awaited<ReturnType<typeof publicAuthorsByIds>>,
): Promise<{ owner: string; slug: string; version: string } | undefined> {
  if (lineage === undefined) return undefined;

  const owner = authors.get(lineage.ownerId)?.handle;
  if (owner === undefined || owner === null) return undefined;

  const upstream = await readableBundle(db, MCP_ACTOR, owner, lineage.slug);
  if (upstream === undefined) return undefined;

  return { owner, slug: lineage.slug, version: lineage.version };
}
