import type { MetadataRoute } from "next";
import { getSharedDbClient } from "@/lib/db";
import { blueprintHref, nodeHref, termHref } from "@/lib/href";
import { openView } from "@/lib/server/ontology";
import type { Actor } from "@/lib/server/policy";
import { blueprints, latestCards } from "@/lib/server/registry";
import { searchTerms } from "@/lib/server/search";
import { SITE_ORIGIN } from "@/lib/site";

/* The registry pages render per request, so the list of what exists is read per request too. */
export const dynamic = "force-dynamic";

const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

/**
 * Every public page that is a document and not a redirect. The signed-in pages, the
 * upload flow, the API and `/u/<handle>/saved` are left out on purpose; the redirect
 * sources in `next.config.ts` and the `/u/<handle>/<slug>` alias are not pages.
 */
const STATIC_PATHS = [
  "/",
  "/what-a-blueprint-is",
  "/towards-a-dark-factory",
  "/tutorial",
  "/spec/card",
  "/spec/topology",
  "/spec/attractor",
  "/blueprints",
  "/nodes",
  "/capabilities",
  "/mcp",
  "/skill",
];

const entry = (path: string): MetadataRoute.Sitemap[number] => ({ url: `${SITE_ORIGIN}${path}` });

/**
 * Registry pages an anonymous reader can open: every public blueprint, the latest version
 * of every public card, every term the vocabulary (core plus public local extensions)
 * declares, and the profile of every account with a public blueprint. Read through the
 * same barrels the pages themselves use, so visibility is decided in one place.
 */
async function registryPaths(): Promise<string[]> {
  const { db } = getSharedDbClient();
  const [publicBlueprints, cards, localTerms] = await Promise.all([
    blueprints(db, ANONYMOUS),
    latestCards(db, ANONYMOUS),
    searchTerms(db, ANONYMOUS, { origin: "local" }),
  ]);
  const vocabulary = openView(localTerms.hits.map((hit) => hit.item));
  const owners = [...new Set(publicBlueprints.map((bp) => bp.ownerHandle))].sort();
  return [
    ...publicBlueprints.map((bp) => blueprintHref(bp.ownerHandle, bp.slug)),
    ...cards.map((card) => nodeHref(card.id)),
    ...vocabulary.ontology.terms.map((term) => termHref(term.id)),
    ...owners.map((handle) => `/u/${encodeURIComponent(handle)}`),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let dynamicPaths: string[] = [];
  try {
    dynamicPaths = await registryPaths();
  } catch (err) {
    /* A crawler that gets the static pages and retries later is better served than one
       that gets a 500; the failure is still logged so it is not silent. */
    console.error("sitemap: registry unavailable, listing static pages only", err);
  }
  return [...STATIC_PATHS, ...dynamicPaths].map(entry);
}
