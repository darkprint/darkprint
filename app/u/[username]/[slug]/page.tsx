import { permanentRedirect } from "next/navigation";

import { blueprintHref, searchSuffix } from "@/lib/href";

/* ============================================================
   /u/[username]/[slug] — the owner's old address for a bundle.

   This route was the owner's view of a bundle while the public view lived at
   `/blueprints/<slug>`, and its own docblock said the two would meet: *"the graph, the
   evidence panel and the DOT listing … belong to the published view at
   `/blueprints/<slug>`, which moves onto this same shell in the next pass."* This is that
   pass. B-09 gave a bundle a two-part key, D-261-01 made `/blueprints/{ownerHandle}/{slug}`
   the canonical URL, and D-261-08(1) has that one page serve BOTH views per actor — the
   owner's and a visitor's — so there is nothing left for a second route to render.

   One resource, one name. That is the same defect `components/site/nav.test.ts` was written
   against, met at the URL layer instead of in the chrome: two addresses for one bundle is
   two names for one thing, and the fix is the canonical direction rather than a second
   shell kept in step by hand.

   ── Why this redirects unconditionally, with no lookup and no actor ──
   Both halves of the key are already in the path: on this route `username` IS the owner
   handle, so there is nothing to resolve and no database to ask. `/blueprints/[slug]` has
   to look its owner up precisely because the old public URL never carried one.

   And the absence of a lookup is a PROPERTY rather than a saving. A redirector that
   checked first would answer differently for a bundle that exists and one that does not,
   which is an existence oracle at exactly the layer B-03 closes — a private bundle's URL
   must not be distinguishable from an unused one. Redirecting everything and letting the
   canonical page decide keeps that decision in the one place that already holds it,
   under the actor it already reads.
   ============================================================ */

/**
 * Per request. Nothing here is worth prerendering, and the segment config says so rather
 * than leaving it to be inferred: `dynamicParams = false` and a `generateStaticParams` over
 * the five fixture bundles stood here, which is precisely the shape a registry that grows
 * between deploys cannot serve (AC3). `dynamic = "force-static"` would restore that with
 * both of the old tokens absent (D-262-25), so the intent is stated.
 */
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: PageProps<"/u/[username]/[slug]">) {
  const { username, slug } = await params;
  permanentRedirect(`${blueprintHref(username, slug)}${searchSuffix(await searchParams)}`);
}
