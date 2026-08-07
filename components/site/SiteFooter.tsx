import Link from "next/link";

/**
 * Four columns. The first two are the header's two groups; the last two are the two
 * sequences the header shows as a single item each.
 *
 * ── Why every anchor in here changed ──
 * The last two columns used to be the landing read in its own order, eight links into
 * eight blocks of `app/page.tsx`. Redesign spec §2 cut the landing to five beats and §3
 * moved the eight blocks onto the pages whose subject they were, so every one of those
 * fragments would now resolve to nothing. A footer link to a fragment nothing renders is
 * a dead link that looks alive, which is the failure this table was rewritten for once
 * already.
 *
 * Each anchor was repointed at the id it moved with, and all five ids survive verbatim on
 * their new routes:
 *
 *     /#anchor      → gone with `/what-it-isnt` (SectionWhatItIs, deleted with the route)
 *     /#levels      → the route link below it, which lands on the ladder
 *     /#autonomy    → /towards-a-dark-factory#autonomy  (SectionLevels)
 *     /#node-card   → /spec/card                 (SectionNodeCard, the page's centrepiece)
 *     /#roles       → /spec/topology             (SectionRoles was that page's opening
 *                                                  figure until the IA pass of 2026-08-07
 *                                                  removed the band on the author's
 *                                                  instruction; the route is still the
 *                                                  right destination — it is where the
 *                                                  topology is explained — but the figure
 *                                                  that named this anchor is unmounted)
 *     /#examples    → /what-a-blueprint-is       (SectionExample, which moved with the
 *                                                  deletion of `/spec`; the door page is
 *                                                  its only mount now)
 *     /#scoring     → /reading-the-radar         (moved off /spec onto its own route,
 *                                                  lifecycle-scoring spec §4, then merged
 *                                                  into the radar page by the IA pass; the
 *                                                  fragment it used to be is gone, so this
 *                                                  is a route link now rather than one)
 *     /#lifecycle   → /#lifecycle                (SectionLifecycle, moved again: redesign
 *                                                  spec §3 put it on `/blueprints`, the
 *                                                  lifecycle-scoring pass's own §2 brought
 *                                                  it back to the landing as beat 4, so the
 *                                                  fragment survived two moves and landed
 *                                                  back where its first link pointed)
 *
 * Four of them lost their fragment on the way. `#node-card` and `#examples` are now the
 * first figure on a page that exists for them, and `#roles` is a page that exists for the
 * subject even though the figure itself has since been removed — so in all three cases
 * linking the route says more than linking the block does, and `nav.test.ts` checks the
 * route rather than guessing at an id somebody may rename.
 *
 * ── Labels ──
 * Where the header names a route, the label here is the header's label, character for
 * character, and `nav.test.ts` holds them together. They drifted once: the header called
 * `/spec` "Spec" and this called it "The spec language", so one route had two names on
 * one page. `/spec` is gone — the IA pass deleted it and `/what-a-blueprint-is` is the
 * door onto the three layer pages now — but the column below is still headed with what it
 * was called, because that is what the three files a bundle holds are collectively named
 * and the column is a list of them rather than a list of children of a route.
 *
 * The three `/spec` children are not called what their pager calls them ("Topology",
 * "Node card", "Ontology" in `components/spec/sequence.ts`). Those labels are read inside
 * a numbered sequence that supplies the context, and out here "Ontology" is already the
 * registry's own route. A label that means two destinations in one footer is the defect
 * this file's test exists to catch, so the three carry their subject instead.
 */
