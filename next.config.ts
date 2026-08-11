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
   * The next two are the redesign's §4.2 rename. `/how-to-build-a-dark-factory` became
   * `/towards-a-dark-factory` on the author's instruction and `/which-tasks` folded into
   * it as a child, and both old paths were in the header and the footer of every page
   * this site has ever served. Neither may 404.
   *
   * `/which-tasks` then moved a second time and its entry below points at the second
   * destination rather than at the first: the child route it was 308'd to was merged into
   * its own parent on 2026-08-07 (`components/howto/route.ts` records why), so chaining
   * would cost every one of those old links two hops for no gain. The child path gets an
   * entry of its own directly under it, because it was live long enough to be linked and a
   * merged page is exactly the case a redirect is for.
   *
   * Neither carries the `#which-tasks` fragment the merged material now sits under. A
   * redirect that appends a fragment overrides the one a reader arrived with, and the
   * precedent on this route is already recorded above for `/concepts`.
   *
   * Each one lands on the page that holds its content rather than on the new parent.
   * `/how-to-build-a-dark-factory` was the four phases, the holdout scenarios and the
   * progressive-disclosure account, and all of that is now `/towards-a-dark-factory/
   * the-climb`; the parent is the 1-5 ladder, which that page never carried. A redirect
   * to a parent index is how a bookmark quietly becomes a shrug.
   *
   * The last three are the IA pass of 2026-08-07, and all three are content moves rather
   * than renames, so each lands on the page that now holds what the old one held.
   *
   * `/spec` was the overview above three layer pages. It is deleted and the layer pages
   * are not: `/what-a-blueprint-is` is their door now, carrying the three doors' chips,
   * their file and engine-source lines, and — the part a redirect cannot do on its own —
   * the three old in-page ids. A fragment never reaches the server, but a browser
   * re-applies the fragment it started with to a `Location` that carries none, so
   * `/spec#card` follows this 308 and still finds `#card` at the other end.
   *
   * `/spec/scoring` merged into `/reading-the-radar`, which now holds the picture and the
   * arithmetic in one page under the title every inline link already used for it.
   * `#weights` survives with it, because `ScoringModel` owns that id and moved whole.
   *
   * `/concepts` folded into `/what-a-blueprint-is#the-words`. The destination here is the
   * bare route rather than the fragment: a redirect that appends a fragment overrides the
   * one a reader arrived with, and `/concepts` had none of its own worth preserving.
   *
   * `permanent: true`, so 308 rather than 307. The rename is a decision and not an
   * experiment, and 308 is the code that tells a client to stop asking. Redirects are
   * checked before the filesystem, so a directory reappearing at any old path would
   * be shadowed by its entry here; `components/site/nav.test.ts` fails if one does.
   */
  async redirects() {
    return [
      { source: "/gallery", destination: "/blueprints", permanent: true },
      { source: "/parts", destination: "/nodes", permanent: true },
      { source: "/parts/:slug", destination: "/nodes", permanent: true },
      /* Both land on `/ontology` since the accounts pass, and the `/ontology` entry that
         stood under them is gone: that route is a page again.

         It was 308'd onto `/spec/ontology` when the vocabulary had nowhere of its own to
         live and its catalog was a band on the spec page. The accounts pass gives the
         registry's third shelf a row in the chrome, and a browse target that redirects
         into a specification document is the "one route, two names" defect from the other
         end — the header would be sending a reader to Vocabulary and landing them on
         Ontology. So `/ontology` lists the terms, `/spec/ontology` specifies the format,
         and a gallery of vocabularies becomes the one vocabulary's browser rather than the
         document about it. `components/ontology/canonical-route.test.ts` records the
         reversal and holds both routes in place. */
      { source: "/ontologies", destination: "/ontology", permanent: true },
      { source: "/ontologies/:slug", destination: "/ontology", permanent: true },
      /* Repointed 2026-08-07: this landed on `/towards-a-dark-factory/the-climb` until the
         author deleted that page, and a 308 to a 308 costs every link written before §4.2
         two hops. Both of these now land on the parent, which is the whole route. */
      {
        source: "/how-to-build-a-dark-factory",
        destination: "/towards-a-dark-factory",
        permanent: true,
      },
      {
        source: "/towards-a-dark-factory/the-climb",
        destination: "/towards-a-dark-factory",
        permanent: true,
      },
      {
        source: "/which-tasks",
        destination: "/towards-a-dark-factory",
        permanent: true,
      },
      {
        source: "/towards-a-dark-factory/which-tasks",
        destination: "/towards-a-dark-factory",
        permanent: true,
      },
      { source: "/spec", destination: "/what-a-blueprint-is", permanent: true },
      {
        source: "/spec/scoring",
        destination: "/reading-the-radar",
        permanent: true,
      },
      { source: "/concepts", destination: "/what-a-blueprint-is", permanent: true },
      /* `/install` split in two on 2026-08-07 — the author: "I prefer two pages, one for
         the skill and one for the mcp." It went to `/skill` and not `/mcp` because a
         redirect has to pick the destination that answers the question the old URL was
         answering, and `/install` had a working install command at the top of it and an
         unbuilt preview below. Anyone arriving on a saved `/install` link came for the
         command. `/skill` links to `/mcp` in its last sentence, so the other half is one
         click away; landing an install attempt on a page where nothing installs would not
         be. */
      { source: "/install", destination: "/skill", permanent: true },
    ];
  },
};

export default nextConfig;
