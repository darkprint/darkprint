import Link from "next/link";

/**
 * Three columns, and the middle one is doc 2 §2.1's ladder in order.
 *
 * Every anchor points at a block that exists on the rebuilt landing. The old set did
 * not survive the reorder: `/#what` and `/#content` were sections that are gone, and
 * `/#telemetry` named a panel whose material now sits inside the example's scoring
 * note. A footer link to a fragment nothing renders is a dead link that looks alive.
 */
const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Registry",
    links: [
      { href: "/blueprints", label: "Blueprints" },
      { href: "/nodes", label: "Nodes" },
      { href: "/ontology", label: "Ontology" },
      // Not "Share a blueprint": publishing has no backend, and this link is rendered
      // on the landing too. The header and both doors use the same wording.
      { href: "/upload", label: "Validate a bundle" },
    ],
  },
  {
    title: "Start here",
    links: [
      { href: "/#anchor", label: "What a dark factory is" },
      { href: "/#levels", label: "Where you are today" },
      { href: "/what-it-isnt", label: "What it isn't" },
      { href: "/which-tasks", label: "Which tasks fit" },
    ],
  },
  {
    title: "How it is read",
    links: [
      { href: "/#examples", label: "The starter factory" },
      { href: "/#scoring", label: "How a factory is graded" },
      { href: "/#autonomy", label: "Autonomy, and the levels" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface/40">
      <div className="container-page grid grid-cols-2 gap-8 py-12 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight">
            <span className="text-fg">Dark</span>
            <span className="text-cyan">Print</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-dim">
            Specifications go in. Software comes out. This is where the graphs in
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
