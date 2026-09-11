/**
 * The one place the site names its own origin.
 *
 * Production answers on the www host and the apex 308s onto it, so every absolute URL the
 * site prints (canonical links, download commands, the sitemap) has to start here or a
 * reader lands one redirect away from the thing the page described. `NEXT_PUBLIC_` so the
 * same value is inlined into client bundles; a preview deployment overrides it without a
 * code change. No trailing slash, so callers can append a path directly.
 *
 * Kept free of imports: `components/bundle/load.ts` and `app/layout.tsx` both read it, and
 * a dependency here would be pulled into every client bundle that builds a link.
 */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://www.darkprint.io").replace(/\/+$/, "");

export const SITE_NAME = "DarkPrint";

/** The one-line description a tab, a search result and a share card all carry. */
export const SITE_TAGLINE = "Reusable blueprints for agent workflows";
