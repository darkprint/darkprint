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
   *
   * The last two are the redesign's §4.2 rename. `/how-to-build-a-dark-factory` became
   * `/towards-a-dark-factory` on the author's instruction and `/which-tasks` folded into
   * it as a child, and both old paths were in the header and the footer of every page
   * this site has ever served. Neither may 404.
   *
   * Each one lands on the page that holds its content rather than on the new parent.
   * `/how-to-build-a-dark-factory` was the four phases, the holdout scenarios and the
   * progressive-disclosure account, and all of that is now `/towards-a-dark-factory/
   * the-climb`; the parent is the 1-5 ladder, which that page never carried. A redirect
   * to a parent index is how a bookmark quietly becomes a shrug.
   *
   * `permanent: true`, so 308 rather than 307. The rename is a decision and not an
   * experiment, and 308 is the code that tells a client to stop asking. Redirects are
   * checked before the filesystem, so a directory reappearing at either old path would
   * be shadowed by its entry here; `components/site/nav.test.ts` fails if one does.
   */
  async redirects() {
    return [
      { source: "/gallery", destination: "/blueprints", permanent: true },
      { source: "/parts", destination: "/nodes", permanent: true },
      { source: "/parts/:slug", destination: "/nodes", permanent: true },
      { source: "/ontologies", destination: "/ontology", permanent: true },
      { source: "/ontologies/:slug", destination: "/ontology", permanent: true },
      {
        source: "/how-to-build-a-dark-factory",
        destination: "/towards-a-dark-factory/the-climb",
        permanent: true,
      },
      {
        source: "/which-tasks",
        destination: "/towards-a-dark-factory/which-tasks",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
