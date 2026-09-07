import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/**
 * The two colours are copies of `--color-void` and `--color-cyan-bright` in
 * `app/globals.css`: a manifest is fetched with no stylesheet behind it, so a token cannot
 * be referenced here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_TAGLINE,
    start_url: "/",
    display: "browser",
    background_color: "#05060d",
    theme_color: "#7dd3fc",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
