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
 *     /#roles       → /spec/topology             (SectionRoles, the page's opening figure)
 *     /#examples    → /spec                      (SectionExample)
 *     /#scoring     → /spec/scoring              (moved off /spec onto its own route,
 *                                                  lifecycle-scoring spec §4; the fragment
 *                                                  it used to be is gone with it, so this
 *                                                  is a route link now rather than one)
 *     /#lifecycle   → /#lifecycle                (SectionLifecycle, moved again: redesign
 *                                                  spec §3 put it on `/blueprints`, the
 *                                                  lifecycle-scoring pass's own §2 brought
 *                                                  it back to the landing as beat 4, so the
 *                                                  fragment survived two moves and landed
 *                                                  back where its first link pointed)
 *
 * Four of them lost their fragment on the way. `#node-card`, `#roles` and `#examples`
 * are now the first figure on a page that exists for them, so linking the route says
 * more than linking the block does, and `nav.test.ts` checks the route rather than
 * guessing at an id somebody may rename.
 *
 * ── Labels ──
 * Where the header names a route, the label here is the header's label, character for
 * character, and `nav.test.ts` holds them together. They drifted once: the header called
 * `/spec` "Spec" and this called it "The spec language", so one route had two names on
 * one page.
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
      // Download, compose and upload. The lifecycle-scoring pass's own §2 brought this
      // section back to the landing as its fourth beat, so the footer reaches it there
      // again rather than on `/blueprints`, which renders no such id any more.
      { href: "/#lifecycle", label: "What you can do with one" },
      // Not "Share a blueprint": publishing has no backend, and this link is rendered
      // on the landing too. The header and both doors use the same wording.
      { href: "/upload", label: "Validate a bundle" },
    ],
  },
  {
    title: "Learn",
    links: [
      // First here as it is first in the header menu: the page that says what a blueprint
      // is for, which nothing else on the site did.
      { href: "/what-a-blueprint-is", label: "What a blueprint is" },
      { href: "/build", label: "Build one" },
      { href: "/install", label: "Install MCP" },
      { href: "/spec", label: "Spec" },
      { href: "/towards-a-dark-factory", label: "Towards a Dark Factory" },
      // "What it isn't" and "What a dark factory is" both pointed at `/what-it-isnt`,
      // which is gone. Neither is repointed: `SectionWhatItIs` held the definition and
      // was deleted with the route, so there is no id left for the second link and no
      // other page makes the comparison the first one promised.
    ],
  },
  {
    title: "The spec language",
    links: [
      { href: "/spec/topology", label: "The topology, in DOT" },
      { href: "/spec/card", label: "The node card, in YAML" },
      { href: "/spec/ontology", label: "The vocabulary" },
      { href: "/spec/scoring", label: "How a blueprint is graded" },
    ],
  },
  {
    title: "The route",
    links: [
      { href: "/towards-a-dark-factory#autonomy", label: "Autonomy, and the levels" },
      { href: "/towards-a-dark-factory/which-tasks", label: "Which tasks it can take" },
      { href: "/towards-a-dark-factory/the-climb", label: "The climb" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface/40">
      {/* Five tracks at `lg`, where the wordmark sits in the row with the four columns.
          At `sm` the wordmark takes a row of its own and the four columns take the next,
          which is what keeps a column from being orphaned under three of its siblings. */}
      <div className="container-page grid grid-cols-2 gap-8 py-12 sm:grid-cols-4 lg:grid-cols-5">
        <div className="col-span-2 sm:col-span-4 lg:col-span-1">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight">
            <span className="text-fg">Dark</span>
            <span className="text-cyan">Print</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-dim">
            Autonomy you can read as a graph. This is where the graphs in
            between are kept.
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
