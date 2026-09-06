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
   * The next three are the IA pass of 2026-08-07, and all three were content moves rather
   * than renames, so each landed on the page that then held what the old one held. One of
   * them has since been repointed and one more entry has joined them, both for the reason
   * two paragraphs down.
   *
   * `/spec` was the overview above three layer pages. It is deleted and the layer pages
   * are not: `/what-a-blueprint-is` is their door now, carrying the three doors' chips,
   * their file and engine-source lines, and — the part a redirect cannot do on its own —
   * the three old in-page ids. A fragment never reaches the server, but a browser
   * re-applies the fragment it started with to a `Location` that carries none, so
   * `/spec#card` follows this 308 and still finds `#card` at the other end.
   *
   * `/spec/scoring` merged into `/reading-the-radar`, and the survivor is gone too. The
   * author asked the graded page off the site on 2026-09-04 and chose a redirect over an
   * unlisting, so both paths keep working; `/reading-the-radar` had the chrome, the
   * footer and every blueprint scorecard pointing at it, and a 404 there would break more
   * links than the page was worth keeping.
   *
   * Both landed on `/build` until 2026-09-06, and both were repointed when the owner
   * deleted that route ("it is not useful and make confusion"). They are still repointed
   * rather than chained: a 308 onto a route that itself 308s costs every link written
   * before the merge two hops, which is the cost already recorded above for
   * `/how-to-build-a-dark-factory`, and pointing either of these at `/spec` would have
   * bought exactly that.
   *
   * `/what-a-blueprint-is` is the destination for both, and it is a demotion rather than a
   * shrug. The argument for `/build` was that it was the one place left where a reader
   * watched a score move; nothing on the site does that now, so no destination can answer
   * the question either old URL was asking. What survives of it is the vocabulary those
   * scores were computed over, and `/what-a-blueprint-is` is where the Learn sequence
   * starts and where that vocabulary is introduced. A reader arriving on a bookmarked
   * `/reading-the-radar` gets the beginning of the explanation rather than a 404 or a
   * second hop.
   *
   * `#weights` dies with the page. `ScoringModel` owned that id and nothing renders it
   * any more, and a fragment never reaches the server, so there was never a redirect that
   * could have carried it.
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
      /* The vocabulary's three retired paths, and the argument that put them here has now
         been reversed twice by the people who own the decision.

         `/ontology` was 308'd onto `/spec/ontology` while the vocabulary had nowhere of its
         own to live and its catalog was a band on the spec page. The accounts pass gave the
         registry's third shelf a row in the chrome and a browser of its own, so the entry
         came out: a browse target that redirects into a specification document is the "one
         route, two names" defect from the other end, and the header would have been sending
         a reader to Vocabulary and landing them on Ontology. `/ontologies` and its slug form
         were repointed onto the browser in the same change, and
         `components/ontology/canonical-route.test.ts` was written to hold both routes in
         place "so neither can quietly absorb the other again".

         The owner absorbed one into the other on 2026-09-06: "move the ontology page in the
         /spec/ontology substituing the "every term" box. Then, you can delete the /ontology
         page". The browser became a band on the spec page and the index was deleted, so all
         three paths landed there. The argument above is kept rather than replaced because it
         is still the reason the split existed, and a reader who finds only the outcome
         cannot tell a decision from a drift.

         AND THE SPEC PAGE ITSELF WENT, LATER THE SAME DAY. The owner accepted the finding
         that the vocabulary and the Attractor specification read as two rival standards
         because of the order a reader meets them in ("The motivations you provided are
         sound. Apply them"): every ontology term exists to be a legal value of a card field,
         so each is printed beside the field that consumes it and `/spec/ontology` folds into
         `/spec/card`. That is why the three rows below name `/spec/card` and why a fourth
         one joins them.

         FOUR ROWS, ONE HOP EACH. All three could have been left pointing at
         `/spec/ontology`, which now 308s itself, and every link written before the §1 rename
         would pay two hops for it; `/ontologies` would pay three, having already been
         repointed once this morning. That is the cost recorded below for
         `/how-to-build-a-dark-factory`, and it is not paid twice. The repoint is the whole
         reason this arrives as one added row AND three changed destinations.

         `/ontology/<term>` is NOT shadowed by the first row. A `source` with no parameter in
         it compiles to an anchored, exact pattern: verified against the matcher Next 16.2.11
         actually ships (`next/dist/compiled/path-to-regexp`), where `/ontology` tests true
         for `/ontology` and false for `/ontology/pii-handling` and `/ontology/a/b`. The term
         detail pages keep their URLs, which is why every card chip and every search hit
         still resolves. */
      { source: "/ontology", destination: "/spec/card", permanent: true },
      { source: "/ontologies", destination: "/spec/card", permanent: true },
      { source: "/ontologies/:slug", destination: "/spec/card", permanent: true },
      { source: "/spec/ontology", destination: "/spec/card", permanent: true },
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
        destination: "/what-a-blueprint-is",
        permanent: true,
      },
      {
        source: "/reading-the-radar",
        destination: "/what-a-blueprint-is",
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
