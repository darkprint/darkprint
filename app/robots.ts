import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * Crawlers may read every public page. The API, the signed-in pages and a reader's own
 * saved shelf are kept out: none of them is a document, and `/u/<handle>/saved` is one
 * account's private list even when the profile around it is public.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/settings", "/welcome", "/new", "/upload", "/u/*/saved"],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
