import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: stray lockfiles exist in parent directories.
  turbopack: {
    root: import.meta.dirname,
  },

  /**
   * The §1 rename, kept honest. `/parts` held reusable sub-graphs and `/ontologies`
   * was a gallery of vocabularies; the registry now has one node-card library and one
   * core ontology, so both old shapes are permanent (308) redirects rather than dead
   * links. A `/parts/:slug` has no counterpart — a part was never a node card — so it
   * lands on the library index instead of guessing at an id.
   *
   * `/gallery` is the §0 rename: the section is **Blueprints**, and "Gallery" is only
   * what it used to be called. The index now sits at `/blueprints`, the sibling of the
   * `/blueprints/[slug]` detail pages it was always linking into. Next passes the query
   * string through a redirect, so the `/gallery?tag=…` deep links the blueprint pages
   * used to emit still arrive at the same filtered index.
   */
  async redirects() {
    return [
      { source: "/gallery", destination: "/blueprints", permanent: true },
      { source: "/parts", destination: "/nodes", permanent: true },
      { source: "/parts/:slug", destination: "/nodes", permanent: true },
      { source: "/ontologies", destination: "/ontology", permanent: true },
      { source: "/ontologies/:slug", destination: "/ontology", permanent: true },
    ];
  },
};

export default nextConfig;