export const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Registry",
    links: [
      { href: "/blueprints", label: "Blueprints" },
      { href: "/nodes", label: "Nodes" },
      { href: "/ontology", label: "Ontology" },
      // Two rows came out on 2026-08-07, both on the author's instruction, and the column
      // is the three registry indexes and nothing else now.
      //
      //   `/#lifecycle` "What you can do with one" — the only fragment link left in this
      //   table, and the only row here that was not a place the registry keeps something.
      //   It pointed at a beat of the landing, which is one scroll from the wordmark every
      //   page already carries.
      //
      //   `/upload` "Upload blueprint" — still reachable from the header's own button at
      //   every width and from the phone panel, which is where an action belongs. It was
      //   in this column because the column used to be a sitemap; a list of the three
      //   things the registry holds is a better answer to the word "Registry" than a list
      //   of everything adjacent to it.
      //
      // `nav.test.ts` had an assertion built on the second one being here — it held the
      // header's wording for `/upload` to the footer's, since `/upload` is the one
      // destination that is a button rather than a `NAV` row. That check is rewritten
      // against the phone panel in the same commit rather than deleted, because the defect
      // it was written for (four names for one destination, the loudest on the page
      // itself) is not fixed by removing one of the names.
    ],
  },
  {
    title: "Learn",
    links: [
      // The header's order, and for the header's reasons. Three rows came out in the IA
      // pass and none was replaced: `/spec` is deleted (the first row is its door now),
      // `/spec/scoring` merged into `/reading-the-radar` and handed it its label, and
      // `/concepts` is the `#the-words` section of the first row.
      { href: "/what-a-blueprint-is", label: "What a blueprint is" },
      { href: "/reading-the-radar", label: "How a blueprint is graded" },
      { href: "/build", label: "Design a blueprint" },
      { href: "/towards-a-dark-factory", label: "Towards a Dark Factory" },
      // "The climb" stood here — the route's second and last page, promoted out of a
      // column of its own. The author deleted that page on 2026-08-07, so the route is one
      // page again and the row above is all of it.
      //
      // "The DarkPrint skill" and "Connect via MCP" stood here too, until the author:
      // "'The DarkPrint skill' and 'Connect via MCP' should not appear under 'Learn'".
      // They are setup actions and this column is the reading path, which is the same
      // distinction the header draws with a rule between Ontology and the first of them.
      //
      // Removed rather than moved to a fourth column. A "Setup" column of two rows would
      // rebuild the shape a fourth column already had here once — "The route", deleted on
      // 2026-08-07 — and both routes are in the header at every width, including the phone
      // panel. If they should be in the footer under a heading of their own, that is a
      // column to add rather than these two rows to put back.
      // "What it isn't" and "What a dark factory is" both pointed at `/what-it-isnt`,
      // which is gone. Neither is repointed: `SectionWhatItIs` held the definition and
      // was deleted with the route, so there is no id left for the second link and no
      // other page makes the comparison the first one promised.
    ],
  },
  {
    // The three files a bundle holds, and the only permanent entrance to the three pages
    // that describe them: `nav.test.ts` requires every sub-route of the two sequences to
    // be carried here, because a page reachable from one pager and nothing else
    // disappears the moment somebody edits that pager. `/spec/scoring` was a fourth row
    // and is not a bundle file — it merged into `/reading-the-radar`, which the Learn
    // column above carries under the label that came with it.
    title: "The spec language",
    links: [
      { href: "/spec/topology", label: "The topology, in DOT" },
      { href: "/spec/card", label: "The node card, in YAML" },
      { href: "/spec/ontology", label: "The vocabulary" },
    ],
  },
  /* A fourth column, "The route", stood here until 2026-08-07 and held three links:
     `/towards-a-dark-factory#autonomy` under the label "Autonomy, and the levels",
     `/towards-a-dark-factory/which-tasks`, and `/towards-a-dark-factory/the-climb`.

     Two things were wrong with it and one of them was invisible to `nav.test.ts`. The
     first row was the SAME PAGE as the Learn column's "Towards a Dark Factory", under a
     different name, in a different column — one route with two labels on one screen, which
     is the exact defect the first block of that test file exists to prevent. It was not
     caught because the fragment makes the two hrefs differ. Counting the header, the `h1`
     and the pager, that page answered to four names.

     The second is a matter of rank. "Dark factory" is one class of blueprint — the case
     where all five lifecycle phases run unattended — and blueprints and nodes are the
     site's spine. A column of its own, ranked beside "Registry" and "The spec language",
     gave one special case the footprint of a subject. It is two Learn rows now, and
     `/which-tasks` is not among them because it is not a route any more. */
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface/40">
      {/* Four tracks at `lg`, where the wordmark sits in the row with the three columns.
          At `sm` the wordmark takes a row of its own and the three columns take the next,
          which is what keeps a column from being orphaned under its siblings. Both counts
          follow `COLS`, which lost a column on 2026-08-07; a grid tuned to four with three
          in it leaves a track of air where a reader reads a missing column. */}
      <div className="container-page grid grid-cols-2 gap-8 py-12 sm:grid-cols-3 lg:grid-cols-4">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight">
            <span className="text-fg">Dark</span>
            <span className="text-cyan">Print</span>
          </Link>
          {/* The second sentence, "This is where the graphs in between are kept.", came
              out on the author's instruction 2026-08-07. The claim is unchanged and one
              sentence shorter: the site's own tagline, which `app/layout.tsx` carries as
              metadata and the hero prints under the wordmark, said the whole thing. */}
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-dim">
            Autonomy you can read as a graph.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            {/* `h3`, not `h4`: the footer follows the page's own headings, and every
                route tops out at an `h2` before it — a jump to level four skips a
                level in the outline. The look is entirely in the classes. */}
            <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
              {col.title}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted transition-colors hover:text-fg"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line/60">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-dim sm:flex-row">
          <span>© 2026 DarkPrint · darkprint.io</span>
          {/* The archive, the ontology and the two computed scores are real and
              parsed at build time; only the community and telemetry rows are seeded.
              A blanket "mock data" contradicts what the homepage already separates. */}
          <span className="font-mono">
            a concept build · real archive · seeded community
          </span>
        </div>
      </div>
    </footer>
  );
}
