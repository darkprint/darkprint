import { permanentRedirect } from "next/navigation";

import { searchSuffix } from "@/lib/href";

/* ============================================================
   /u/[username]/blueprints — the tab's old address.

   T280 moved Blueprints onto the segmentless index (`components/profile/tabs.ts`'s own
   docblock says why: the tab a reader actually opens a profile to read should not sit
   behind a second click). This route used to BE that tab; now it is only the retired
   address for it, and it redirects unconditionally the same way
   `app/u/[username]/[slug]/page.tsx` redirects a bundle's own retired address — see that
   file's docblock for the argument this one reuses rather than re-deriving.

   NOTHING HERE IS THE LIST. The path reads like the blueprints shelf and a previous pass
   spent a whole session in this file looking for one; the shelf is
   `components/profile/OwnedBundles.tsx`, mounted by the segmentless
   `app/u/[username]/page.tsx`. This file returns a redirect and renders no markup at all.

   ── Why unconditional, with no lookup and no actor ──
   There is nothing to resolve. `username` is already the whole of what the destination
   needs, and a redirector that looked the handle up first would answer differently for a
   handle that exists and one that does not — an existence oracle at exactly the layer B-03
   closes. `/u/[username]` itself decides `notFound()` for an unknown handle; this route
   sends every request there and lets the one place that already holds that decision make
   it.

   ── No `export const dynamic`, on purpose ──
   `app/u/[username]/[slug]/page.tsx` pins `force-dynamic` explicitly; this route does not,
   and the difference is not an oversight. `tests/server/t262/per-request.test.ts` holds
   this route (one of `PROFILE_ROUTES`) to carrying no static segment config at all — the
   other four profile routes reach per-request rendering through `readSession`'s own
   `cookies()` call, never through a declared token, and this redirect has no reason to be
   the first exception: it is the same output for every reader of a given `username`, and
   `username` is never enumerated (D-262-25's concern for `[slug]/page.tsx` was a fixed
   FIVE-bundle `generateStaticParams`; this route never had one to begin with).
   ============================================================ */

export default async function Page({
  params,
  searchParams,
}: PageProps<"/u/[username]/blueprints">) {
  const { username } = await params;
  permanentRedirect(`/u/${username}${searchSuffix(await searchParams)}`);
}
